---
description: Show project health — git, tests, types, server, database
---

Show project health: git state, test results, build status, DB connectivity

Ask the user using AskUserQuestion:

**Question:** "Which health checks do you want to run?"
**Header:** "Status"
**multiSelect:** true

Options:
1. **Git** — Branch, uncommitted changes, unpushed commits, last 5 commits
2. **Tests & types** — Vitest pass/fail count + tsc --noEmit error count
3. **Server & DB** — Dev server on :3000, Postgres reachable
4. **All (Recommended)** — Run everything and print a full dashboard

If the user selects "All" (or nothing specific), run all checks.

## Check Details

### Git State
- Current branch, uncommitted changes count, unpushed commits
- Last 5 commit messages (one-line)

### Tests
Run `npm run test` in `apps/admin/` and report pass/fail count.

### TypeScript
Run `npx tsc --noEmit` in `apps/admin/` and report error count.

### Dev Server
Check if port 3000 is in use (`lsof -ti:3000`). Report running or not.

### Database
Check if Postgres is reachable (`docker exec hf_postgres psql -U hf_user -d hf -c "SELECT 1"` or `nc -zv localhost 5432`).

## Output
Print a compact dashboard (only showing selected checks):

```
Branch:   MVP-2-9 (3 uncommitted, 0 unpushed)
Tests:    142 passed, 0 failed
Types:    Clean (0 errors)
Server:   Running on :3000
Database: Connected
```

If anything is red, suggest the fix command.
