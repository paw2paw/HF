#!/usr/bin/env bash
# deploy-gate.sh — mandatory pre-deploy check. Runs local-only + target-env
# verification before /deploy is allowed to proceed. Designed to catch the
# failure modes that have actually bitten us in production:
#
#   1. Missing migration on target env (2026-04-15 incident: ContentSource.
#      extractorVersion missing, prod code expected it).
#   2. Code that compiles locally but fails at runtime due to schema/FK drift.
#   3. Dead routes — unit tests pass but a route is broken end-to-end.
#
# Usage:
#   ./scripts/deploy-gate.sh <env>
#     env: dev | test | prod
#
# Exit codes:
#   0 — all gates green, safe to deploy
#   1 — at least one gate failed (details printed)
#   2 — invocation error

set -euo pipefail

ENV="${1:-}"
if [[ -z "$ENV" ]]; then
  echo "error: missing env. usage: $0 <dev|test|prod>" >&2
  exit 2
fi

case "$ENV" in
  dev)
    BASE_URL="https://dev.humanfirstfoundation.com"
    DB_SECRET="DATABASE_URL_DEV"
    ;;
  test)
    BASE_URL="https://test.humanfirstfoundation.com"
    DB_SECRET="DATABASE_URL_TEST"
    ;;
  prod)
    BASE_URL="https://lab.humanfirstfoundation.com"
    DB_SECRET="DATABASE_URL"
    ;;
  *)
    echo "error: unknown env '$ENV' (expected dev|test|prod)" >&2
    exit 2
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$APP_DIR"

failed_gates=()

section() {
  echo
  echo "=========================================="
  echo "  $1"
  echo "=========================================="
}

gate_fail() {
  failed_gates+=("$1")
}

# ─── Gate 1: tsc --noEmit ────────────────────────────────────
section "Gate 1/5 — TypeScript compile check"
if npx tsc --noEmit 2>&1 | tee /tmp/deploy-gate-tsc.$$ | tail -20; then
  echo "  PASS  tsc clean"
else
  # tsc exit code is non-zero on errors
  echo "  FAIL  tsc reported errors" >&2
  gate_fail "tsc"
fi
rm -f /tmp/deploy-gate-tsc.$$

# ─── Gate 2: lint ────────────────────────────────────────────
section "Gate 2/5 — ESLint"
if npm run lint 2>&1 | tail -10 | grep -qE "error" ; then
  echo "  FAIL  lint errors detected" >&2
  gate_fail "lint"
else
  echo "  PASS  lint clean"
fi

# ─── Gate 3: unit tests ──────────────────────────────────────
section "Gate 3/5 — Unit tests (vitest)"
if npm run test 2>&1 | tail -25 | tee /tmp/deploy-gate-test.$$; then
  if grep -q "failed\|FAIL" /tmp/deploy-gate-test.$$; then
    echo "  FAIL  unit tests red" >&2
    gate_fail "unit-tests"
  else
    echo "  PASS  unit tests green"
  fi
else
  echo "  FAIL  unit test run failed" >&2
  gate_fail "unit-tests"
fi
rm -f /tmp/deploy-gate-test.$$

# ─── Gate 4: migration diff vs target env ──────────────────────
section "Gate 4/5 — Prisma migration status vs $ENV Cloud SQL"
echo "  fetching $DB_SECRET from Secret Manager..."

if ! command -v gcloud >/dev/null 2>&1; then
  echo "  FAIL  gcloud not installed — cannot reach target Cloud SQL" >&2
  gate_fail "migration-diff"
else
  # Use subshell so DATABASE_URL never touches parent env.
  if (
    export DATABASE_URL="$(gcloud secrets versions access latest \
      --secret="$DB_SECRET" --project=hf-admin-prod 2>/dev/null)"
    if [[ -z "$DATABASE_URL" ]]; then
      exit 11
    fi
    npx prisma migrate status 2>&1
  ) | tee /tmp/deploy-gate-migrate.$$; then
    if grep -qE "Database schema is up to date" /tmp/deploy-gate-migrate.$$; then
      echo "  PASS  schema up to date on $ENV"
    elif grep -qE "Following migrations have not yet been applied|Drift detected" /tmp/deploy-gate-migrate.$$; then
      echo "  FAIL  pending migrations on $ENV — /deploy must run Full deploy to apply them" >&2
      gate_fail "migration-pending"
    else
      echo "  FAIL  migrate status output unrecognised" >&2
      gate_fail "migration-unknown"
    fi
  else
    rc=$?
    if [[ $rc -eq 11 ]]; then
      echo "  FAIL  could not read $DB_SECRET from Secret Manager (auth/permissions?)" >&2
    else
      echo "  FAIL  prisma migrate status failed (rc=$rc)" >&2
    fi
    gate_fail "migration-access"
  fi
fi
rm -f /tmp/deploy-gate-migrate.$$

# ─── Gate 5: smoke against current live env ──────────────────
section "Gate 5/5 — Smoke-env against $BASE_URL"
if bash "$SCRIPT_DIR/smoke-env.sh" "$BASE_URL"; then
  echo "  PASS  live env responding to all critical endpoints"
else
  echo "  FAIL  live env smoke red — schema drift or broken route" >&2
  gate_fail "smoke-env"
fi

# ─── Summary ────────────────────────────────────────────────
section "Summary"
total=5
if [[ ${#failed_gates[@]} -eq 0 ]]; then
  echo "  ✅ All $total gates PASSED — safe to deploy to $ENV"
  exit 0
else
  echo "  ❌ ${#failed_gates[@]}/$total gate(s) FAILED: ${failed_gates[*]}"
  echo "  Deploy to $ENV is BLOCKED. Fix the failing gates above and re-run."
  exit 1
fi
