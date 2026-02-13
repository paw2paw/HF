# Exam Readiness System

Tracks a caller's readiness for a formal exam/assessment. All thresholds, storage keys, and formula weights come from the **EXAM_READINESS_V1** contract in `docs-archive/bdd-specs/contracts/`.

## Readiness Formula

```
readiness = (avgModuleMastery * masteryWeight) + (formativeScore * formativeWeight)
```

- `masteryWeight` and `formativeWeight` from contract (default 0.6 / 0.4)
- If no formative score exists, `readiness = avgModuleMastery`
- Module mastery comes from CURRICULUM_PROGRESS_V1 via `getCurriculumProgress()`

## Readiness Levels

| Level | Range | Gate |
|-------|-------|------|
| `not_ready` | 0 – notReadyMax (0.50) | LOCKED |
| `borderline` | notReadyMax – borderlineMax (0.66) | OPEN (with warning) |
| `ready` | borderlineMax – readyMax (0.80) | OPEN |
| `strong` | readyMax+ (0.80+) | OPEN |

All thresholds from `EXAM_READINESS_V1.thresholds`. Pass mark default: 0.66.

## Data Flow

```
Per-call pipeline scores module mastery
  -> stored in CallerAttribute (CURRICULUM scope)
  -> computeExamReadiness() reads all module mastery scores
  -> averages them, combines with formative score
  -> determines level + gate status
  -> stores result in CallerAttribute (EXAM_READINESS scope)
```

## Storage

All keys follow the contract pattern: `exam_readiness:{specSlug}:{key}`

| Key | Type | Description |
|-----|------|-------------|
| `readiness_score` | number | Overall readiness 0.0-1.0 |
| `formative_score` | number | Latest formative assessment average |
| `weak_modules` | string | JSON array of module IDs below threshold |
| `last_assessed_at` | string | ISO8601 timestamp |
| `attempt_count` | number | Total exam attempts |
| `last_attempt_passed` | string | "true" or "false" |
| `best_score` | number | Best exam score achieved |

## Exam Gate

`checkExamGate(callerId, specSlug)` returns `{ allowed, reason, readiness }`.

- Below `notReadyMax` -> gate LOCKED, reason explains minimum needed
- At `borderline` -> gate OPEN with "targeted revision recommended"
- At `ready` or `strong` -> gate OPEN

## Recording Results

`recordExamResult(callerId, specSlug, score, totalQuestions, correctAnswers)`:

1. Increments `attempt_count`
2. Updates `last_attempt_passed` and `best_score`
3. If passed (score >= `passMarkDefault`):
   - Finds the LEARN Goal linked to this CONTENT spec
   - Marks Goal as `COMPLETED` with exam metrics
   - Creates a COMPLETED Goal if none existed
4. Recomputes and stores readiness

## Formative Assessments

`updateFormativeScore(callerId, specSlug, moduleScores)`:

- Takes per-module formative scores (Record<moduleId, 0-1>)
- Averages them, stores as `formative_score`
- Recomputes readiness with the new formative data
- Returns updated `ExamReadinessResult`

## Domain Configuration

Exam readiness is enabled per-domain via `onboardingDefaultTargets.examConfig`:

```json
{
  "examConfig": {
    "enabled": true,
    "curriculumSpecSlug": "curr-fs-l2-001"
  }
}
```

Configured in the domain setup wizard (OnboardingStepForm) or via API.

## UI

- Caller detail page -> "Exam" tab shows readiness ring, level badge, module mastery bars, gate status
- Display config (colors, labels) in `lib/curriculum/constants.ts` -> `EXAM_LEVEL_CONFIG`

## Key Files

| File | Purpose |
|------|---------|
| `lib/curriculum/exam-readiness.ts` | Core logic: compute, gate, record, formative |
| `lib/curriculum/constants.ts` | Shared constants (level config, required fields) |
| `lib/contracts/registry.ts` | Loads contract from SystemSettings DB |
| `app/api/callers/[callerId]/exam-readiness/route.ts` | API endpoint |
| `components/callers/CallerDetailPage.tsx` | UI (ExamReadinessSection) |
| `components/workflow/steps/OnboardingStepForm.tsx` | Domain exam config |
| `docs-archive/bdd-specs/contracts/EXAM_READINESS_V1.contract.json` | Contract source |
| `tests/lib/exam-readiness.test.ts` | Tests |
