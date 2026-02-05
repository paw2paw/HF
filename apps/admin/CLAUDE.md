# Claude Code Instructions - HF Project

**Project**: HF (Human Factors) - Adaptive Conversational AI System
**Last Updated**: 2026-02-05
**Architecture Version**: 5.1

---

## Overview

This is an adaptive conversational AI system that builds personality profiles, extracts memories, and composes personalized prompts based on call transcripts. The system uses metadata-driven configuration (BDD specs, playbooks config) instead of hardcoded values.

**Core Philosophy**: Configuration over Code. Everything should be driven by metadata files (BDD specs, JSON configs) and database records, not hardcoded constants.

---

## Critical Coding Standards

### 1. Zero Hardcoding Policy

**NEVER hardcode values.** Use configuration files or database records instead.

❌ **BAD - Hardcoded:**
```typescript
const WARMTH_THRESHOLD = 0.7;
const DEFAULT_DOMAIN = "companion";
const BEHAVIOR_PARAMS = ["BEH-WARMTH", "BEH-EMPATHY"];
```

✅ **GOOD - Configuration-driven:**
```typescript
// Load from database
const params = await prisma.parameter.findMany({
  where: { parameterType: "BEHAVIOR", isActive: true }
});

// Load from config file
const manifest = JSON.parse(
  fs.readFileSync("bdd-specs/playbooks-config.json", "utf-8")
);
```

**Acceptable Hardcoding (Rare Cases):**
- Database field names (required by Prisma)
- Enum values defined in schema.prisma
- Error messages and user-facing text
- Mathematical constants (Math.PI, decay formulas)

**When hardcoding is unavoidable:**
- Document WHY in a comment
- Add a TODO linking to configuration migration plan
- Update architecture docs with the limitation

```typescript
// TODO: Move to config once we determine optimal decay rate
// See ARCHITECTURE.md § Time-Decay Aggregation
const HALF_LIFE_DAYS = 30; // Based on research: arxiv.org/...
```

---

### 2. Unit Test Coverage

**ALL code must have unit test coverage.**

**Requirements:**
- Every new function/module gets a corresponding test file
- Minimum 80% coverage for new code
- Use Vitest (already configured in project)
- Test files: `*.test.ts` or `*.spec.ts` co-located with source

**Test Structure:**
```typescript
// lib/learner/detect-style.test.ts
import { describe, it, expect, vi } from 'vitest';
import { detectLearningStyle } from './detect-style';

describe('detectLearningStyle', () => {
  it('should detect visual learner from high spatial scores', () => {
    const result = detectLearningStyle({ spatial: 0.9, verbal: 0.3 });
    expect(result.primaryStyle).toBe('VISUAL');
  });

  it('should handle missing data gracefully', () => {
    const result = detectLearningStyle({});
    expect(result.primaryStyle).toBe('UNKNOWN');
    expect(result.confidence).toBeLessThan(0.5);
  });
});
```

**What to test:**
- Core logic and business rules
- Edge cases (null, undefined, empty arrays)
- Error handling
- Data transformations
- API contracts (input/output shapes)

**What NOT to test:**
- Prisma queries (mock the DB)
- External API calls (mock them)
- Simple getters/setters
- Type definitions

**Running tests:**
```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

---

### 3. Architecture Documentation

**Keep [ARCHITECTURE.md](ARCHITECTURE.md) up to date.**

**When to update:**
- ✅ Adding new agents or operations
- ✅ Changing data flow or pipeline steps
- ✅ Adding new database models
- ✅ Creating new API endpoints
- ✅ Modifying core concepts (Parameters, Specs, Prompts)
- ✅ Changing reward/learning algorithms

**What to update:**
1. **Version number** at top of file (increment minor version)
2. **Last Updated** date
3. Relevant section(s) - don't rewrite the whole doc
4. Add entries to tables (Agent Inventory, API Reference, etc.)

**Update Format:**
```markdown
## [Section Name]

### [New Feature/Change]

[Description with diagrams if needed]

**Added**: 2026-02-05
**Related**: [Link to spec or API endpoint]
```

**Commit message when updating architecture:**
```bash
git commit -m "docs(arch): add learning style detection pipeline

- Added LEARN-STYLE-001 spec to Analysis System section
- Updated Agent Inventory with learning_style_detector
- Added API endpoint /api/learner/detect-style
"
```

---

### 4. BDD Specifications

**Keep BDD specs synchronized with implementation.**

**BDD Spec Location:**
- All specs: `bdd-specs/*.spec.json`
- Playbook config: `bdd-specs/playbooks-config.json`
- Contract definitions: `bdd-specs/contracts/`

**Spec-Driven Development Flow:**

```
1. Write BDD spec      → bdd-specs/FEATURE-NNN-name.spec.json
2. Run devZZZ          → npm run devZZZ (loads specs to DB)
3. Implement feature   → lib/ with unit tests
4. Update spec status  → mark scenarios as "IMPLEMENTED"
5. Update architecture → ARCHITECTURE.md
```

**BDD Spec Structure:**
```json
{
  "feature_id": "LEARN-STYLE-001",
  "title": "Learning Style Detection",
  "domain": "learning",
  "status": "DRAFT",
  "scenarios": [
    {
      "scenario": "Detect visual learner from spatial reasoning",
      "given": "Caller shows high spatial reasoning (0.8+)",
      "when": "Learning style detector runs",
      "then": "Primary style is VISUAL with confidence > 0.7",
      "status": "IMPLEMENTED"
    }
  ],
  "contracts": {
    "input": { "schema_ref": "contracts/caller-profile.json" },
    "output": { "schema_ref": "contracts/learning-style.json" }
  },
  "parameters": [
    { "parameter_id": "LEARN-VISUAL" },
    { "parameter_id": "LEARN-KINESTHETIC" }
  ]
}
```

**When to update BDD specs:**
- ✅ Adding new features → Create new spec file
- ✅ Implementing scenarios → Update status to "IMPLEMENTED"
- ✅ Changing behavior → Update Given/When/Then
- ✅ Adding parameters → Add to parameters array
- ✅ Modifying contracts → Update schema refs

**BDD spec validation:**
```bash
# After updating specs, always run:
npm run devZZZ  # Reloads specs, validates structure
```

---

## Project Structure

### Key Directories

```
apps/admin/
├── app/                    # Next.js 16 app router
│   ├── api/               # API routes
│   │   ├── callers/       # Caller management
│   │   ├── calls/         # Call processing
│   │   ├── playbooks/     # Playbook operations
│   │   └── x/             # System ops (seed, cleanup)
│   ├── callers/           # Caller UI pages
│   └── supervisor/        # Supervisor dashboard
│
├── lib/                   # Core business logic (MUST have tests)
│   ├── contracts/         # Type contracts & validation
│   ├── curriculum/        # Curriculum management
│   ├── learner/           # Learner profile logic
│   ├── pipeline/          # Pipeline orchestration
│   └── prompt/            # Prompt composition
│
├── bdd-specs/             # BDD specifications (source of truth)
│   ├── *.spec.json        # Feature specs
│   ├── playbooks-config.json  # Playbook metadata
│   └── contracts/         # JSON schemas
│
├── prisma/                # Database
│   ├── schema.prisma      # Database schema
│   ├── seed-*.ts          # Seed scripts
│   └── reset.ts           # Database reset
│
└── scripts/               # Dev/ops scripts
    └── dev-zzz.sh         # Nuclear dev reset
```

---

## Development Workflow

### Standard Flow

```bash
# 1. Start fresh (if needed)
npm run devZZZ             # Nuclear reset: DB + specs + transcripts

# 2. Normal dev
npm run devX               # Kill server + clear cache + restart

# 3. Run tests
npm run test               # Unit tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report

# 4. Database operations
npm run db:reset           # Clear all data (keep schema)
npm run db:seed:all        # Seed from all seed scripts
npx prisma studio          # Open DB GUI
```

### Adding a New Feature

**Example: Adding Learning Style Detection**

1. **Write BDD Spec**
   ```bash
   # Create: bdd-specs/LEARN-STYLE-001-learning-style-detection.spec.json
   ```

2. **Create Implementation with Tests**
   ```bash
   # lib/learner/detect-style.ts
   # lib/learner/detect-style.test.ts
   ```

3. **Add API Endpoint (if needed)**
   ```bash
   # app/api/learner/detect-style/route.ts
   ```

4. **Update Architecture**
   ```bash
   # Edit ARCHITECTURE.md:
   # - Add to Agent Inventory (if agent)
   # - Add to API Reference (if endpoint)
   # - Update relevant section
   ```

5. **Run Tests**
   ```bash
   npm test lib/learner/detect-style.test.ts
   ```

6. **Reload Specs**
   ```bash
   npm run devZZZ  # OR just POST /api/x/seed-system
   ```

7. **Update Spec Status**
   ```json
   // In LEARN-STYLE-001-*.spec.json
   "status": "IMPLEMENTED"
   ```

---

## Code Style

### TypeScript

- Use strict mode (already configured)
- Prefer types over interfaces for data shapes
- Use enums from Prisma schema (don't redefine)
- Avoid `any` - use `unknown` if type truly unknown

### API Routes (Next.js)

```typescript
// app/api/example/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input
    if (!body.requiredField) {
      return NextResponse.json(
        { ok: false, error: "requiredField is required" },
        { status: 400 }
      );
    }

    // Business logic
    const result = await someOperation(body);

    return NextResponse.json({
      ok: true,
      message: "Operation successful",
      data: result,
    });
  } catch (error: any) {
    console.error("POST /api/example error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Operation failed" },
      { status: 500 }
    );
  }
}
```

### Error Handling

```typescript
// Always log errors with context
console.error("POST /api/callers/[callerId]/aggregate error:", error);

// Return structured error responses
return NextResponse.json(
  {
    ok: false,
    error: error?.message || "Operation failed",
    details: isDevelopment ? error.stack : undefined
  },
  { status: 500 }
);
```

---

## Database Patterns

### Prisma Best Practices

```typescript
// ✅ Use transactions for related writes
await prisma.$transaction(async (tx) => {
  const caller = await tx.caller.create({ data: callerData });
  await tx.callerMemory.createMany({
    data: memories.map(m => ({ ...m, callerId: caller.id }))
  });
});

// ✅ Use include for related data (avoid N+1)
const callers = await prisma.caller.findMany({
  include: {
    _count: { select: { calls: true } },
    memories: { take: 5, orderBy: { createdAt: 'desc' } }
  }
});

// ✅ Use select to fetch only needed fields
const names = await prisma.caller.findMany({
  select: { id: true, name: true }
});

// ❌ Avoid fetching everything then filtering in JS
const all = await prisma.caller.findMany();
const filtered = all.filter(c => c.isActive); // BAD - use where clause
```

### Common Queries

```typescript
// Find or create pattern
const caller = await prisma.caller.upsert({
  where: { externalId: "ext-123" },
  create: { externalId: "ext-123", name: "New Caller" },
  update: { lastActiveAt: new Date() }
});

// Conditional delete with cleanup
const callersToDelete = await prisma.caller.findMany({
  where: { _count: { calls: 0 } }
});
for (const caller of callersToDelete) {
  await prisma.callerMemory.deleteMany({ where: { callerId: caller.id } });
  await prisma.caller.delete({ where: { id: caller.id } });
}
```

---

## Testing Patterns

### Mock Prisma

```typescript
// lib/learner/aggregate.test.ts
import { vi } from 'vitest';

const mockPrisma = {
  callerPersonality: {
    findMany: vi.fn().mockResolvedValue([
      { parameterId: 'openness', value: 0.8, confidence: 0.9 }
    ])
  }
};

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
```

### Mock API Calls

```typescript
// Mock fetch for external APIs
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ result: 'success' })
});
```

---

## Common Pitfalls

### ❌ Don't Do This

```typescript
// Hardcoded domain
const domain = await prisma.domain.findUnique({
  where: { slug: "companion" }  // HARDCODED!
});

// Fetching all then filtering
const allCalls = await prisma.call.findMany();
const filtered = allCalls.filter(c => c.callerId === targetId);

// No error handling
const result = await riskyOperation();  // Can throw!
```

### ✅ Do This Instead

```typescript
// Load from config or find dynamically
const config = await loadPlaybookConfig();
const domain = await prisma.domain.findUnique({
  where: { slug: config.domain.slug }
});

// Filter in database
const calls = await prisma.call.findMany({
  where: { callerId: targetId }
});

// Always handle errors
try {
  const result = await riskyOperation();
} catch (error) {
  console.error("Operation failed:", error);
  return { ok: false, error: error.message };
}
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Complete system architecture (READ THIS FIRST) |
| [prisma/schema.prisma](prisma/schema.prisma) | Database schema (source of truth) |
| [bdd-specs/playbooks-config.json](bdd-specs/playbooks-config.json) | Playbook metadata |
| [bdd-specs/*.spec.json](bdd-specs/) | BDD feature specifications |
| [lib/pipeline/](lib/pipeline/) | Core pipeline orchestration |
| [lib/prompt/](lib/prompt/) | Prompt composition logic |
| [scripts/dev-zzz.sh](scripts/dev-zzz.sh) | Nuclear dev reset script |

---

## Quick Commands

```bash
# Development
npm run devZZZ              # Nuclear reset (DB + specs + transcripts)
npm run devX                # Quick restart (kill + clear + dev)
npm run dev                 # Normal dev server

# Testing
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
npm run test:integration    # Integration tests

# Database
npm run db:reset            # Clear all data
npm run db:seed:all         # Seed from scripts
npx prisma studio           # DB GUI
npx prisma migrate dev      # Run migrations

# Seed System (without full reset)
curl -X POST http://localhost:3000/api/x/seed-system
curl -X POST http://localhost:3000/api/x/seed-transcripts
```

---

## Allowed Commands

These commands are pre-approved for automatic execution without permission prompts:

```bash
# Docker & Colima
colima status
colima start
colima delete -f && colima start
docker ps
docker ps | grep postgres
docker logs hf_postgres --tail 10
docker exec hf_postgres psql -U hf_user -d hf -c "SELECT 1"
docker-compose up -d postgres

# Database operations
npx prisma studio

# Development
npm run dev
npm run devX
npm run devZZZ
npm test
npm run test:watch
npm run test:coverage

# Seeding
curl -s -X POST http://localhost:3000/api/x/seed-system | jq '.'
curl -s -X POST http://localhost:3000/api/x/seed-transcripts -H "Content-Type: application/json" -d '{"mode": "keep"}' | jq '.'

# Git operations
git status
git diff
git log --oneline -10
```

**Note**: This list is automatically updated when you approve new commands during development.

---

## Getting Help

- **Architecture questions**: See [ARCHITECTURE.md](ARCHITECTURE.md)
- **Setup issues**: Check environment variables (DATABASE_URL, HF_KB_PATH)
- **Test failures**: Run `npm run test:coverage` to see gaps
- **Spec sync issues**: Run `npm run devZZZ` to reload everything

---

**Remember**: Configuration over Code. If you find yourself hardcoding, stop and create a config file instead.
