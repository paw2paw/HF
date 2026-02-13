# CONTENT Spec Requirements

A CONTENT spec defines a curriculum that callers progress through module-by-module. This document specifies the required structure for the pipeline, readiness checks, and exam system to function.

## Required Structure

A valid CONTENT spec must have:

### 1. Spec metadata

```
specRole: "CONTENT"
outputType: "COMPOSE"
```

### 2. `config.metadata.curriculum` section

All 6 fields are **required** (defined in `CURRICULUM_REQUIRED_FIELDS` from `lib/curriculum/constants.ts`):

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `type` | string | `sequential` / `branching` / `open-ended` | How modules are traversed |
| `trackingMode` | string | `module-based` / `competency-based` | How progress is tracked |
| `moduleSelector` | string | e.g. `section=content` | Which parameters are modules |
| `moduleOrder` | string | `sortBySequence` / `sortBySectionThenId` / `explicit` | Module ordering |
| `progressKey` | string | e.g. `current_module` | CallerAttribute key for current position |
| `masteryThreshold` | number | 0.0 - 1.0 | Score needed to advance to next module |

These fields come from the `CURRICULUM_PROGRESS_V1` contract `metadata.curriculum` section.

### 3. Module parameters

Parameters with a field matching `moduleSelector` are treated as curriculum modules.

For `moduleSelector = "section=content"`, each module parameter needs:

```json
{
  "id": "MOD-1",
  "name": "Food Hygiene Legislation",
  "description": "Key legislation governing food safety in the UK",
  "section": "content",
  "learningOutcomes": [
    "Understand the Food Safety Act 1990",
    "Know the role of local authorities in enforcement",
    "Identify key regulations (EC 852/2004)"
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique module identifier (e.g. `MOD-1`) |
| `name` | Yes | Human-readable module name |
| `description` | Yes | What this module covers |
| `section` | Yes | Must match the moduleSelector value |
| `learningOutcomes` | Recommended | What the AI assesses for mastery scoring |

Without `learningOutcomes`, the AI cannot score mastery per-module and progress tracking will be limited.

## How the Pipeline Uses This

### Per-call cycle

1. `loadCurrentModuleContext()` finds the CONTENT spec via domain -> published playbook
2. Reads modules (parameters matching `moduleSelector`)
3. Gets current position via `getCurriculumProgress(callerId, specSlug)`
4. Injects current module's `learningOutcomes` into AI prompt
5. AI scores mastery 0-1 per learning outcome
6. `trackCurriculumAfterCall()` stores mastery in CallerAttribute
7. If mastery >= `masteryThreshold`, caller advances to next module

### Curriculum type behavior

| Type | Next module logic |
|------|-------------------|
| `sequential` | First incomplete module in sequence order |
| `branching` | First incomplete module with all prerequisites met |
| `open-ended` | Current module (learner chooses), or first module if none |

## Validation

### Creation wizard (`/x/specs/new`)

When `specRole = "CONTENT"`:
- Step 3.5 collects curriculum metadata with defaults
- Parameters become "Modules" with learning outcomes editor
- Validation checks:
  - `metadata.curriculum` exists
  - `type` is set
  - `masteryThreshold` is 0-1
  - At least one parameter has section matching moduleSelector

### Domain readiness check

The `content_spec_curriculum` executor in `lib/domain/readiness.ts` validates at deploy time:
- CONTENT spec has `metadata.curriculum` section
- All 6 required fields present
- At least one parameter matches `moduleSelector`
- Warning (not blocking) if no `learningOutcomes`

### Contracts

| Contract | What it defines |
|----------|----------------|
| `CURRICULUM_PROGRESS_V1` | Storage keys, mastery thresholds, required metadata fields |
| `EXAM_READINESS_V1` | Readiness formula, gate thresholds, exam storage keys |

## Example: Food Safety Level 2

```json
{
  "id": "CURR-FS-L2-001",
  "title": "Food Safety Level 2 Curriculum",
  "specType": "DOMAIN",
  "specRole": "CONTENT",
  "outputType": "COMPOSE",
  "metadata": {
    "curriculum": {
      "type": "sequential",
      "trackingMode": "module-based",
      "moduleSelector": "section=content",
      "moduleOrder": "sortBySequence",
      "progressKey": "current_module",
      "masteryThreshold": 0.7
    }
  },
  "parameters": [
    {
      "id": "MOD-1",
      "name": "Food Hygiene Legislation",
      "section": "content",
      "learningOutcomes": [
        "Understand the Food Safety Act 1990",
        "Know the role of local authorities"
      ]
    },
    {
      "id": "MOD-2",
      "name": "Microbiological Hazards",
      "section": "content",
      "learningOutcomes": [
        "Identify common foodborne pathogens",
        "Understand bacterial growth conditions"
      ]
    }
  ]
}
```

## Key Files

| File | Purpose |
|------|---------|
| `lib/curriculum/constants.ts` | `CURRICULUM_REQUIRED_FIELDS` shared constant |
| `lib/prompt/compose-content-section.ts` | Content section composer (validates CONTENT spec metadata) |
| `lib/curriculum/track-progress.ts` | Module mastery storage and advancement |
| `lib/curriculum/exam-readiness.ts` | Exam gate and readiness computation |
| `lib/domain/readiness.ts` | `content_spec_curriculum` readiness check |
| `app/x/specs/new/page.tsx` | Creation wizard with Step 3.5 |
| `app/api/specs/create/route.ts` | API passes metadata + learningOutcomes through |
| `docs-archive/bdd-specs/contracts/CURRICULUM_PROGRESS_V1.contract.json` | Contract |
| `tests/lib/domain-readiness.test.ts` | Readiness check tests |
| `tests/lib/exam-readiness.test.ts` | Exam readiness tests |
