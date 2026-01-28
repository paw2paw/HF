# Database changes (HF Admin)

This repo uses Prisma + migrations. The goal is: schema changes are versioned, reversible, and reproducible across dev machines.

## Prereqs
- Postgres running and reachable via `DATABASE_URL`
- `apps/admin` dependencies installed
- Prisma client generated

## Where things live
- Schema: `apps/admin/prisma/schema.prisma`
- Migrations: `apps/admin/prisma/migrations/*`
- Prisma client: generated into `apps/admin/node_modules/@prisma/client`

## Standard workflow (recommended)
From repo root:

1) Ensure DB is up
- Confirm `DATABASE_URL` is set for the running environment.
- If local: make sure Postgres is listening on the host/port in `DATABASE_URL`.

2) Edit schema
- Modify `apps/admin/prisma/schema.prisma`.

3) Create/apply a migration (dev)
From `apps/admin`:

```bash
cd apps/admin
npx prisma migrate dev --name <human_readable_name>