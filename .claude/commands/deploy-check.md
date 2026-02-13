---
description: Pre-deployment checklist — build, env vars, schema, Docker
---

Pre-deployment checklist — verify everything needed for cloud deploy

Run through the deployment readiness checklist:

## 1. Build
```bash
cd apps/admin && npm run build
```
Report: PASS or list of build errors.

## 2. Required Environment Variables
Check that all variables referenced in `lib/config.ts` under `required()` are documented in `.env.example` (if it exists) or flag them:
- DATABASE_URL
- HF_SUPERADMIN_TOKEN

## 3. Prisma Schema
```bash
cd apps/admin && npx prisma validate
```
Report: PASS or validation errors.

## 4. Migration Status
```bash
cd apps/admin && npx prisma migrate status
```
Report: any pending migrations.

## 5. Seed Scripts
Verify seed files exist and are importable:
- `prisma/seed-clean.ts`
- `prisma/seed-domains.ts`

## 6. Docker
Check Dockerfile exists and has the 3 targets: `runner`, `seed`, `migrate`.
Read `docker-compose.yml` and verify service configuration.

## 7. Auth Coverage
```bash
cd apps/admin && npm run test -- tests/lib/route-auth-coverage.test.ts
```
All routes must be protected before deploying.

## Output
```
Deploy Check: ✓ READY (7/7)
```
or list blockers with fix instructions.
