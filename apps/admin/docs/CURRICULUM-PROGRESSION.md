# Curriculum Progression & Learning Assessment

How the system teaches callers module-by-module, assesses their understanding, and advances them through a curriculum.

## The Loop

```
BEFORE CALL (Composition)
  Subjects loader    -> Curriculum.notableInfo.modules
  Assertions loader  -> ContentAssertions (from uploaded docs)
  computeSharedState -> picks nextModule (from CONTENT spec or Subject fallback)
  renderTeachingContent -> filters assertions to current module's LOs
  -> LLM prompt has focused teaching content for one module

DURING CALL
  AI teaches module content, checks understanding conversationally

AFTER CALL (Pipeline EXTRACT)
  Detects active LEARN-ASSESS-001 spec (config.assessmentMode = "curriculum_mastery")
  loadCurrentModuleContext -> gets current module + LOs
  buildBatchedCallerPrompt -> adds LO scoring instructions from spec
  AI returns: personality scores + memories + learning assessment
  trackCurriculumAfterCall -> writes mastery to CallerAttribute, advances if >= threshold

UI (Caller Detail)
  composeContentSection -> reads CallerAttribute mastery
  LearningSection renders module progress sliders
```

## Key Files

| File | Role |
|------|------|
| `docs-archive/bdd-specs/LEARN-ASSESS-001-curriculum-mastery.spec.json` | Spec that drives the feature. `config.assessmentMode`, `promptInstructions`, `masteryThreshold` |
| `docs-archive/bdd-specs/contracts/CURRICULUM_PROGRESS_V1.contract.json` | Storage key patterns and threshold defaults |
| `app/api/calls/[callId]/pipeline/route.ts` | Pipeline EXTRACT: `loadCurrentModuleContext()`, LO scoring in prompt, `trackCurriculumAfterCall()` |
| `lib/prompt/composition/transforms/modules.ts` | `computeSharedState()`: module extraction from CONTENT spec or Subject curriculum |
| `lib/prompt/composition/transforms/teaching-content.ts` | Filters assertions to current module's learning outcomes |
| `lib/prompt/compose-content-section.ts` | Builds content section data for caller detail UI |
| `lib/curriculum/track-progress.ts` | CallerAttribute CRUD: `updateCurriculumProgress()`, `completeModule()`, `getCurriculumProgress()` |

## How It Works

### 1. Module Source Selection

Modules come from one of two sources, tried in order:

1. **CONTENT spec** (via domain playbook): Spec parameters filtered by `metadata.curriculum.moduleSelector` (e.g., `section=content`)
2. **Subject curriculum** (fallback): `Subject.curriculum.notableInfo.modules` — AI-generated from uploaded documents

`computeSharedState()` in `transforms/modules.ts` handles this:
```
CONTENT spec modules exist?  -> use them
No?  -> check subjectSources.subjects[].curriculum.notableInfo.modules
```

### 2. Teaching Content Filtering

`renderTeachingContent` in `transforms/teaching-content.ts` filters the full assertion set to only those matching the current module's learning outcomes:

- Extracts LO identifiers from module (e.g., `LO2`, `AC2.1`)
- Matches assertions by `learningOutcomeRef` containing those identifiers
- Falls back to all assertions if no matches (better too much context than none)

### 3. Learning Assessment (Pipeline)

The pipeline detects LEARN-ASSESS-001 by searching for active specs with `config.assessmentMode === "curriculum_mastery"`. This is the feature flag — no hardcoded learning assessment logic exists without this spec active.

When found:
- `loadCurrentModuleContext()` loads the current module + its learning outcomes
- The EXTRACT prompt includes: "LEARNING OUTCOMES TO ASSESS: LO1: ...|LO2: ..."
- Uses `spec.config.promptInstructions` for the scoring instructions
- AI responds with `"learning": { "moduleId": "MOD-3", "outcomes": {"LO2": 0.7}, "overallMastery": 0.7 }`

### 4. Progress Storage

All progress is stored in `CallerAttribute` using keys from the CURRICULUM_PROGRESS_V1 contract:

```
curriculum:{specSlug}:current_module     -> STRING: "MOD-3"
curriculum:{specSlug}:mastery:MOD-1      -> NUMBER: 0.85
curriculum:{specSlug}:mastery:MOD-2      -> NUMBER: 0.72
curriculum:{specSlug}:last_accessed       -> STRING: ISO8601
```

### 5. Module Advancement

After mastery is written, `trackCurriculumAfterCall()` checks:
- `overallMastery >= masteryThreshold` (from spec config, default 0.7 from contract)
- If met: calls `completeModule()` which sets mastery to 1.0 and advances `current_module` to next in sequence
- If last module completed: curriculum is done (no next module)
- Module completion is one-directional (CON-LA-003): once completed, stays completed even if later recall drops

## Configuration

All configurable values come from spec config or contracts:

| Value | Source | Default |
|-------|--------|---------|
| `masteryThreshold` | `LEARN-ASSESS-001.config.masteryThreshold` or `CURRICULUM_PROGRESS_V1.thresholds.masteryComplete` | 0.7 |
| `promptInstructions` | `LEARN-ASSESS-001.config.promptInstructions` | (in spec) |
| `assessmentMode` | `LEARN-ASSESS-001.config.assessmentMode` | `"curriculum_mastery"` |
| Review schedule | `specConfig.reviewSchedule` (COMP-001 section config) | `{reintroduce: 14, deepReview: 7, application: 3}` days |
| Storage keys | `CURRICULUM_PROGRESS_V1.storage.keys` | `current_module`, `mastery:{moduleId}`, `last_accessed` |

## Activating the System

1. Import `LEARN-ASSESS-001-curriculum-mastery.spec.json` via `/x/admin/spec-sync` or `/x/import`
2. Ensure the spec is active (`isActive: true`)
3. Ensure the caller's domain has a Subject with curriculum, OR a CONTENT spec with modules
4. Run the pipeline after a call — learning assessment will be included automatically

## Tests

```bash
# Run all curriculum tests
npx vitest run tests/lib/composition/modules.test.ts tests/lib/composition/teaching-content.test.ts tests/lib/curriculum-progression.test.ts
```

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `tests/lib/composition/modules.test.ts` | 20 | `computeSharedState`: Subject fallback, CONTENT spec, progress tracking, review schedule |
| `tests/lib/composition/teaching-content.test.ts` | 18 | `renderTeachingContent`: grouping, LO filtering, fallback, citations, exam relevance |
| `tests/lib/curriculum-progression.test.ts` | 36 | Spec validation, contract validation, mastery logic, pipeline integration, no-hardcoding |
