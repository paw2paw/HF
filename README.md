# HF

HF is the working repo for the HumanFirst project — an adaptive conversational AI system that builds personality profiles, extracts memories, and composes personalized prompts based on call interactions.

## What this repo contains

All technical artefacts live here:
- Application code (`apps/admin/`)
- System architecture (`docs/`, `apps/admin/docs/`)
- Database schema (`apps/admin/prisma/schema.prisma`)
- BDD spec archive (`apps/admin/docs-archive/bdd-specs/`) — bootstrap material, not runtime
- Decisions (`docs/adr/`)

## Source of Truth

**The database is the runtime source of truth.** BDD spec files are bootstrap/import material — you run them once to seed the database, then the database is authoritative. Specs can be created and edited entirely via the UI.

## Quick links

- **Documentation Index**: [docs/INDEX.md](docs/INDEX.md)
- **Local Development**: [docs/DEV_ENV.md](docs/DEV_ENV.md)
- **Architecture**: [apps/admin/docs/ARCHITECTURE.md](apps/admin/docs/ARCHITECTURE.md)
- **Cloud Deployment**: [docs/CLOUD-DEPLOYMENT.md](docs/CLOUD-DEPLOYMENT.md)
- **Codebase Overview**: [docs/CODEBASE-OVERVIEW.md](docs/CODEBASE-OVERVIEW.md)
- **Quick Start**: [apps/admin/QUICKSTART.md](apps/admin/QUICKSTART.md)

---

## The HF Adaptive Loop

The system always flows like this:

```
Call → Transcript → Pipeline (EXTRACT → AGGREGATE → REWARD → ADAPT → SUPERVISE → COMPOSE) → Next Prompt
```

Every feature, service, and change must respect this loop.

---

## System Overview

### Core Concepts

1. **Parameters** — Dimensions to measure (e.g., Big Five personality, VARK learning styles)
2. **AnalysisSpecs** — HOW to measure each parameter (EXTRACT) or compose prompts (SYNTHESISE)
3. **Playbooks** — Collections of specs per domain, priority-ordered
4. **Domains** — Logical groupings (Tutor, Companion, Coach) with readiness checks
5. **Content Trust** — 6-level provenance taxonomy (L0 Unverified → L5 Regulatory Standard)

### SpecRole Taxonomy

- `ORCHESTRATE` — Flow/sequence control (PIPELINE-001, INIT-001)
- `EXTRACT` — Measurement and learning (PERS-001, VARK-001, MEM-001)
- `SYNTHESISE` — Combine/transform data (COMP-001, REW-001, ADAPT-*)
- `CONSTRAIN` — Bounds and guards (GUARD-001)
- `IDENTITY` — Agent personas (TUT-001, COACH-001)
- `CONTENT` — Curriculum material (WNF-CONTENT-001)
- `VOICE` — Voice guidance (VOICE-001)

### Security

- **RBAC**: ~315 API routes protected via `requireAuth()`, 12 intentionally public (incl. 4 VAPI webhook-secret routes)
- **8 roles**: SUPERADMIN (5) > ADMIN (4) > OPERATOR/EDUCATOR (3) > SUPER_TESTER (2) > TESTER/STUDENT/VIEWER (1) > DEMO (0)
- **Invite system**: Controlled onboarding with domain-locked invites
- **Coverage test**: CI fails if any new route is missing auth

---

## Repository Structure

```
apps/admin/           # Next.js 16 application (main app)
├── app/api/          # ~315 API routes
├── app/x/            # Admin UI pages
├── lib/              # Core business logic
├── prisma/           # Schema + seeds
├── tests/            # Vitest tests
└── docs-archive/     # BDD specs (bootstrap only)

docs/                 # Project-level documentation
scripts/              # Dev helpers
```

---

## Getting Started

```bash
cd apps/admin
npm install
npx prisma migrate deploy && npx prisma generate
npm run db:seed          # Seed specs + contracts
npm run dev              # http://localhost:3000
```

See [apps/admin/QUICKSTART.md](apps/admin/QUICKSTART.md) for full setup.

---

## Testing

```bash
npm test                 # Unit tests (Vitest)
npm run test:integration # Integration tests (requires Postgres)
npm run test:coverage    # Coverage report
```

### CI Pipeline

CI runs 4 jobs: **Lint & Type Check → Unit Tests → Integration Tests → Build Check**. All must pass for merge.

---

## Where collaboration happens

- **Git** is the single source of truth for specs, data models, tests, and code
- **Notion** is used for planning, status, meeting notes, and links

---

**Last Updated**: 2026-03-01
