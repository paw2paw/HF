---
description: Diagnose and fix an error from a pasted message or stack trace
---

Diagnose and fix an error — paste the error message after the command

The user will provide an error message, stack trace, or describe a problem. Follow this process:

## 1. Classify the Error
Determine the category:
- **TypeScript** — type error, missing import, wrong argument
- **Runtime** — API 500, null reference, missing env var
- **Database** — Prisma error, migration issue, connection refused
- **Build** — Next.js build failure, module resolution
- **Test** — Vitest failure, assertion error

## 2. Locate the Source
- Read the file(s) mentioned in the stack trace
- Check for known HF bugs:
  - TDZ: `const config =` shadowing the config import
  - Missing `await` on ContractRegistry or Prisma calls
  - Hardcoded slug that should use `config.specs.*`
  - Missing `requireAuth()` in API route

## 3. Fix It
- Make the minimal fix
- Explain what went wrong and why
- Run the relevant test to confirm the fix works

## 4. Prevent Recurrence
- If this is a pattern that could recur, note it
- If it should be caught by `/pre-commit`, confirm that check would catch it

Do NOT over-fix. Solve the specific problem, don't refactor the surrounding code.
