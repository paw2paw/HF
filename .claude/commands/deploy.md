---
description: Deploy to Cloud Run — environment-aware (dev, test, prod)
---

Interactive deployment guide for GCP Cloud Run. Supports 3 environments.

## CRITICAL: Environment Selection

**ALWAYS ask which environment FIRST.** Never assume. Use AskUserQuestion:

**Question:** "Which environment are you deploying to?"
**Header:** "Environment"
**multiSelect:** false

Options:
1. **DEV (Recommended)** — dev.humanfirstfoundation.com — safe for testing
2. **TEST** — test.humanfirstfoundation.com — pre-production validation
3. **PROD** — lab.humanfirstfoundation.com — live production

## Environment Map

| Env | Domain | Service | Seed Job | Migrate Job | DB Secret |
|-----|--------|---------|----------|-------------|-----------|
| DEV | dev.humanfirstfoundation.com | `hf-admin-dev` | `hf-seed-dev` | `hf-migrate-dev` | `DATABASE_URL_DEV` |
| TEST | test.humanfirstfoundation.com | `hf-admin-test` | `hf-seed-test` | `hf-migrate-test` | `DATABASE_URL_TEST` |
| PROD | lab.humanfirstfoundation.com | `hf-admin` | `hf-seed` | `hf-migrate` | `DATABASE_URL` |

All environments:
- **GCP Project**: `hf-admin-prod`
- **Region**: `europe-west2`
- **Artifact Registry**: `europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/`

After environment selection, ask the deploy action:

**Question:** "What deploy action do you need?"
**Header:** "Deploy"
**multiSelect:** false

Options:
1. **Pre-flight check** — Build, env vars, schema, Docker, auth coverage — verify readiness
2. **Quick deploy** — Code-only change, no schema or spec changes
3. **Full deploy** — Schema + specs + code (migrate → seed → deploy)
4. **Rollback** — Revert to a previous Cloud Run revision

Based on the user's choice, walk them through the exact commands step by step. Always confirm before executing any command.

**Note:** If the user picks "Quick deploy" or "Full deploy", automatically run smoke tests after. "Check status" is still available via "Other".

## IMPORTANT: No local Docker

Docker is NOT available locally or on the VM. ALL image builds MUST use **Cloud Build**:

```bash
cd apps/admin
gcloud builds submit --config <config-file> --project hf-admin-prod --region europe-west2 .
```

Always use `--no-cache` in Docker build args to avoid stale layer issues.

## Pre-flight Check Steps (option 1)

### 1. Build
```bash
cd apps/admin && npm run build
```
Report: PASS or list of build errors.

### 2. Prisma Schema
```bash
cd apps/admin && npx prisma validate
```
Report: PASS or validation errors.

### 3. Migration Status
```bash
cd apps/admin && npx prisma migrate status
```
Report: any pending migrations.

### 4. Seed Scripts
Verify seed files exist: `prisma/seed-full.ts` (orchestrator), `prisma/seed-clean.ts`.

### 5. Docker
Check Dockerfile exists and has the 3 targets: `runner`, `seed`, `migrate`.

### 6. Auth Coverage
```bash
cd apps/admin && npm run test -- tests/lib/route-auth-coverage.test.ts
```
All routes must be protected before deploying.

Report: `Deploy Check: READY (6/6)` or list blockers with fix instructions.

## Quick Deploy Steps (option 2)

Use `$SERVICE` from the environment map (e.g. `hf-admin-dev` for DEV).

### 1. Version bump + commit + push
```bash
cd apps/admin && npx tsx scripts/bump-version.ts
```
Stage and commit the version bump, then push.

### 2. Build runner image via Cloud Build

Write a temp cloudbuild config, then submit:

```bash
cat > /tmp/cloudbuild-runner.yaml <<'EOF'
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '--no-cache', '--target', 'runner', '-t', 'europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/hf-admin:latest', '-f', 'Dockerfile', '.']
images:
  - 'europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/hf-admin:latest'
EOF

cd apps/admin
gcloud builds submit --config /tmp/cloudbuild-runner.yaml --project hf-admin-prod --region europe-west2 .
```

### 3. Deploy to target environment
```bash
gcloud run deploy $SERVICE \
  --image=europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/hf-admin:latest \
  --region=europe-west2 --project=hf-admin-prod
```

## Full Deploy Steps (option 3)

### With Migrations

Build + push migrate image via Cloud Build:
```bash
cat > /tmp/cloudbuild-migrate.yaml <<'EOF'
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '--no-cache', '--target', 'migrate', '-t', 'europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/hf-migrate:latest', '-f', 'Dockerfile', '.']
images:
  - 'europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/hf-migrate:latest'
EOF

cd apps/admin
gcloud builds submit --config /tmp/cloudbuild-migrate.yaml --project hf-admin-prod --region europe-west2 .
```

Run the environment-specific migrate job:
```bash
gcloud run jobs execute $MIGRATE_JOB --region=europe-west2 --project=hf-admin-prod --wait
```

### With New Specs (seed)

Build + push seed image via Cloud Build:
```bash
cat > /tmp/cloudbuild-seed.yaml <<'EOF'
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '--no-cache', '--target', 'seed', '-t', 'europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/hf-seed:latest', '-f', 'Dockerfile', '.']
images:
  - 'europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/hf-seed:latest'
EOF

cd apps/admin
gcloud builds submit --config /tmp/cloudbuild-seed.yaml --project hf-admin-prod --region europe-west2 .
```

Run the environment-specific seed job:
```bash
gcloud run jobs execute $SEED_JOB --region=europe-west2 --project=hf-admin-prod --wait
```

### Then deploy runner (same as Quick Deploy steps 2-3)

## Rollback Steps (option 4)

```bash
gcloud run revisions list --service=$SERVICE --region=europe-west2 --project=hf-admin-prod
# Then ask user which revision to roll back to
gcloud run services update-traffic $SERVICE \
  --to-revisions=REVISION_NAME=100 \
  --region=europe-west2 --project=hf-admin-prod
```

## Smoke Test Steps (auto after deploy)

Use the **direct Cloud Run URL** (bypasses Cloudflare):

| Env | Direct URL |
|-----|-----------|
| DEV | `https://hf-admin-dev-311250123759.europe-west2.run.app` |
| TEST | `https://hf-admin-test-311250123759.europe-west2.run.app` |
| PROD | `https://hf-admin-311250123759.europe-west2.run.app` |

```bash
APP_URL="<direct URL from table above>"
curl -f "$APP_URL/api/health"
curl -f "$APP_URL/api/ready"
curl -f "$APP_URL/api/system/readiness"
```

## Cloudflare Cache Purge (auto after deploy)

After every successful deploy, purge the Cloudflare cache so users see the new version immediately:

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/a75655f1818c73eaaecc232b1076dbf3/purge_cache" \
  -H "X-Auth-Email: paul@thewanders.com" \
  -H "X-Auth-Key: 1422f925b4284c70c43a15fca3e08d10fdc9b" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

## Check Status Steps (via "Other")

```bash
# All Cloud Run services
gcloud run services list --project=hf-admin-prod --region=europe-west2

# Specific service revisions
gcloud run revisions list --service=$SERVICE --region=europe-west2 --project=hf-admin-prod --limit=5

# Deploy drift — what's waiting to go out
git log --oneline deploy-latest..HEAD 2>/dev/null || echo "No deploy-latest tag found"
```

## Deploy Tagging

After every successful deploy, tag the commit:

```bash
# Move the rolling tag to current commit
git tag -f deploy-$ENV-latest   # e.g. deploy-dev-latest
git push origin deploy-$ENV-latest --force

# Also create a timestamped tag for history
git tag deploy-$ENV-$(date +%Y%m%d-%H%M%S)
git push origin deploy-$ENV-$(date +%Y%m%d-%H%M%S)
```

## Safety Rules

- ALWAYS ask which environment FIRST — never assume
- ALWAYS run `git pull origin main` FIRST before any deploy step
- ALWAYS check for uncommitted changes (`git status`) — warn if dirty
- ALWAYS confirm with the user before running any command
- ALWAYS use `--no-cache` in Cloud Build docker args
- ALWAYS purge Cloudflare cache after deploy
- NEVER run `prisma migrate reset` or `prisma db push --force-reset` against any environment
- After every deploy, run smoke tests automatically
- After every successful deploy, run deploy tagging
- If any step fails, stop and diagnose — don't continue
- For PROD deploys, add an extra confirmation: "You are deploying to PRODUCTION (lab.humanfirstfoundation.com). Are you sure?"
