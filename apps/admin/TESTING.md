# Testing Guide

This document outlines the testing strategy and how to run tests for the HumanFirst Admin application.

## Table of Contents

- [Overview](#overview)
- [Test Types](#test-types)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [CI/CD Pipeline](#cicd-pipeline)
- [Best Practices](#best-practices)

---

## Overview

Our testing strategy follows a pyramid approach:
```
         /\
        /  \  E2E Tests (Playwright)
       /----\
      / Inte \  Integration Tests (Vitest + DB)
     /gration\
    /----------\
   /   Unit     \  Unit Tests (Vitest)
  /______________\
```

**Test Coverage Goals:**
- Unit Tests: 70%+ coverage
- Integration Tests: All critical API routes
- E2E Tests: Core user workflows

---

## Test Types

### 1. Unit Tests
**Purpose:** Test individual functions and components in isolation
**Tool:** Vitest
**Location:** `__tests__/` or `*.test.ts` files

**What to test:**
- Business logic functions (`lib/ops`, `lib/ai`, `lib/bdd`)
- Utility functions
- Data transformations
- React components (with React Testing Library)

**Example:**
```typescript
import { describe, it, expect } from 'vitest';
import { parseTranscript } from '@/lib/ops/transcript-parser';

describe('parseTranscript', () => {
  it('should extract caller name from transcript', () => {
    const input = 'Caller: John Doe\nTranscript\nAI: Hello...';
    const result = parseTranscript(input);
    expect(result.callerName).toBe('John Doe');
  });
});
```

### 2. Integration Tests
**Purpose:** Test API routes and database interactions
**Tool:** Vitest + PostgreSQL
**Location:** `tests/integration/` or `*.integration.test.ts`

**What to test:**
- API endpoint responses
- Database queries and mutations
- External API integrations (mocked)
- Error handling

**Example:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';

describe('POST /api/callers', () => {
  beforeEach(async () => {
    await prisma.caller.deleteMany();
  });

  it('should create a new caller', async () => {
    const response = await fetch('/api/callers', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Caller', phone: '+1234567890' }),
    });

    expect(response.status).toBe(201);
    const caller = await response.json();
    expect(caller.name).toBe('Test Caller');
  });
});
```

### 3. BDD Feature Tests
**Purpose:** Test user workflows in business-readable format
**Tool:** Cucumber (planned)
**Location:** `docs-archive/bdd-specs/`

**What to test:**
- Complete user workflows
- Business scenarios
- Acceptance criteria

**Example:**
```gherkin
Feature: Call Processing
  Scenario: Start a call with a caller
    Given I am on the caller detail page for "John Doe"
    When I open the chat panel
    And I click "Start Call"
    Then I should see "CALL IN PROGRESS"
    And the message input should be enabled
```

### 4. E2E Tests
**Purpose:** Test the application end-to-end in a browser
**Tool:** Playwright
**Location:** `e2e/`

**What to test:**
- Critical user journeys
- Cross-page workflows
- UI interactions
- Visual regression (optional)

**Example:**
```typescript
import { test, expect } from '@playwright/test';

test('should complete call workflow', async ({ page }) => {
  await page.goto('/callers');
  await page.click('[data-testid="caller-card"]');
  await page.keyboard.press('Meta+K');
  await page.click('text=Start Call');

  await expect(page.locator('text=CALL IN PROGRESS')).toBeVisible();
});
```

---

## Running Tests

### Install Dependencies
```bash
npm install
npm run playwright:install
```

### Unit Tests
```bash
# Run all unit tests
npm run test

# Run in watch mode
npm run test:watch

# With coverage report
npm run test:coverage
```

### Integration Tests
```bash
# Run integration tests (requires PostgreSQL)
npm run test:integration
```

### E2E Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run in UI mode (interactive)
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug

# Run specific test file
npx playwright test e2e/01-navigation.spec.ts
```

### Run All Tests
```bash
npm run test:all
```

---

## Writing Tests

### Test Structure
Follow the AAA pattern:
- **Arrange:** Set up test data and conditions
- **Act:** Execute the code under test
- **Assert:** Verify the results

```typescript
describe('Feature', () => {
  it('should do something', () => {
    // Arrange
    const input = 'test data';

    // Act
    const result = functionUnderTest(input);

    // Assert
    expect(result).toBe('expected output');
  });
});
```

### Test Naming
Use descriptive names that explain the behavior:
```typescript
// ❌ Bad
it('test 1', () => { ... });

// ✅ Good
it('should return caller name when valid transcript is provided', () => { ... });
```

### Mocking
Use Vitest mocks for external dependencies:
```typescript
import { vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    caller: {
      findMany: vi.fn().mockResolvedValue([...]),
    },
  },
}));
```

### E2E Test Selectors
Use `data-testid` attributes for stable selectors:
```tsx
// Component
<button data-testid="start-call-btn">Start Call</button>

// Test
await page.click('[data-testid="start-call-btn"]');
```

---

## CI/CD Pipeline

### GitHub Actions Workflows

#### 1. Test Suite (`.github/workflows/test.yml`)
Runs on every PR and push to main:
- ✅ Lint & Type Check
- ✅ Unit Tests
- ✅ Integration Tests
- ✅ BDD Tests
- ✅ Build Check
- ✅ Coverage Report

#### 2. E2E Tests (`.github/workflows/e2e.yml`)
Runs E2E tests with Playwright:
- Runs on PR, main push, and nightly
- Tests on Chrome & Mobile Chrome
- Uploads videos on failure
- Optional visual regression testing

#### 3. Deploy (`.github/workflows/deploy.yml`)
Automated deployment pipeline:
- Runs all tests first
- Deploys to staging automatically on main
- Manual production deployment
- Database migrations
- Rollback support

### Coverage Requirements

Tests must maintain minimum coverage:
- **Lines:** 70%
- **Branches:** 65%
- **Functions:** 70%

Coverage gates will fail the build if thresholds aren't met.

### Required Checks

All PRs must pass:
1. Lint & Type Check
2. Unit Tests (with coverage > 70%)
3. Integration Tests
4. Build succeeds

---

## Best Practices

### 1. Write Tests First (TDD)
When adding new features:
1. Write a failing test
2. Implement the feature
3. Make the test pass
4. Refactor

### 2. Keep Tests Fast
- Unit tests should run in < 5 seconds
- Use mocks for external dependencies
- Avoid unnecessary database calls in unit tests

### 3. Test Behavior, Not Implementation
```typescript
// ❌ Bad: Testing implementation details
expect(component.state.isLoading).toBe(true);

// ✅ Good: Testing behavior
expect(screen.getByText('Loading...')).toBeInTheDocument();
```

### 4. Use Factories for Test Data
Create reusable test data factories:
```typescript
function createTestCaller(overrides = {}) {
  return {
    id: 'test-id',
    name: 'Test Caller',
    phone: '+1234567890',
    ...overrides,
  };
}
```

### 5. Clean Up After Tests
```typescript
beforeEach(async () => {
  await prisma.caller.deleteMany();
});

afterEach(() => {
  vi.clearAllMocks();
});
```

### 6. Avoid Test Interdependence
Each test should be independent and able to run in any order.

### 7. Use Descriptive Assertions
```typescript
// ❌ Bad
expect(result).toBeTruthy();

// ✅ Good
expect(result.caller.name).toBe('John Doe');
```

---

## Troubleshooting

### Tests Failing Locally
1. Ensure PostgreSQL is running
2. Run `npx prisma migrate dev`
3. Clear node_modules and reinstall: `rm -rf node_modules && npm install`

### E2E Tests Timing Out
1. Increase timeout in `playwright.config.ts`
2. Check if app is running (`npm run dev`)
3. Verify database is seeded properly

### Coverage Not Meeting Threshold
1. Run `npm run test:coverage` to see uncovered lines
2. Add tests for uncovered code
3. Consider if some code can be excluded (config files, types)

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [GitHub Actions](https://docs.github.com/en/actions)

---

## Next Steps

- [ ] Install Playwright: `npm run playwright:install`
- [ ] Write your first test
- [ ] Run tests locally: `npm run test:all`
- [ ] Create a PR and watch CI run
- [ ] Achieve 70%+ coverage

Happy Testing! 🎯
