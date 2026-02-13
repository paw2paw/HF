#!/bin/bash
# Install git hooks for the HF project
# Run this once after cloning: ./scripts/install-hooks.sh

HOOK_DIR="$(git rev-parse --show-toplevel)/.git/hooks"

# Pre-commit: auto-regenerate API docs when route files change
cat > "$HOOK_DIR/pre-commit" << 'HOOK'
#!/bin/bash
# Auto-regenerate API docs when route files change
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)
ROUTE_CHANGES=$(echo "$STAGED_FILES" | grep -c 'apps/admin/app/api/.*route\.ts$' || true)

if [ "$ROUTE_CHANGES" -gt 0 ]; then
  echo "[pre-commit] Route files changed — regenerating API docs..."
  cd apps/admin
  npx tsx scripts/api-docs/generator.ts 2>/dev/null
  RESULT=$?
  cd ../..
  if [ $RESULT -ne 0 ]; then
    echo "[pre-commit] ⚠ API docs generator failed (exit $RESULT). Commit continues."
    exit 0
  fi
  git add docs/API-INTERNAL.md docs/API-PUBLIC.md 2>/dev/null
  echo "[pre-commit] API docs regenerated and staged."
fi
HOOK

chmod +x "$HOOK_DIR/pre-commit"
echo "✓ Git hooks installed."
