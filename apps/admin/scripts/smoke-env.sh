#!/usr/bin/env bash
# smoke-env.sh — hit a target env's critical public endpoints and fail on
# any non-2xx. Designed to catch schema drift (missing columns, broken FKs),
# seed misalignment, and dead routes BEFORE a deploy proceeds.
#
# Usage:
#   ./scripts/smoke-env.sh <base-url>
#
# Example:
#   ./scripts/smoke-env.sh https://dev.humanfirstfoundation.com
#   ./scripts/smoke-env.sh http://localhost:3000
#
# Exit codes:
#   0 — all checks green
#   1 — at least one check failed (details printed to stderr)
#   2 — invocation error (missing arg, curl not found)

set -euo pipefail

BASE_URL="${1:-}"
if [[ -z "$BASE_URL" ]]; then
  echo "error: missing base url. usage: $0 <base-url>" >&2
  exit 2
fi
BASE_URL="${BASE_URL%/}"  # strip trailing slash

if ! command -v curl >/dev/null 2>&1; then
  echo "error: curl not found" >&2
  exit 2
fi

# Critical endpoints that together exercise:
#   - Next.js app is up
#   - Prisma can connect
#   - Schema matches code (readiness hits multiple models incl ContentSource)
#   - System-scoped reads work
ENDPOINTS=(
  "/api/health"
  "/api/ready"
  "/api/system/readiness"
  "/api/system/ini"
)

failed=0
total=${#ENDPOINTS[@]}
passed=0

echo "[smoke-env] target: $BASE_URL"
echo "[smoke-env] checking $total endpoints..."

for path in "${ENDPOINTS[@]}"; do
  url="${BASE_URL}${path}"
  # -w writes http code + time. -o discards body. -s silent. -L follow redirects.
  # Fail on connect errors too.
  http_code=$(curl -sS -o /tmp/smoke-env-body.$$ -w "%{http_code}" -m 15 "$url" 2>&1) || {
    echo "  FAIL  $path  — curl error: $http_code" >&2
    failed=$((failed + 1))
    continue
  }

  if [[ "$http_code" =~ ^2 ]]; then
    echo "  PASS  $path  ($http_code)"
    passed=$((passed + 1))
  else
    echo "  FAIL  $path  (HTTP $http_code)" >&2
    # Show a snippet of the body for debugging (likely a Prisma error on schema drift)
    head -c 400 /tmp/smoke-env-body.$$ >&2
    echo >&2
    failed=$((failed + 1))
  fi
done

rm -f /tmp/smoke-env-body.$$

echo
echo "[smoke-env] result: $passed/$total passed"

if [[ $failed -gt 0 ]]; then
  echo "[smoke-env] FAILED — do not deploy" >&2
  exit 1
fi

echo "[smoke-env] all green"
exit 0
