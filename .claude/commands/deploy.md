---
description: Deploy to production — guided menu for build, migrate, seed, and rollback
---

Interactive deployment guide for GCP Cloud Run.

Read `docs/CLOUD-DEPLOYMENT.md` for full context, then present this menu:

## Deployment Menu

Ask the user what they want to do:

1. **Quick deploy** — Code-only change, no schema or spec changes
2. **Deploy with migrations** — Schema changed, need to run migrations first
3. **Deploy with new specs** — Spec JSON files added/changed, need to re-seed
4. **Full deploy** — Schema + specs + code (migrate → seed → deploy)
5. **Rollback** — Revert to a previous Cloud Run revision
6. **Smoke test** — Verify the live instance is healthy
7. **Check status** — Show current Cloud Run revision and Cloud SQL status

Based on the user's choice, walk them through the exact commands step by step. Always confirm before executing any command.

## Reference

- **GCP Project**: `hf-admin-prod`
- **Region**: `europe-west2`
- **Artifact Registry**: `europe-west2-docker.pkg.dev/hf-admin-prod/hf-docker/`
- **Cloud Run service**: `hf-admin`
- **Cloud Run jobs**: `hf-migrate`, `hf-seed`
- **Dockerfile**: `apps/admin/Dockerfile` (targets: `runner`, `seed`, `migrate`)

## Quick Deploy Steps (option 1)

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

## Deploy with Migrations Steps (option 2)

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

## Deploy with New Specs Steps (option 3)

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

## Rollback Steps (option 5)

```bash
gcloud run revisions list --service=hf-admin --region=europe-west2
# Then ask user which revision to roll back to
gcloud run services update-traffic hf-admin \
  --to-revisions=REVISION_NAME=100 \
  --region=europe-west2
```

## Smoke Test Steps (option 6)

```bash
APP_URL="https://hf-admin-311250123759.europe-west2.run.app"
curl -f "$APP_URL/api/health"
curl -f "$APP_URL/api/ready"
curl -f "$APP_URL/api/system/readiness"
```

## Check Status Steps (option 7)

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
