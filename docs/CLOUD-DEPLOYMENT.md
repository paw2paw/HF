# Cloud Deployment: Data & Seeding Guide

**Last Updated**: 2026-02-12
**Status**: Pre-deployment (market test)

This document covers the data architecture, seed process, and exact steps needed to bootstrap a fresh cloud instance. Read this before deploying.

---

## Architecture: Database is the Runtime Source of Truth

```
docs-archive/bdd-specs/*.spec.json  ──seed──►  Database  ◄──runtime──  Application
     (bootstrap material)                    (source of truth)         (reads DB only)
```

- **51 spec files** define parameters, analysis specs, scoring anchors, prompt slugs
- **3 contract files** define data contracts (curriculum progress, learner profile, content trust)
- After seeding, the application reads ONLY from the database — never from disk at runtime
- The `docs-archive/bdd-specs/` folder is NOT needed on the production server after initial seed
- All spec edits happen in DB via the admin UI or API

---

## What Gets Seeded

| Step | Script | Creates | Required? |
|------|--------|---------|-----------|
| 1 | `prisma migrate deploy` | Database tables (23 migrations) | YES |
| 2 | `seed-from-specs.ts` | Contracts → SystemSettings, Specs → Parameters + AnalysisSpecs + Anchors + PromptSlugs + BDDFeatureSets | YES |
| 3 | `seed-domains.ts` | 4 domains (Tutor, Support, Sales, Wellness) | YES |
| 4 | `seed-clean.ts` (transcripts) | Callers + Calls from `transcripts/` dir | NO (optional) |

### What seed-from-specs creates (Step 2)

From 51 `.spec.json` files:
- **Parameters** (~200+) — measurement dimensions (Big Five, VARK, style, supervision scores)
- **AnalysisSpecs** (~51) — the spec definitions with configs, triggers, actions
- **ScoringAnchors** — per-parameter scoring rubrics
- **PromptSlugs** — named prompt templates for composition
- **BDDFeatureSets** — the raw spec JSON stored for reference

From 3 `.contract.json` files:
- **SystemSettings** (key: `contract:CURRICULUM_PROGRESS_V1`) — curriculum data contract
- **SystemSettings** (key: `contract:LEARNER_PROFILE_V1`) — learner profile data contract
- **SystemSettings** (key: `contract:CONTENT_TRUST_V1`) — content trust data contract

### What seed-domains creates (Step 3)

| Domain | Slug | Default? |
|--------|------|----------|
| Tutor | `tutor` | Yes |
| Support | `support` | No |
| Sales | `sales` | No |
| Wellness | `wellness` | No |

---

## Minimum Viable Seed Sequence

```bash
# 1. Apply schema migrations
npx prisma migrate deploy

# 2. Seed specs + contracts (the big one)
npx tsx prisma/seed-clean.ts

# 3. Seed domains
npx tsx prisma/seed-domains.ts
```

That's it. Three commands. After this, the system is fully functional.

---

## Environment Variables

### Required (system will not start without these)

| Variable | Example | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/hf?schema=public` | PostgreSQL connection string |
| `HF_SUPERADMIN_TOKEN` | `openssl rand -hex 32` | Admin API access token |

### Required for AI features

| Variable | Example | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | `sk-...` | OpenAI API key (embeddings + completions) |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Anthropic API key (optional, for Claude) |

### Canonical Spec Slugs (all have sensible defaults)

These are env-overridable but you should never need to change them unless running multiple instances with different spec sets.

| Variable | Default | Description |
|----------|---------|-------------|
| `ONBOARDING_SPEC_SLUG` | `INIT-001` | Onboarding spec (personas, welcome flow) |
| `PIPELINE_SPEC_SLUG` | `PIPELINE-001` | Pipeline stage configuration |
| `PIPELINE_FALLBACK_SPEC_SLUG` | `GUARD-001` | Legacy pipeline fallback |
| `COMPOSE_SPEC_SLUG` | `system-compose-next-prompt` | Prompt composition spec |
| `VOICE_SPEC_SLUG_PATTERN` | `voice` | Voice/identity spec pattern match |
| `ONBOARDING_SLUG_PREFIX` | `init.` | Persona prompt slug prefix |

### Application

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Public-facing URL |
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment (`production` on cloud) |
| `HF_OPS_ENABLED` | `false` | Enable filesystem operations |
| `HF_KB_PATH` | `../../knowledge` | Knowledge base directory |

### AI Model Overrides (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_MODEL_ID` | `gpt-4o` | OpenAI model |
| `CLAUDE_MODEL_ID` | `claude-sonnet-4-20250514` | Claude model |
| `AI_DEFAULT_MAX_TOKENS` | `1024` | Default max tokens |
| `AI_DEFAULT_TEMPERATURE` | `0.7` | Default temperature |

---

## Docker Image: What's Included vs What's Not

The production Docker image (`Dockerfile`) produces a minimal Next.js standalone build.

### Included in the image

- `server.js` — compiled Next.js server
- `.next/static/` — static assets
- `public/` — public assets
- `prisma/schema.prisma` + `prisma/migrations/` — for `migrate deploy`

### NOT included in the image

- `docs-archive/bdd-specs/` — spec files (needed for seeding)
- `prisma/seed-from-specs.ts`, `prisma/seed-clean.ts`, `prisma/seed-domains.ts` — seed scripts
- `scripts/` — utility scripts
- `node_modules/` (full) — only standalone deps are included
- `tsx` — TypeScript executor (dev dependency)

### Consequence

**You cannot run `npm run db:seed` inside the production container.** Seeding must happen from a separate context that has access to the full codebase and dev dependencies.

---

## Cloud Seeding Options

### Option A: Seed from local machine (simplest for market test)

Connect your local machine to the remote database and run seeds locally.

```bash
# 1. SSH tunnel to remote PostgreSQL
ssh -L 5433:localhost:5432 hf@your-server.com

# 2. In another terminal, point to the tunnel
cd apps/admin
DATABASE_URL="postgresql://hf_user:PASSWORD@localhost:5433/hf?schema=public" \
  npx prisma migrate deploy

DATABASE_URL="postgresql://hf_user:PASSWORD@localhost:5433/hf?schema=public" \
  npx tsx prisma/seed-clean.ts

DATABASE_URL="postgresql://hf_user:PASSWORD@localhost:5433/hf?schema=public" \
  npx tsx prisma/seed-domains.ts
```

**Pros**: No Docker changes needed, works today
**Cons**: Requires SSH access and local dev environment

### Option B: Seed container in docker-compose (recommended for CI/CD)

Add a one-shot seed service to `docker-compose.yml` that uses the full builder image:

```yaml
services:
  seed:
    build:
      context: .
      dockerfile: Dockerfile.seed
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public
    depends_on:
      postgres:
        condition: service_healthy
    profiles:
      - seed  # only runs when explicitly called
```

Run with: `docker compose --profile seed run --rm seed`

### Option C: Multi-stage Dockerfile with seed target

Add a seed target to the existing Dockerfile (see "Dockerfile Changes" below).

---

## Verification Checklist

After seeding, verify the database is properly populated:

```bash
# Connect to the database and check counts
docker compose exec postgres psql -U hf_user hf -c "
  SELECT 'AnalysisSpec' as table_name, COUNT(*) as count FROM \"AnalysisSpec\"
  UNION ALL
  SELECT 'Parameter', COUNT(*) FROM \"Parameter\"
  UNION ALL
  SELECT 'PromptSlug', COUNT(*) FROM \"PromptSlug\"
  UNION ALL
  SELECT 'Domain', COUNT(*) FROM \"Domain\"
  UNION ALL
  SELECT 'SystemSetting', COUNT(*) FROM \"SystemSetting\" WHERE key LIKE 'contract:%'
  ORDER BY table_name;
"
```

Expected minimums:

| Table | Expected Count | What it means |
|-------|---------------|---------------|
| AnalysisSpec | ~51 | One per spec file |
| Parameter | ~200+ | All measurement parameters |
| PromptSlug | 30+ | Named prompt templates |
| Domain | 4 | Tutor, Support, Sales, Wellness |
| SystemSetting (contracts) | 3 | Curriculum, Learner Profile, Content Trust |

### API Health Check

```bash
# Basic health
curl https://your-server.com/api/health

# Onboarding spec loaded
curl https://your-server.com/api/onboarding
# Should return: { "ok": true, "source": "database", ... }

# Parameters loaded
curl https://your-server.com/api/parameters/display-config
# Should return grouped parameters
```

---

## Files That Matter

### Seed scripts (run once, then DB is authoritative)

| File | Purpose | When to run |
|------|---------|-------------|
| `prisma/seed-from-specs.ts` | Engine: reads spec files, creates all derived records | Called by seed-clean.ts |
| `prisma/seed-clean.ts` | Entry point: calls seedFromSpecs() + optional transcripts | `npm run db:seed` |
| `prisma/seed-domains.ts` | Creates base domains | After seed-clean.ts |
| `prisma/reset.ts` | Wipes all data (preserves schema) | Only for full reset |

### Spec files (bootstrap material, not needed at runtime)

| Path | Count | Content |
|------|-------|---------|
| `docs-archive/bdd-specs/*.spec.json` | 51 | BDD spec definitions |
| `docs-archive/bdd-specs/contracts/*.contract.json` | 3 | Data contracts |

### Config (runtime)

| File | Purpose |
|------|---------|
| `lib/config.ts` | Centralized env var access with defaults |
| `.env.example` | Template for all environment variables |

### Admin UI tools (alternative to CLI seeding)

| Route | Purpose |
|-------|---------|
| `/x/admin/spec-sync` | Import/sync specs from files to DB |
| `/api/x/seed-system` | Full system bootstrap via API |
| `/api/x/seed-domains` | Create domains via API |

---

## Deployment Sequence (Market Test)

```
1. Provision server + PostgreSQL
2. Configure .env (see Environment Variables above)
3. Deploy Docker image (docker compose up -d)
4. Run migrations (prisma migrate deploy)
5. Seed from local machine via SSH tunnel (Option A)
6. Verify (check counts + API health)
7. Create admin user
8. Ready for callers
```

---

## What Happens If Seeding Fails

| Symptom | Cause | Fix |
|---------|-------|-----|
| API returns 404 for `/api/onboarding` | INIT-001 spec not seeded | Run seed-clean.ts or import via `/x/admin/spec-sync` |
| Pipeline fails with "spec not found" | PIPELINE-001 not in DB | Run seed-clean.ts |
| "Contract not loaded" errors | Contracts not in SystemSettings | Run seed-clean.ts (seeds contracts first) |
| No parameters in data dictionary | Parameters not created from specs | Run seed-clean.ts |
| "No domains found" | Domains not seeded | Run seed-domains.ts |

---

## Post-Seed: How Data Evolves

After the initial seed, new data enters the system through:

1. **Callers** — created when phone calls come in via VAPI integration
2. **Calls** — created per conversation, with transcripts
3. **Pipeline runs** — EXTRACT/AGGREGATE/REWARD/ADAPT/COMPOSE stages process calls
4. **Personality profiles** — built from pipeline measurements over time
5. **Memories** — extracted from call transcripts
6. **Spec edits** — admins modify specs via UI (changes go to DB, not files)

No re-seeding is needed after initial setup unless you want to add new spec files.
