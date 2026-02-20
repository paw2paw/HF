# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Configuration over Code. Database over Filesystem. Evidence over Assumption.**

## Principles

1. **Zero hardcoding** — Runtime values from DB or `lib/config.ts`. Magic strings are bugs.
2. **Auth on every route** — `requireAuth("ROLE")` from `lib/permissions.ts`. CI enforces via `tests/lib/route-auth-coverage.test.ts`.
3. **DB is source of truth** — Spec JSON files are seed data. After import, the database wins.
4. **Dynamic parameters** — MEASURE specs → Pipeline → DB → UI. Adding a parameter = activate a spec, zero code changes.
5. **Holographic Intent-Led UX** — All UI surfaces organized around **user intent** (what educators want to accomplish), never internal structures. Same mental model at all detail levels: teacher sees a "Course" (composed of lessons, content, onboarding), system internally composes it from Playbooks + Specs. Hide implementation complexity; auto-scaffold infrastructure (never ask users to manually wire Playbooks to Specs).
6. **Test what matters** — Vitest for units, Playwright for e2e. Business logic must be tested.
7. **Test every route** — Every `app/api/**/route.ts` must have a test. CI enforces via test coverage scanner.
8. **E2E every feature** — Every new user-facing page or feature must have a Playwright e2e test in `e2e/tests/`. No feature ships without at least a smoke-level e2e spec covering: page loads, key elements visible, primary user flow works.
9. **Document every API** — All routes listed in `docs/api.md` (route, method, auth, purpose). No undocumented endpoints.
10. **Honest tests** — Mock only at system boundaries (DB, external APIs). Never mock the unit under test, never stub internal functions, never fabricate request/response shapes that don't match reality.
11. **AI call registry** — All AI calls go through metered wrappers (ESLint enforces). `docs/ai-calls.md` lists every call site, purpose, and model used.
12. **No dead tests** — No `test.skip` or `test.todo` in committed code.

## The Adaptive Loop

```
Call → Transcript → Pipeline (EXTRACT → AGGREGATE → REWARD → ADAPT → SUPERVISE → COMPOSE) → Next Prompt
```

Every feature must respect this loop. Pipeline stages are spec-driven from `PIPELINE-001` in the DB.

## Architecture

Single Next.js 16 app in a monorepo. All work under `apps/admin/`.

```
apps/admin/
├── app/api/         ← API routes (requireAuth on every one)
├── app/x/           ← Admin UI (all under /x/ prefix)
├── lib/
│   ├── config.ts    ← Env vars, 6 canonical spec slugs (all env-overridable)
│   ├── permissions.ts ← RBAC: requireAuth() + isAuthError()
│   ├── pipeline/    ← Pipeline stage config + runners
│   ├── prompt/      ← SectionDataLoader (16 parallel loaders) + PromptTemplateCompiler
│   ├── contracts/   ← DB-backed DataContract registry (30s TTL cache)
│   └── bdd/         ← Spec parser, compiler, prompt template generator
├── prisma/          ← Schema, migrations, seed scripts
├── cli/control.ts   ← CLI tool (npx tsx cli/control.ts)
└── e2e/             ← Playwright tests
```

### Intent-Led UX: The Teacher's View

**Teachers never see or interact with Playbooks, Specs, or Roles.** All UI is organized by **educator intent**. The same mental model works at all levels:

```
Teacher's View                  Internal Composition
─────────────────              ─────────────────────
Institution (Domain)           • Domain (1 per school/org)
└─ Course (Playbook)           • Playbook + auto-created CourseReady overlay
   ├─ Lessons                   • Composited CONTENT specs (auto-linked)
   ├─ Content Upload            • EXTRACT-CONTENT specs (annotations, media refs)
   ├─ Teaching Points (assertions)
   ├─ Onboarding Setup          • IDENTITY specs + INIT-001 phases + ADAPT targets
   │  ├─ Welcome Message        • IDENTITY spec (tutor greeting)
   │  ├─ Flow Phases            • onboardingFlowPhases (auto-generated)
   │  └─ Default Behavior       • onboardingDefaultTargets (auto-generated)
   └─ First Call Preview        • Prompt composition from merged specs
```

**No manual wiring.** When a teacher:
- **Uploads a document** → System auto-extracts teaching points, creates a CONTENT spec, links it to course
- **Reviews assertions** → System learns what "good teaching" looks like for this course
- **Opens Onboarding tab** → System auto-generates welcome message, flow phases, default targets from course profile

If a readiness check fails (e.g., "No curriculum content configured"), **the system auto-scaffolds it** rather than asking the user to understand specs.

### SpecRole Taxonomy

- `ORCHESTRATE` — Flow/sequence control (PIPELINE-001, INIT-001)
- `EXTRACT` — Measurement and learning (PERS-001, VARK-001, MEM-001)
- `SYNTHESISE` — Combine/transform data (COMP-001, REW-001, ADAPT-*)
- `CONSTRAIN` — Bounds and guards (GUARD-001)
- `IDENTITY` — Agent personas (TUT-001, COACH-001)
- `CONTENT` — Curriculum material (WNF-CONTENT-001)
- `VOICE` — Voice guidance (VOICE-001)

## Commands

All commands run from `apps/admin/` unless noted.

```bash
# Dev
npm run dev              # Start dev server (:3000)
npm run devX             # Kill + clear cache + restart
npm run devZZZ           # Nuclear reset (DB + specs + transcripts)

# Test
npm run test             # Vitest — all unit tests
npm run test -- path     # Single test file
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage report
npm run test:integration # Integration tests (requires running server)
npm run test:e2e         # Playwright e2e (requires running server)
npm run test:all         # Unit + integration + e2e

# Build & Lint
npx tsc --noEmit         # Type-check
npm run build            # Next.js production build
npm run lint             # ESLint (includes AI metering + CSS var enforcement)

# Database
npm run db:seed          # Seed specs + contracts (seed-clean.ts)
npm run db:reset         # Full database reset
npx prisma migrate dev   # Run/create migrations
npx prisma studio        # DB GUI

# BDD (from repo root)
npm run bdd              # Run Cucumber tests (bdd/features/*.feature)

# CLI
npm run ctl <command>    # Direct CLI command
npm run control          # Interactive CLI menu
```

## MCP Servers (Model Context Protocol)

The project uses two MCP servers for enhanced code exploration and semantic search:

| Server | Purpose | Config | Check |
|--------|---------|--------|-------|
| **hf-graph** | Index code structure (functions, types, imports) for fast navigation | `tools/hf-graph.ts` | `claude mcp list` |
| **qmd** | Vector + semantic search across codebase with reranking | `qmd` CLI | `qmd status` |

Both are configured in `.mcp.json` at the repo root and auto-connect when you open this project.

**On startup**, verify both are healthy:
```bash
./scripts/check-startup.sh
```

Expected output:
```
📡 MCP Servers:
hf-graph: npx tsx tools/hf-graph.ts mcp - ✓ Connected
qmd: qmd mcp - ✓ Connected

📚 qmd Index Status:
MCP: running
Documents: 1488 files indexed
Vectors: 10122 embedded
```

**If MCP servers fail to connect:**
1. Ensure `qmd` CLI is installed: `qmd --version`
2. Ensure `.mcp.json` exists at repo root with correct config
3. Restart Claude Code
4. For qmd vector search: run `qmd embed` to build embeddings (one-time, takes ~2 min)

**Use in Claude Code:**
- Ask Claude to use hf-graph for function/type lookups
- Ask Claude to use qmd for semantic searches across the repo
- Both tools are invoked automatically when relevant

## Key Patterns

```typescript
// Auth — every route:
import { requireAuth, isAuthError } from "@/lib/permissions";
export async function GET() {
  const auth = await requireAuth("VIEWER"); // VIEWER | OPERATOR | ADMIN
  if (isAuthError(auth)) return auth.error;
}

// Config — never shadow the import:
import { config } from "@/lib/config";
// ❌ const config = spec.config;  ← TDZ crash
// ✅ const specConfig = spec.config;

// ContractRegistry — always async:
// ❌ ContractRegistry.get("key")
// ✅ await ContractRegistry.get("key")

// AI calls — must use metered wrapper (eslint enforces):
// ❌ import { ... } from "@/lib/ai/client"
// ✅ import { getConfiguredMeteredAICompletion } from "@/lib/metering"
```

## Bugs to Avoid

- **TDZ shadowing**: Never `const config = ...` when `config` is imported
- **CSS alpha**: Never `${cssVar}99` — use `color-mix(in srgb, ${color} 60%, transparent)`
- **Missing await**: All ContractRegistry methods are async
- **Hardcoded slugs**: Use `config.specs.*` — all env-overridable
- **Unmetered AI**: All AI calls must go through metered wrappers

## RBAC

**SUPERADMIN (5) > ADMIN (4) > OPERATOR (3) > SUPER_TESTER (2) > TESTER/VIEWER (1) > DEMO (0)** — higher roles inherit lower permissions.

Public routes (no auth): `/api/auth/*`, `/api/health`, `/api/ready`, `/api/system/readiness`, `/api/invite/*`.

Sim access: All sim routes use `requireAuth("VIEWER")`. Testers onboard via invite → user → session flow.

## Database Patterns

```typescript
// Prefer _count over denormalized counts:
const playbooks = await prisma.playbook.findMany({
  include: { _count: { select: { items: true } } }
});

// Avoid N+1 — use include/select, never fetch-all + filter in JS

// Transactions for related writes:
await prisma.$transaction(async (tx) => {
  const caller = await tx.caller.create({ data: callerData });
  await tx.callerMemory.createMany({
    data: memories.map(m => ({ ...m, callerId: caller.id }))
  });
});
```

## Testing

- **Unit**: Vitest. `tests/setup.ts` mocks system boundaries (Prisma, fetch, next/navigation).
- **Integration**: `npm run test:integration` — requires running dev server.
- **E2E**: Playwright. Global setup logs in as admin, saves session. 3 projects: Authenticated, Unauthenticated, Mobile.
- **Auth scanner**: `tests/lib/route-auth-coverage.test.ts` — CI fails if any route lacks auth.
- **Route coverage**: Every `app/api/**/route.ts` must have a corresponding test file.
- **Honest tests**: Mock only at system boundaries. Allowed mocks: Prisma (DB), `fetch` (external APIs), `next/navigation`. Never mock the unit under test, never stub internal library functions to force a code path, never fabricate request/response shapes that diverge from real API contracts.
- **No dead tests**: No `test.skip` or `test.todo` in committed code. If a test can't pass, fix it or delete it.
- **E2E for every feature**: Every new page (`app/x/**`) or user-facing feature must have a Playwright spec in `e2e/tests/`. At minimum: page loads without error, heading/key elements visible, primary happy-path flow works. Use existing fixtures (`test-data.fixture.ts`) and page objects (`page-objects/`). Follow the pattern in existing specs.

## Prompt Composition

16 data loaders run in parallel via `SectionDataLoader`. Templates use Mustache-style syntax (`{{variable}}`, `{{#if}}`, `{{#each}}`). Transforms in `lib/prompt/composition/transforms/` handle: preamble, identity, voice, personality, pedagogy, memories, targets, trust, instructions, teaching-content, modules.

## Seed Data & Docker

Spec JSONs in `docs-archive/bdd-specs/` are **seed data only**. After seeding, the DB owns the data.

```bash
docker build .                    # runner — minimal server.js for production
docker build --target seed .      # seed — full codebase for DB initialization
docker build --target migrate .   # migrate — prisma migrate deploy only
```

The runner image CANNOT run seeds — use the seed target or SSH tunnel.

## Cloud Architecture (3 environments)

All public URLs route through a Cloudflare Tunnel to separate Cloud Run services:

| Env | Domain | Cloud Run Service | Seed Job | Migrate Job |
|-----|--------|-------------------|----------|-------------|
| DEV | `dev.humanfirstfoundation.com` | `hf-admin-dev` | `hf-seed-dev` | `hf-migrate-dev` |
| TEST | `test.humanfirstfoundation.com` | `hf-admin-test` | `hf-seed-test` | `hf-migrate-test` |
| PROD | `lab.humanfirstfoundation.com` | `hf-admin` | `hf-seed` | `hf-migrate` |

**Docker is NOT available locally or on the VM.** Use Cloud Build for all image builds.

## VM Deploy Commands (hf-dev VM only)

These commands update the hf-dev VM (localhost:3000 via SSH tunnel). They do NOT affect Cloud Run deployments. For Cloud Run, use `/deploy`.

- **`/vm-cp`** — Commit + push + pull on VM. Use for:
  - React components, pages, layouts (`app/`, `components/`)
  - API routes (`app/api/**/route.ts`)
  - CSS / Tailwind changes
  - Lib code (`lib/*.ts`) — config, utils, pipeline, prompt
  - Test files
- **`/vm-cpp`** — Commit + push + migrate + pull + restart. Use for:
  - Prisma schema or migration changes
  - `next.config.ts` (CSP, redirects, env exposure)
  - `middleware.ts`
  - New dependencies in `package.json`
  - Environment variable changes

**Always state which command is needed at the end of every change**, e.g. "Ready for `/vm-cp`" or "This needs `/vm-cpp` (migration)".

For Cloud Run deployment, use `/deploy` which asks which environment (dev/test/prod) and handles Cloud Build, seed jobs, and Cloudflare cache purge.

## Deployment

Production runs on **GCP Cloud Run** (europe-west2) with **Cloud SQL** (PostgreSQL 16). Full deployment procedures, data safety guarantees, rollback steps, and GCP resource details are in `docs/CLOUD-DEPLOYMENT.md`. Use `/deploy` for an interactive deployment menu or `/deploy-check` for pre-flight validation.
