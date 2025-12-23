# HF – Development Environment

This document is the single source of truth for running HF locally and in CI.

---

cd ~/projects/HF
scripts/dev/bootstrap.sh



---


## Storage Layout (SSD-backed)

All heavy state lives on the external SSD `PAWSTAW`.

- **Repo (symlinked):**
  /Volumes/PAWSTAW/Projects/HF  
  → ~/projects/HF

- **npm cache:**
  /Volumes/PAWSTAW/cache/npm

- **Docker / Colima home:**
  /Volumes/PAWSTAW/colima

- **Postgres data directory:**
  /Volumes/PAWSTAW/Projects/HF/.runtime/postgres

This keeps the internal disk clean and makes the environment reproducible.

---

## Runtime Stack

- Node.js (runs locally)
- Docker (via Colima)
- PostgreSQL 15 (Docker container)
- BDD tests (in-memory, no infra)

**Important:**  
BDD tests do **not** require Docker or Postgres.

---

## One-Time Setup (per machine)

Run once after cloning the repo.

```bash
# Ensure repo path (symlink)
ln -s /Volumes/PAWSTAW/Projects/HF ~/projects/HF || true

# Move npm cache to SSD
npm config set cache /Volumes/PAWSTAW/cache/npm

# Verify
npm config get cache
Docker / Colima Setup

Colima is configured to live on the SSD.
# Start Colima (uses SSD-backed home)
COLIMA_HOME=/Volumes/PAWSTAW/colima colima start

# Verify
colima status
docker info | head -n 10


⸻

PostgreSQL (Docker)

Defined in docker-compose.yml.
	•	Image: postgres:15
	•	Data directory: .runtime/postgres (SSD-backed)
	•	Port: 5432
	•	DB: hf
	•	User: hf_user
	•	Password: hf_password

Start database
cd ~/projects/HF
docker compose up -d postgres

Stop database
cd ~/projects/HF
docker compose down

Connect manually
docker exec -it hf_postgres psql -U hf_user -d hf


Daily Development Workflow

1) Install dependencies (first time or after pull)

cd ~/projects/HF
npm ci



2) Run BDD tests (no infra)
npm run bdd

3) Start database (only when needed)
docker compose up -d postgres

CI Expectations

CI must be able to:
	•	Run npm ci
	•	Run npm run bdd without Docker
	•	Optionally start Postgres via docker compose up -d

BDD is the contract layer; infra is optional.

⸻

Reset / Recovery

Reset Postgres data

docker compose down
rm -rf .runtime/postgres
docker compose up -d postgres

Reset Colima completely

colima stop
colima delete
COLIMA_HOME=/Volumes/PAWSTAW/colima colima start


Troubleshooting
	•	BDD fails: Docker is irrelevant — fix TypeScript or step definitions
	•	Docker slow: Check Colima is using SSD paths
	•	Disk filling: Verify npm cache path

⸻

Source of Truth
	•	BDD features: bdd/features/*.feature
	•	Step definitions: bdd/steps/*.ts
	•	Infra: docker-compose.yml
	•	This file: docs/DEV_ENV.md


