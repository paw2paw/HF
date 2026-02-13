---
description: Review branch changes against quality standards
---

Review code changes in this branch against HF quality standards.

## 1. Zero Hardcoding
- Scan changed files for magic strings, hardcoded slugs, literal config values
- Spec slugs must come from `config.specs.*`
- Runtime data must come from DB, not hardcoded arrays/objects

## 2. Auth Coverage
- Every new/modified API route must call `requireAuth("ROLE")`
- Check with `isAuthError()` immediately after
- Role must be appropriate: VIEWER for reads, OPERATOR for writes, ADMIN for system ops
- Run `npm run test -- tests/lib/route-auth-coverage.test.ts`

## 3. Test Coverage
- New functions in `lib/` should have `.test.ts` coverage
- New API routes should have input validation tests
- Run `npm run test` and report failures

## 4. Code Smells
- No `any` types (use `unknown` if truly unknown)
- No TDZ: never shadow `config` import with `const config = ...`
- All ContractRegistry calls use `await`
- CSS colors use `color-mix()`, never hex alpha suffixes
- No N+1 queries (use Prisma `include` or `select`)

## Output
For each category: PASS / FAIL / WARN with file:line references.
End with "Ready to commit" or "Issues to fix" with numbered list.
