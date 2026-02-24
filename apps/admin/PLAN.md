# Plan: Teach Wizard — Extraction Fixes + Lesson Planner + TP Review

## Status: IMPLEMENTED (Phase 1 + Phase 2)

Phase 1+2 are done. Phase 3 (section detection) and Phase 4 (pedagogical intent) are future work.

## What Changed

### Phase 1: Fix What's Broken

**1A. Spinner Bug** — `content-stats/route.ts`
- Added 30-min staleness guard to `hasActiveJobs` query
- Added `questionCount` and `vocabularyCount` to response
- Client-side: 3-min poll timeout + "Continue anyway" / "Keep waiting" escape buttons

**1B. Enriched Content Categories** — `content-categories/route.ts`
- Added `ContentQuestion.groupBy` by questionType
- Added `ContentVocabulary.count`
- Response now includes `questions[]` and `vocabularyCount`

**1C. Lesson Planner API** — `lesson-plan/generate/route.ts` (NEW)
- `POST /api/lesson-plan/generate` — multi-subject plan generation
- Resolves sourceIds from subjects, parallel per-source generation
- Merges sessions, appends assessment + review
- Fallback: wizard falls back to naive group-by-method if API fails

**1D. Curriculum Persistence** — `teachwizard.tsx` handleLaunch
- After subject linking, before caller creation
- Creates curriculum if needed, saves lesson plan entries
- Wrapped in try/catch — non-fatal if it fails

### Phase 2: TP Review UX

**2A. Content Detail API** — `content-detail/route.ts` (NEW)
- `GET /api/domains/:id/content-detail?groupType=assertion|question|vocabulary&category=...`
- Lazy-loaded on row expand, max 100 items

**2B. Expandable Content Groups** — `teachwizard.tsx`
- ContentGroup type enriched with `groupType`, `expanded`, `items`, `loadingItems`, `itemError`
- Question groups + vocabulary group from enriched categories API
- Click row → expand → lazy-fetch items → per-item exclude toggle

**2C. Session Type Badges** — `teach-wizard.css`
- Introduce (blue), Deepen (accent), Review (green), Assess (amber), Consolidate (muted)
- Lesson objectives shown inline
- "+ Add lesson" button

## Files Changed

| File | Change |
|------|--------|
| `app/api/domains/[domainId]/content-stats/route.ts` | Staleness guard + Q/V counts |
| `app/api/domains/[domainId]/content-categories/route.ts` | Question groups + vocab count |
| `app/api/lesson-plan/generate/route.ts` | **NEW** — multi-subject plan endpoint |
| `app/api/domains/[domainId]/content-detail/route.ts` | **NEW** — lazy-load TP details |
| `components/wizards/teachwizard.tsx` | Full Step 4+5 rewrite + curriculum persist |
| `components/wizards/teach-wizard.css` | Badges, objectives, expand, items, timeout |

## Future Work

- **Phase 3: Section Detection** — Pre-pass to split composite docs into sections
- **Phase 4: Pedagogical Intent** — Thread course name + goal into extraction prompts
