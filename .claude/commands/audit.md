---
description: Deep codebase quality scan — hardcoding, auth, async, TDZ, dead code, tests
---

Full quality audit. Deeper than /review — scans the whole project, not just recent changes.

Ask the user using AskUserQuestion:

**Question:** "Which audit scans do you want to run?"
**Header:** "Audit"
**multiSelect:** true

Options:
1. **Hardcoding** — Hardcoded slugs, magic strings, domain literals outside config
2. **Auth & async** — Auth coverage test + ContractRegistry/Prisma await checks + TDZ shadowing
3. **Dead code** — Unused lib/ files, exported functions with zero importers
4. **Test gaps** — lib/ files missing .test.ts coverage (pipeline, prompt, permissions, config)

If the user selects nothing specific (or "Other" with "all"), run all 4.

## Scan Details

### Hardcoding Scan
Search `apps/admin/` for:
- Hardcoded spec slugs (literals like `"INIT-001"`) outside `lib/config.ts` and seed files
- Hardcoded domain slugs in route handlers
- Magic numbers without comments
- Report each finding with file:line and suggested fix

### Auth & Async
- Run `npm run test -- tests/lib/route-auth-coverage.test.ts`
- List any routes that fail
- Check role levels are appropriate (not everything should be ADMIN)
- `ContractRegistry.get(` or `.resolve(` without `await`
- Prisma calls without `await`
- Flag any floating promises
- `const config =` in files that also import `config` from `@/lib/config` (TDZ)

### Dead Code
- Files in `lib/` not imported anywhere
- Exported functions with zero importers
- Flag for review, don't delete

### Test Coverage Gaps
- `lib/` files with no corresponding `.test.ts`
- Prioritize: pipeline/, prompt/, permissions.ts, config.ts

## Output
Markdown report with sections for each selected check. Tables where helpful.
End with "Health Score: X/N" (where N = number of checks run) and a prioritized fix list.
