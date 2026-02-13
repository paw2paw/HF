---
description: Pre-commit quality gate — tsc, lint, tests, auth
---

Run the pre-commit quality gate. READY/NOT READY verdict.

## Steps (run in order)

### 1. Type Check
```bash
npx tsc --noEmit
```
Report: PASS or list of errors.

### 2. Lint
```bash
npm run lint 2>&1 | head -50
```
Report: PASS or list of errors.

### 3. Unit Tests
```bash
npm run test
```
Report: PASS (X tests) or list of failures.

### 4. Auth Coverage
```bash
npm run test -- tests/lib/route-auth-coverage.test.ts
```
Report: PASS or list of uncovered routes.

### 5. Quick Spot-Check
Search staged/modified files for:
- Hardcoded spec slugs outside config.ts/seed files
- `const config =` shadowing the config import
- ContractRegistry calls without `await`

Report: PASS or list of findings.

## Summary

```
Pre-commit: READY (5/5 checks passed)
```
or
```
Pre-commit: NOT READY
  - TypeScript: 3 errors
  - Tests: 1 failure
```

If all pass, suggest a commit message based on staged changes.
