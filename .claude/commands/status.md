---
description: Show project health — git, tests, types, server, database
---

Show project health: git state, test results, build status, DB connectivity

Run these checks and give me a quick project health dashboard:

## 1. Git State
- Current branch, uncommitted changes count, unpushed commits
- Last 5 commit messages (one-line)

## 2. Tests
Run `npm run test` in `apps/admin/` and report pass/fail count.

## 3. TypeScript
Run `npx tsc --noEmit` in `apps/admin/` and report error count.

## 4. Dev Server
Check if port 3000 is in use (`lsof -ti:3000`). Report running or not.

## 5. Database
Check if Postgres is reachable (`docker exec hf_postgres psql -U hf_user -d hf -c "SELECT 1"` or `nc -zv localhost 5432`).

## Output
Print a compact dashboard:

```
Branch:   MVP-2-9 (3 uncommitted, 0 unpushed)
Tests:    142 passed, 0 failed
Types:    Clean (0 errors)
Server:   Running on :3000
Database: Connected
```

If anything is red, suggest the fix command.
