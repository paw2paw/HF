---
description: Run the HF Gherkin
---

Run the project's Cucumber/Gherkin test suite and report results.

## Steps

### 1. Run the BDD suite
From the **repo root** (not apps/admin/):
```bash
npm run bdd
```
This executes: `cucumber-js --require-module ts-node/register --require bdd/steps/**/*.ts bdd/features/**/*.feature`

### 2. Report results
- List each scenario with PASS/FAIL
- For failures: show the failing step, expected vs actual
- If a step definition is missing, identify which `.feature` step needs a `.steps.ts` implementation

### 3. If failures, diagnose
- Read the relevant `.feature` file in `bdd/features/`
- Read the matching `.steps.ts` file in `bdd/steps/`
- Identify the root cause and suggest a fix

## Arguments
If `$ARGUMENTS` is provided, treat it as a feature file path or name to run a specific feature:
```bash
cucumber-js --require-module ts-node/register --require bdd/steps/**/*.ts bdd/features/$ARGUMENTS
```

## Feature Files
- `bdd/features/` — Gherkin `.feature` files
- `bdd/steps/` — TypeScript step definitions (Given/When/Then)
