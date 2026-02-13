# HF Admin Quick Start Guide

## System Overview

HF is an adaptive conversational AI system that:
1. Processes call transcripts through a spec-driven pipeline
2. Measures personality traits, learning styles, and conversation quality dynamically
3. Extracts and scores memories from conversations
4. Composes personalized prompts based on caller profiles
5. Tracks curriculum progression with mastery-gated advancement
6. Enforces content trust for regulated qualifications

---

## Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Environment variables configured in `.env.local`

### Required Environment Variables

```bash
# .env.local
DATABASE_URL="postgresql://hf_user:YOUR_PASSWORD@localhost:5432/hf?schema=public"
AUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
```

See [.env.example](.env.example) for all available options.

---

## Getting Started

### 1. Install Dependencies

```bash
cd apps/admin
npm install
```

### 2. Initialize Database

```bash
# Run migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Seed specs, contracts, and domains
npm run db:seed
npx tsx prisma/seed-domains.ts
```

### 3. Create First Admin User

```bash
npx tsx scripts/add-test-user.ts --email admin@example.com --role ADMIN
```

### 4. Start the Server

```bash
npm run dev
```

Server runs at [http://localhost:3000](http://localhost:3000). Sign in at `/login`.

### 5. Verify Setup

- **Callers**: [/x/callers](http://localhost:3000/x/callers)
- **Specs**: [/x/specs](http://localhost:3000/x/specs)
- **Domains**: [/x/domains](http://localhost:3000/x/domains)
- **Dictionary**: [/x/dictionary](http://localhost:3000/x/dictionary)

---

## Database Management

### Seed (from specs)

```bash
npm run db:seed              # Seed specs + contracts from docs-archive/bdd-specs/
npx tsx prisma/seed-domains.ts  # Create domains
```

### Reset & Reseed

```bash
npm run db:seed:reset        # Reset + reseed
```

### What Gets Seeded

| Seed | Purpose |
|------|---------|
| `seed-clean.ts` | Clean seed: specs, parameters, anchors, slugs, contracts |
| `seed-from-specs.ts` | Import BDD spec files into database |
| `seed-domains.ts` | Create domains (Tutor, Companion, etc.) |

---

## Key Concepts

### Source of Truth

**Database is the runtime source of truth.** BDD spec files in `docs-archive/bdd-specs/` are bootstrap material only. After import, all edits happen in the DB via UI or API. DB-only specs (no matching file) are normal.

### SpecRole Taxonomy

| Role | Purpose | Examples |
|------|---------|---------|
| `ORCHESTRATE` | Flow/sequence control | PIPELINE-001, INIT-001 |
| `EXTRACT` | Measurement and learning | PERS-001, VARK-001, MEM-001 |
| `SYNTHESISE` | Combine/transform data | COMP-001, REW-001, ADAPT-* |
| `CONSTRAIN` | Bounds and guards | GUARD-001 |
| `IDENTITY` | Agent personas | TUT-001, COACH-001 |
| `CONTENT` | Curriculum material | WNF-CONTENT-001 |
| `VOICE` | Voice guidance | VOICE-001 |

### Dynamic Parameter System

ALL parameter data flows dynamically: MEASURE specs → Pipeline → DB → UI. Adding new parameters = activate a spec (zero code changes).

### Prompt Composition

Primary method: `POST /api/callers/[callerId]/compose-prompt`
- Uses spec-driven `CompositionExecutor` with transform chains
- Loads `CallerPersonalityProfile.parameterValues` dynamically
- Injects memories, curriculum content, and trust context

---

## Testing

```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npm run test:integration # Integration tests (requires Postgres)
```

---

## Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Call Transcript │────▶│  Pipeline        │────▶│  Caller Profile  │
│                  │     │  EXTRACT stage   │     │  (parameterValues)│
└─────────────────┘     └──────────────────┘     └────────┬─────────┘
                                                          │
                        ┌──────────────────┐              │
                        │  COMPOSE stage   │◀─────────────┤
                        │  (spec-driven)   │              │
                        └────────┬─────────┘     ┌────────▼─────────┐
                                 │               │  Memory Extract  │
                        ┌────────▼─────────┐     │  (spec-driven)   │
                        │  Next Prompt     │     └──────────────────┘
                        │  (personalized)  │
                        └──────────────────┘
```

---

## File Structure

```
apps/admin/
├── prisma/
│   ├── schema.prisma         # Database schema (source of truth)
│   ├── seed-clean.ts         # Master seed
│   ├── seed-from-specs.ts    # Import BDD specs → DB
│   └── seed-domains.ts       # Create domains
├── lib/
│   ├── permissions.ts        # RBAC: requireAuth() + isAuthError()
│   ├── auth.ts               # NextAuth config (Credentials + Email)
│   ├── contracts/registry.ts # DB-backed contract registry
│   ├── pipeline/             # Pipeline orchestration
│   ├── prompt/composition/   # Spec-driven prompt composition
│   ├── content-trust/        # Content trust validation
│   └── domain/               # Domain readiness checks
├── app/api/                  # 184 API routes (176 protected, 8 public)
├── app/x/                    # Admin UI pages
├── tests/                    # Vitest tests
├── docs-archive/bdd-specs/   # Archived specs (bootstrap only)
└── docs/                     # Internal documentation
```

---

## Security

### RBAC

All API routes use `requireAuth()` from `lib/permissions.ts`:
- **VIEWER** — Read-only access
- **OPERATOR** — Read + write operational data
- **ADMIN** — Full system access

Coverage test (`tests/lib/route-auth-coverage.test.ts`) fails CI if any route is missing auth.

### Authentication

- **Admin users**: NextAuth with Credentials (email/password) or Email (magic link)
- **Field testers**: Invite system (admin creates invite → tester accepts → auto sign-in → sim access)
- **Session**: JWT cookie, 30-day expiry

See [docs/RBAC.md](docs/RBAC.md) for the full permission matrix.

---

## Quick Reference

```bash
# Development
npm run dev                    # Start dev server
npm test                       # Run tests
npx prisma studio              # Database GUI

# Database
npm run db:seed                # Seed specs + contracts
npx tsx prisma/seed-domains.ts # Create domains
npm run registry:generate      # DB → lib/registry/index.ts

# API (examples)
POST /api/callers/[id]/compose-prompt  # Generate personalized prompt
POST /api/calls/[id]/pipeline         # Run pipeline on a call
POST /api/x/seed-system               # Seed system via API
```

---

## Further Reading

- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture
- [docs/RBAC.md](docs/RBAC.md) — Role-based access control
- [docs/CONTENT-TRUST.md](docs/CONTENT-TRUST.md) — Content trust system
- [docs/DOMAIN-MANAGEMENT.md](docs/DOMAIN-MANAGEMENT.md) — Domain lifecycle
- [docs/CURRICULUM-PROGRESSION.md](docs/CURRICULUM-PROGRESSION.md) — Teaching flow
- [ANALYSIS_SPECS.md](ANALYSIS_SPECS.md) — Behavior specifications

---

**Version**: 0.6
**Last Updated**: 2026-02-12
