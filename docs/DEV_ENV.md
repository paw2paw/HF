# HF - Development Environment

<!-- @doc-source file:apps/admin/.env.example,apps/admin/package.json,docker-compose.yml -->
<!-- @doc-source file:apps/admin/prisma/schema.prisma -->
<!-- @doc-source env:DATABASE_URL,OPENAI_API_KEY,ANTHROPIC_API_KEY,HF_SUPERADMIN_TOKEN -->

This document is the single source of truth for running HF locally and in CI.

---

## Prerequisites

- **Node.js** 20+ (LTS)
- **Docker** (via Colima or Docker Desktop)
- **PostgreSQL** 15+ (via Docker)

---

## Quick Start

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd HF

# 2. Install dependencies
npm ci

# 3. Copy and configure environment
cp apps/admin/.env.example apps/admin/.env.local
# Edit .env.local with your values (see Environment Variables below)

# 4. Start database
docker compose up -d postgres

# 5. Run migrations and seed
cd apps/admin
npx prisma migrate deploy
npx prisma generate
npm run db:seed:all

# 6. Start development server
npm run dev
```

Server runs at [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

### Required

```bash
DATABASE_URL="postgresql://hf_user:hf_password@localhost:5432/hf?schema=public"
AUTH_SECRET="<generate-with-openssl-rand-base64-32>"
NEXTAUTH_URL="http://localhost:3000"
HF_SUPERADMIN_TOKEN="<64-char-hex-token>"
```

### AI Providers (at least one required for analysis)

```bash
OPENAI_API_KEY="sk-..."
# Or alternate key:
OPENAI_HF_MVP_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
```

### Optional

```bash
HF_KB_PATH="../../knowledge"       # Knowledge base location
HF_OPS_ENABLED="true"              # Enable filesystem operations
NEXT_PUBLIC_APP_URL="http://localhost:3000"
PORT="3000"
```

See [.env.example](../apps/admin/.env.example) for the complete list.

---

## Runtime Stack

- **Node.js** - Runs locally
- **Docker** (via Colima or Docker Desktop)
- **PostgreSQL 15** - Docker container
- **Unit tests** - Vitest, no infrastructure required
- **Integration tests** - Require PostgreSQL

---

## PostgreSQL (Docker)

Defined in `docker-compose.yml`.

| Setting | Value |
|---------|-------|
| Image | `postgres:15` |
| Port | `5432` |
| Database | `hf` |
| User | `hf_user` |
| Password | `hf_password` |
| Data | `.runtime/postgres` |

```bash
# Start database
docker compose up -d postgres

# Stop database
docker compose down

# Connect manually
docker exec -it hf_postgres psql -U hf_user -d hf
```

---

## Daily Development Workflow

```bash
# 1. Install dependencies (first time or after pull)
npm ci

# 2. Start database (if not running)
docker compose up -d postgres

# 3. Start dev server
cd apps/admin
npm run dev

# 4. Run tests (no infrastructure needed)
npm test
```

---

## Development Scripts

| Command | What It Does |
|---------|--------------|
| `npm run dev` | Start dev server |
| `npm run devX` | Hard restart (kill server + clear cache) |
| `npm run devD` | Data reset only (keep server running) |
| `npm run devZZZ` | Nuclear reset (DB + server + data) |
| `npm run dev:share` | Dev server + ngrok tunnel (public URL) |
| `npm test` | Run unit tests |
| `npm run test:watch` | Tests in watch mode |
| `npm run prisma:studio` | Database GUI at localhost:5555 |

---

## CI Expectations

CI must be able to:
- Run `npm ci`
- Run `npm test` without Docker
- Run BDD tests without Docker
- Optionally start Postgres via `docker compose up -d`

BDD is the contract layer; infrastructure is optional.

---

## Reset / Recovery

### Reset database data

```bash
cd apps/admin
npm run db:reset -- --confirm
npm run db:seed:all
```

### Reset Postgres completely

```bash
docker compose down
rm -rf .runtime/postgres
docker compose up -d postgres
cd apps/admin
npx prisma migrate deploy
npm run db:seed:all
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| BDD fails | Docker is irrelevant - fix TypeScript or step definitions |
| Port 3000 in use | `lsof -ti:3000 \| xargs kill -9` |
| Prisma client stale | `npx prisma generate` |
| Migration drift | `npx prisma migrate deploy` |
| Need fresh start | `npm run devZZZ` |

---

## Source of Truth

- BDD features: `bdd/features/`
- Database schema: `apps/admin/prisma/schema.prisma`
- Infrastructure: `docker-compose.yml`
- This file: `docs/DEV_ENV.md`

---

**Last Updated**: 2026-02-11
