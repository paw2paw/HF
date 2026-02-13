# HF Codebase Overview

<!-- @doc-source file:apps/admin/app/api,apps/admin/lib,apps/admin/prisma/schema.prisma -->
<!-- @doc-source file:apps/admin/Dockerfile,docker-compose.yml -->
<!-- @doc-source config:database.url,superadminToken,ai.openai,ai.claude -->

Quick reference for understanding the HF codebase structure.

**For**: Developers, DevOps, AI assistants helping with deployment

---

## Repository Structure

```
HF/
├── apps/
│   └── admin/                  # Main Next.js application
│       ├── app/                # Next.js App Router
│       │   ├── api/            # API routes
│       │   ├── x/              # Admin UI pages (/x/* URLs)
│       │   └── _archived/      # Legacy pages
│       ├── components/         # React components
│       │   ├── callers/        # Caller-specific components
│       │   ├── shared/         # Shared/reusable components
│       │   └── ...
│       ├── lib/                # Core business logic
│       │   ├── ai/             # AI integration (OpenAI, Anthropic)
│       │   ├── prompt/         # Prompt composition system
│       │   ├── pipeline/       # Analysis pipeline
│       │   └── registry/       # Spec registry (auto-generated)
│       ├── prisma/             # Database layer
│       │   ├── schema.prisma   # Database schema (source of truth)
│       │   ├── migrations/     # Version-controlled migrations
│       │   └── seed.ts         # Database seeding
│       ├── scripts/            # Utility scripts
│       │   ├── bootstrap-admin.ts
│       │   ├── generate-registry.ts
│       │   └── ...
│       ├── docs/               # App-specific documentation
│       ├── Dockerfile          # Production container build
│       ├── package.json        # Dependencies and scripts
│       └── .env.example        # Environment template
│
├── bdd/                        # BDD test specifications
│   ├── features/               # Gherkin feature files
│   └── steps/                  # Step definitions
│
├── knowledge/                  # Knowledge base files
│   ├── prompts/                # Prompt templates
│   └── ...
│
├── docs/                       # Project documentation
│   ├── INDEX.md                # Documentation index
│   ├── DEPLOYMENT-ENVIRONMENTS.md  # Deployment guide
│   ├── DEPLOYMENT-CHECKLIST.md     # Step-by-step checklist
│   ├── DEV_ENV.md              # Local development
│   ├── 01-system-description.md
│   ├── 02-business-context.md
│   ├── 03-architecture/
│   ├── 04-behaviour/
│   ├── 05-data/
│   └── adr/                    # Architecture Decision Records
│
├── docker-compose.yml          # Local dev (postgres only)
├── package.json                # Root package (BDD tests)
└── README.md                   # Project overview
```

---

## Key Application Files

### Configuration

| File | Purpose |
|------|---------|
| `apps/admin/.env.example` | Environment variable template |
| `apps/admin/prisma/schema.prisma` | Database schema definition |
| `apps/admin/Dockerfile` | Production container image build |
| `docker-compose.yml` | Local PostgreSQL setup |

### Entry Points

| Path | What It Does |
|------|--------------|
| `apps/admin/app/layout.tsx` | Root layout, providers |
| `apps/admin/app/page.tsx` | Home page redirect |
| `apps/admin/app/api/` | API endpoints (163 route files) |
| `apps/admin/app/x/` | Admin UI pages (32 page directories) |

### Core Business Logic

| Directory | Responsibility |
|-----------|----------------|
| `lib/ai/` | AI provider integration (OpenAI, Anthropic) |
| `lib/pipeline/` | Analysis pipeline (MEASURE, LEARN, ADAPT, etc.) |
| `lib/prompt/` | Prompt composition from specs |
| `lib/registry/` | Auto-generated spec registry |

### Database Layer

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database schema (Prisma ORM) |
| `prisma/migrations/` | Version-controlled schema changes |
| `prisma/seed.ts` | Initial data seeding |
| `prisma/seed-clean.ts` | Clean seed (specs only) |

---

## Critical API Endpoints

### Health & Status

```
GET  /api/health              # Application health check
GET  /api/health/db           # Database connection check
```

### Pipeline

```
POST /api/calls/[callId]/pipeline
     Body: { callerId, mode: "prep"|"prompt", engine: "mock"|"claude"|"openai" }
     → Runs full analysis pipeline
```

### Callers

```
GET  /api/callers                    # List callers
GET  /api/callers/[id]               # Get caller details
POST /api/callers/[id]/compose-prompt # Compose prompt for caller
```

### Specs & Registry

```
GET  /api/specs                      # List all specs
GET  /api/specs/[id]                 # Get spec details
POST /api/specs/[id]/activate        # Activate/deactivate spec
GET  /api/parameters/display-config  # Parameter display metadata
```

### AI Assistant

```
POST /api/ai/assistant/search        # Search using AI
POST /api/ai/assistant/chat          # AI chat endpoint
```

---

## Database Schema Highlights

### Key Tables

**Caller Management**:
- `Caller` - Individual callers (users)
- `CallerPersonality` - Aggregated personality scores (Big Five)
- `CallerPersonalityProfile` - Dynamic parameter scores (all parameters)
- `CallerMemory` - Extracted memories (facts, preferences, etc.)

**Analysis System**:
- `AnalysisSpec` - Analysis specifications (MEASURE, LEARN, etc.)
- `Parameter` - Measurable dimensions
- `CallScore` - Per-call parameter measurements
- `BehaviorMeasurement` - Agent behavior measurements

**Playbooks**:
- `Domain` - Caller categories (tutor, support, etc.)
- `Playbook` - Collections of specs per domain
- `PlaybookItem` - Specs included in a playbook

**Prompt System**:
- `PromptSlug` - Personality-driven prompt variations
- `PromptTemplate` - Reusable prompt templates

### Schema File

```prisma
// apps/admin/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// See full schema for all models
```

---

## Environment Variables

### Required

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public"
HF_SUPERADMIN_TOKEN="64-char-hex-token"
OPENAI_API_KEY="sk-..."
```

### Important Optional

```bash
OPENAI_HF_MVP_KEY="sk-..."               # Alternate OpenAI key (preferred over OPENAI_API_KEY)
ANTHROPIC_API_KEY="sk-ant-..."           # Claude API access
NEXT_PUBLIC_APP_URL="https://..."        # App base URL
HF_KB_PATH="../../knowledge"             # Knowledge base location
HF_TRANSCRIPTS_PATH=""                   # Transcript directory override (optional)
HF_OPS_ENABLED="true"                    # Enable filesystem operations
PORT="3000"                              # Server port (default: 3000)
```

See [.env.example](../apps/admin/.env.example) for complete list.

---

## Build & Deployment

### Development (Local)

```bash
# Start local database
cd ~/projects/HF
docker compose up -d postgres

# Run development server
cd apps/admin
npm install
npm run dev  # Starts on http://localhost:3000
```

### Production Build

```bash
# Build Docker image
cd apps/admin
docker build -t hf-admin:latest .

# Or using docker-compose
docker compose build app
```

### Database Migrations

```bash
# Development (creates migration)
npx prisma migrate dev --name description

# Production (applies pending migrations)
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

---

## Scripts Reference

### In `apps/admin/package.json`

```json
{
  "scripts": {
    "dev": "next dev",                          // Local development
    "build": "next build",                      // Production build
    "start": "next start",                      // Start production server

    "prisma:dev": "npx prisma migrate dev",     // Create migration
    "prisma:generate": "npx prisma generate",   // Generate client
    "prisma:studio": "npx prisma studio",       // Database GUI

    "db:seed": "tsx prisma/seed-clean.ts",      // Seed database
    "db:reset": "tsx prisma/reset.ts",          // Reset database

    "registry:generate": "tsx scripts/generate-registry.ts",  // Generate spec registry
    "registry:validate": "tsx scripts/validate-registry.ts",  // Validate registry

    "bootstrap-admin": "tsx scripts/bootstrap-admin.ts",  // Create admin user

    "test": "vitest run",                       // Run tests
    "test:e2e": "playwright test"               // E2E tests
  }
}
```

---

## Data Flow Overview

### Pipeline Execution

```
1. Call arrives → Call record created
2. POST /api/calls/[callId]/pipeline
3. Pipeline loads caller's domain → playbook
4. Runs specs from playbook:
   - MEASURE specs → CallScore
   - LEARN specs → CallerMemory
   - ADAPT specs → CallTarget
   - SUPERVISE specs → BehaviorMeasurement
5. Aggregates results → CallerPersonality, CallerTarget
6. Composes prompt for next call
```

### Prompt Composition

```
1. Load caller → domain → playbook
2. Fetch CallerPersonalityProfile.parameterValues
3. Load PromptSlugs for each section
4. Select slug variants based on personality scores
5. Compile final prompt using SectionDataLoader
6. Return composed prompt
```

### Spec Activation

```
1. Upload BDD spec file → BDDUpload
2. Validate with AI → extract structure
3. Compile to BDDFeatureSet
4. Activate → creates:
   - Parameter records
   - AnalysisSpec records
   - AnalysisTrigger records
   - PromptSlug records
5. Spec becomes active in pipeline
```

---

## Important Design Patterns

### 1. Dynamic Parameter System

- NO hardcoded parameter lists
- ALL parameters from database
- UI adapts to active specs automatically

### 2. Spec-Driven Architecture

- Behavior defined in specs (JSON files)
- Specs activate → create database records
- System behavior = active specs

### 3. Playbook System

- Domain → Playbook (PUBLISHED) → PlaybookItems → Specs
- Caller inherits playbook from domain
- Pipeline runs playbook's specs

### 4. BDD-First

- Behavior defined in `bdd/features/`
- Tests run without infrastructure
- Pure services (no DB, no HTTP in core logic)

---

## Technology Stack

### Runtime

- **Node.js**: 20+ (LTS)
- **Next.js**: 16.1.0 (App Router)
- **React**: 19.2.3
- **TypeScript**: 5+

### Database

- **PostgreSQL**: 15+
- **Prisma**: 6.19.1+ (ORM)

### AI Providers

- **OpenAI**: GPT-4, embeddings
- **Anthropic**: Claude 4 (optional)

### Testing

- **Cucumber.js**: BDD tests
- **Vitest**: Unit tests
- **Playwright**: E2E tests

### Deployment

- **Docker**: Containerization
- **Docker Compose**: Multi-service orchestration

---

## Common Tasks Reference

### Add New Parameter

1. Create spec file in `docs-archive/bdd-specs/*.spec.json`
2. Upload via `/x/import` or run `npm run db:seed`
3. Activate spec via UI or API
4. Parameter appears automatically in UI

### Add New API Endpoint

1. Create a `route.ts` file under the `app/api/` directory for your route
2. Export GET, POST, etc. handlers
3. Add `@api` JSDoc annotation (required by CI)
4. Use Prisma for database access
5. Return `Response` objects

### Modify Database Schema

1. Edit `apps/admin/prisma/schema.prisma`
2. Run `npx prisma migrate dev --name change_description`
3. Commit migration files
4. Deploy applies via `npx prisma migrate deploy`

### Create New UI Page

1. Create a `page.tsx` file under the `app/x/` directory for your page name
2. Access at `/x/your-page-name`
3. Use shared components from `components/shared/`

---

## Troubleshooting Reference

### Build Fails

```bash
# Clear Next.js cache
rm -rf apps/admin/.next

# Regenerate Prisma client
cd apps/admin
npx prisma generate

# Rebuild
npm run build
```

### Database Issues

```bash
# Check connection
npx prisma db pull

# View migrations status
npx prisma migrate status

# Reset (DEV ONLY - destroys data)
npx prisma migrate reset
```

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

---

## Security Considerations

### Secrets Management

- Never commit `.env.local` or `.env`
- Use `.env.example` as template
- Rotate `HF_SUPERADMIN_TOKEN` periodically
- Use separate API keys per environment

### Database Access

- Production DB should NOT be exposed publicly
- Use connection pooling (managed DB services)
- Enable SSL for database connections

### API Authentication

- `/api/callers/route.ts` checks `HF_SUPERADMIN_TOKEN`
- Implement per-user auth for production

---

## Further Reading

- **Full Deployment Guide**: [DEPLOYMENT-ENVIRONMENTS.md](DEPLOYMENT-ENVIRONMENTS.md)
- **Step-by-Step Checklist**: [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md)
- **Local Development**: [DEV_ENV.md](DEV_ENV.md)
- **Architecture Details**: [apps/admin/docs/ARCHITECTURE.md](../apps/admin/docs/ARCHITECTURE.md)
- **AI System**: [apps/admin/docs/AI-ASSISTANT-SYSTEM.md](../apps/admin/docs/AI-ASSISTANT-SYSTEM.md)

---

**Last Updated**: 2026-02-11
**Maintained By**: Development Team
