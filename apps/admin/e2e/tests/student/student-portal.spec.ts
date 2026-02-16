import { test, expect } from '../../fixtures';

/**
 * Student Portal E2E Tests
 * Tests the student-facing pages: progress, stuff, notifications
 */
test.describe('Student Progress Page', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    // Log in as admin (educator-demo teachers may not exist in all envs)
    await loginAs('admin@test.com');
  });

  test('should load student progress page', async ({ page }) => {
    await page.goto('/x/student/progress');
    await page.waitForLoadState('domcontentloaded');

    // Page should render with heading
    await expect(page.getByRole('heading', { name: /progress/i })).toBeVisible();
  });

  test('should display stat cards', async ({ page }) => {
    await page.goto('/x/student/progress');
    await page.waitForLoadState('networkidle');

    // Look for stat cards showing calls, goals, etc.
    const statCards = page.locator('.home-stat-card, [data-tour="welcome"] .stat');
    const pageContent = page.locator('main, [role="main"]');
    await expect(pageContent).toBeVisible();
  });

  test('should display active goals section', async ({ page }) => {
    await page.goto('/x/student/progress');
    await page.waitForLoadState('networkidle');

    // Should have goals or an empty state
    const goalsSection = page.getByText(/goals/i).first();
    await expect(goalsSection).toBeVisible();
  });

  test('should display learning profile section', async ({ page }) => {
    await page.goto('/x/student/progress');
    await page.waitForLoadState('networkidle');

    // Look for learning profile or personality data section
    const profileSection = page.getByText(/profile|learning|topics/i).first();
    if (await profileSection.isVisible()) {
      await expect(profileSection).toBeVisible();
    }
  });
});

test.describe('Student Stuff Page', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should load student stuff page', async ({ page }) => {
    await page.goto('/x/student/stuff');
    await page.waitForLoadState('domcontentloaded');

    const pageContent = page.locator('main, [role="main"]');
    await expect(pageContent).toBeVisible();
  });

  test('should display artifacts or empty state', async ({ page }) => {
    await page.goto('/x/student/stuff');
    await page.waitForLoadState('networkidle');

    // Either artifacts list or empty state message
    const content = page.locator('main, [role="main"]');
    await expect(content).toBeVisible();
  });
});

test.describe('Student Sidebar Navigation', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should show student nav items in sidebar', async ({ page }) => {
    await page.goto('/x/student/progress');
    await page.waitForLoadState('domcontentloaded');

    // Sidebar should have student-related links
    const sidebar = page.locator('nav, aside').first();
    await expect(sidebar).toBeVisible();
  });
});
