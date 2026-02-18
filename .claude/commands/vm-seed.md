---
description: Run full seed on hf-dev VM
---

Run the full seed orchestrator on the hf-dev VM to populate all data.

**NOTE:** This seeds the VM's local database only. To seed Cloud Run databases (dev/test/prod), use `/deploy` with "Full deploy" option, which runs the appropriate Cloud Run seed job (`hf-seed-dev`, `hf-seed-test`, `hf-seed`).

**Seed Profiles:** `SEED_PROFILE` controls which steps run:
- `full` (default) — All data including educator demo, school data, e2e fixtures
- `test` — Core + demo domains + e2e fixtures (no school data)
- `core` — Specs, domains, demo domains, run configs only (production-clean)

## 1. Run full seed

```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "cd ~/HF/apps/admin && npx tsx prisma/seed-full.ts"
```

To use a specific profile:
```bash
gcloud compute ssh hf-dev --zone=europe-west2-a --tunnel-through-iap -- "cd ~/HF/apps/admin && SEED_PROFILE=core npx tsx prisma/seed-full.ts"
```

If the SSH command fails with exit code 255, wait 3 seconds and retry once.

## 2. Report results

Parse the output for the verification table (Specs, Parameters, Domains, Institutions, Users, Callers, Calls, CallScores, Memories, Goals, Run Configs) and report to the user.

If the seed fails, show the error and suggest checking the DB connection or running migrations first (`/vm-cpp`).
