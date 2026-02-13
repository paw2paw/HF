---
description: Deep codebase quality scan — hardcoding, auth, async, TDZ, dead code, tests
---

Full quality audit. Deeper than /review — scans the whole project, not just recent changes.

## Scan Checklist

### 1. Hardcoding Scan
Search `apps/admin/` for:
- Hardcoded spec slugs (literals like `"INIT-001"`) outside `lib/config.ts` and seed files
- Hardcoded domain slugs in route handlers
- Magic numbers without comments
- Report each finding with file:line and suggested fix

### 2. Auth Coverage
- Run `npm run test -- tests/lib/route-auth-coverage.test.ts`
- List any routes that fail
- Check role levels are appropriate (not everything should be ADMIN)

### 3. Async/Await Correctness
- `ContractRegistry.get(` or `.resolve(` without `await`
- Prisma calls without `await`
- Flag any floating promises

### 4. Config Shadowing (TDZ)
- `const config =` in files that also import `config` from `@/lib/config`
- Known recurring bug — catch it early

### 5. Dead Code
- Files in `lib/` not imported anywhere
- Exported functions with zero importers
- Flag for review, don't delete

### 6. Test Coverage Gaps
- `lib/` files with no corresponding `.test.ts`
- Prioritize: pipeline/, prompt/, permissions.ts, config.ts

## Output
Markdown report with sections for each check. Tables where helpful.
End with "Health Score: X/6" and a prioritized fix list.
