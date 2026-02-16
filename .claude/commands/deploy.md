---
description: Deploy to production — guided menu for build, migrate, seed, and rollback
---

Interactive deployment guide for GCP Cloud Run.

Read `docs/CLOUD-DEPLOYMENT.md` for full context, then ask the user using AskUserQuestion:

**Question:** "What deploy action do you need?"
**Header:** "Deploy"
**multiSelect:** false

Options:
1. **Pre-flight check** — Build, env vars, schema, Docker, auth coverage — verify readiness
2. **Quick deploy** — Code-only change, no schema or spec changes
3. **Full deploy** — Schema + specs + code (migrate → seed → deploy)
4. **Rollback** — Revert to a previous Cloud Run revision

Based on the user's choice, walk them through the exact commands step by step. Always confirm before executing any command.

**Note:** If the user picks "Quick deploy" or "Full deploy", automatically run smoke tests after. If they pick something not listed (via "Other"), map it to the closest option or ask for clarification. "Check status" is still available via "Other" — show revision info and deploy drift.

## Reference

- **GCP Project**: `hf-admin-prod`
- **Region**: `europe-west2`
- **Artifact Registry**: `europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/`
- **Cloud Run service**: `hf-admin`
- **Cloud Run jobs**: `hf-migrate`, `hf-seed`
- **Dockerfile**: `apps/admin/Dockerfile` (targets: `runner`, `seed`, `migrate`)

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
Verify seed files exist: `prisma/seed-clean.ts`, `prisma/seed-domains.ts`.

### 5. Docker
Check Dockerfile exists and has the 3 targets: `runner`, `seed`, `migrate`.

### 6. Auth Coverage
```bash
cd apps/admin && npm run test -- tests/lib/route-auth-coverage.test.ts
```
All routes must be protected before deploying.

Report: `Deploy Check: READY (6/6)` or list blockers with fix instructions.

## Quick Deploy Steps (option 2)

```bash
cd apps/admin
docker build --platform linux/amd64 --target runner \
  -t europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/hf-admin:latest \
  -f Dockerfile .
docker push europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/hf-admin:latest
gcloud run deploy hf-admin \
  --image=europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/hf-admin:latest \
  --region=europe-west2
```

## Deploy with Migrations Steps (option 3 — part of Full deploy)

```bash
cd apps/admin
# Migrate image
docker build --platform linux/amd64 --target migrate \
  -t europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/hf-migrate:latest \
  -f Dockerfile .
docker push europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/hf-migrate:latest
gcloud run jobs execute hf-migrate --region=europe-west2 --wait

# Runner image
docker build --platform linux/amd64 --target runner \
  -t europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/hf-admin:latest \
  -f Dockerfile .
docker push europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/hf-admin:latest
gcloud run deploy hf-admin \
  --image=europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/hf-admin:latest \
  --region=europe-west2
```

## Deploy with New Specs Steps (option 3 — part of Full deploy)

```bash
cd apps/admin
# Seed image
docker build --platform linux/amd64 --target seed \
  -t europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/hf-seed:latest \
  -f Dockerfile .
docker push europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/hf-seed:latest
gcloud run jobs execute hf-seed --region=europe-west2 --wait

# Runner image
docker build --platform linux/amd64 --target runner \
  -t europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/hf-admin:latest \
  -f Dockerfile .
docker push europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/hf-admin:latest
gcloud run deploy hf-admin \
  --image=europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/hf-admin:latest \
  --region=europe-west2
```

## Rollback Steps (option 4)

```bash
gcloud run revisions list --service=hf-admin --region=europe-west2
# Then ask user which revision to roll back to
gcloud run services update-traffic hf-admin \
  --to-revisions=REVISION_NAME=100 \
  --region=europe-west2
```

## Smoke Test Steps (auto after deploy)

```bash
APP_URL="https://hf-admin-311250123759.europe-west2.run.app"
curl -f "$APP_URL/api/health"
curl -f "$APP_URL/api/ready"
curl -f "$APP_URL/api/system/readiness"
```

## Check Status Steps (via "Other")

```bash
# Cloud Run status
gcloud run services describe hf-admin --region=europe-west2 --format="value(status.traffic)"
gcloud run revisions list --service=hf-admin --region=europe-west2 --limit=5
gcloud sql instances describe hf-db --format="value(state,settings.tier,ipAddresses)"

# Deploy drift — what's waiting to go out
git log --oneline deploy-latest..HEAD 2>/dev/null || echo "No deploy-latest tag found — first deploy hasn't been tagged yet"
```

## Deploy Tagging

After every successful deploy (options 1-4), tag the commit so you can track what's live:

```bash
# Move the rolling tag to current commit
git tag -f deploy-latest
git push origin deploy-latest --force

# Also create a timestamped tag for history
git tag deploy-$(date +%Y%m%d-%H%M%S)
git push origin deploy-$(date +%Y%m%d-%H%M%S)
```

To see what's changed since the last deploy:

```bash
git log --oneline deploy-latest..HEAD
```

If there's no output, you're in sync with live. If there are commits listed, those are waiting to be deployed.

## Safety Rules

- ALWAYS run `git pull origin main` FIRST before any deploy step — this is automatic, no need to ask
- ALWAYS check for uncommitted changes (`git status`) before deploying — if dirty, WARN the user and ask them to commit or stash first. Do NOT proceed with a dirty working tree.
- ALWAYS confirm with the user before running any command
- NEVER run `prisma migrate reset` or `prisma db push --force-reset` against production
- After every deploy, run the smoke tests automatically
- After every successful deploy, run the deploy tagging step
- If any step fails, stop and diagnose — don't continue to the next step
