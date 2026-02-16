#!/bin/bash
# setup-test-db.sh — Create and seed the E2E test database
# Idempotent: safe to run repeatedly
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

export DATABASE_URL="postgresql://hf_user:hf_password@localhost:5432/hf_test?schema=public"

echo ""
echo "=== E2E Test Database Setup ==="
echo ""

# 1. Create database if it doesn't exist
echo "  1. Ensuring hf_test database exists..."
createdb -U hf_user hf_test 2>/dev/null || echo "     (already exists)"

# 2. Run Prisma migrations
echo "  2. Running migrations..."
npx prisma migrate deploy

# 3. Seed: specs + infrastructure
echo "  3. Seeding specs and infrastructure..."
npx tsx prisma/seed-clean.ts

# 4. Seed: E2E fixtures
echo "  4. Seeding E2E fixtures..."
npx tsx prisma/seed-e2e.ts

echo ""
echo "=== Test DB Ready ==="
echo "  DATABASE_URL=$DATABASE_URL"
echo ""
