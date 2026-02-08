#!/usr/bin/env bash
set -euo pipefail

echo "▶ HF bootstrap starting..."

# Ensure npm cache
npm config set cache /Volumes/PAWSTAW/cache/npm || true

# Install deps
npm ci

# Run contract tests
npm run bdd

echo "✅ HF bootstrap complete"