# Generic Course Distribution Model — Conceptual Analysis

## The Problem

A course has: **WHAT** (n teaching points), **HOW** (pedagogical model), **WITH** (n content items), across **N sessions** of **M minutes**. How do you optimally distribute these to create a coherent learning experience?

---

## The Five Inputs

| Input | Current source | Shape |
|-------|---------------|-------|
| **Teaching Points (TPs)** | `ContentAssertion` | `category`, `depth` (0-3), `teachMethod`, `learningOutcomeRef`, `topicSlug`, `examRelevance`, `parentId` (prerequisite chain) |
| **Pedagogical Model** | `models.ts` (5 models) | `maxTpsPerSession` (8-12), `phaseTemplates`, `reviewFrequency`, `sessionPatternRules` |
| **Uploaded Materials** | `ContentSource` (12 DocumentTypes) | Original files (PDFs, docs) + extracted assertions + questions + vocab + media. Each type has different delivery characteristics. |
| **Supporting Content** | `ContentQuestion`, `ContentVocabulary`, `MediaAsset` | Linked to TPs via `assertionId` or LO ref. Questions have types (MCQ, recall, tutor). Vocab has terms + definitions. Media has images. |
| **Constraints** | `Playbook.config` | `sessionCount`, `durationMins`, `emphasis`, `assessments`, `lessonPlanModel` |

---

## The Five Outputs

### 1. TP Distribution — spread logically

**Core algorithm: constrained bin-packing over a dependency graph**

```
TPs (with depth, prerequisites, LO refs, teachMethod)
        ↓
  Topological sort (parentId chains → prerequisite ordering)
        ↓
  Group by LO ref (keep related TPs together)
        ↓
  Bin-pack into sessions, constrained by:
    • maxTpsPerSession (model-dependent: 8-12)
    • Depth ordering (shallow → deep across sessions)
    • TeachMethod clustering (avoid mixing >3 methods per session)
    • Model-specific patterns (spiral: same TPs across passes at increasing depth)
        ↓
  Session[] with assigned TPs
```

**What exists:** `distribute-tps.ts` does LO-grouped bin-packing — but is orphaned (not called from generation routes). Actual distribution is naive round-robin. Prerequisites (`parentId`) stored but ignored.

**What's missing:** Prerequisite enforcement, teachMethod clustering, depth-ramp validation, spiral multi-pass support.

---

### 2. Material Distribution — uploaded content across sessions

**The problem within the problem:** A teacher uploads 3 PDFs, a worksheet, and a reading passage. The system extracts 80 TPs across them. But the *original materials* also need scheduling — when does the student see the worksheet? When does the tutor reference the textbook chapter?

**Two layers of content scheduling:**

```
Layer 1: ASSERTIONS (extracted TPs) — distributed by the TP algorithm above
Layer 2: MATERIALS (original documents) — need their own distribution logic
```

**Current state:**
- Whole documents are NEVER delivered to the AI — everything goes through assertion extraction
- But original media (PDFs, images) CAN be shared with students via `share_content` tool
- `SubjectSource.sortOrder` orders documents within a subject (document A before B) — but this is flat, not session-aware
- Session scoping exists: `lessonPlanEntry.assertionIds` filter which TPs the AI sees per session
- Media catalog is session-filtered when a lesson plan exists (only that session's media is shareable)
- Student-visible gate: `READING_PASSAGE`, `WORKSHEET`, `COMPREHENSION`, `EXAMPLE` are shareable by default. `TEXTBOOK`, `QUESTION_BANK`, `ASSESSMENT`, `COURSE_REFERENCE` are tutor-only.

**What's missing — a Material Schedule:**

Each uploaded document needs a delivery profile based on its DocumentType:

| DocumentType | Delivery pattern | When to surface | Pacing constraint |
|-------------|-----------------|----------------|-------------------|
| `READING_PASSAGE` | Pre-session prep | Before the session that covers its TPs | 1 passage per session max (cognitive load) |
| `WORKSHEET` | In-session activity | During guided_practice phase | Aligned to the TPs being taught that session |
| `TEXTBOOK` | Reference (tutor uses) | Across all sessions that cover its chapters | Chapter ordering matters — ch.1 before ch.2 |
| `COMPREHENSION` | In-session + check | Paired: read passage → answer questions | Both parts in same session |
| `QUESTION_BANK` | Assessment phases | check/assess sessions, spread across course | Don't front-load all questions in early sessions |
| `ASSESSMENT` | End-of-module | assess session types | After all related TPs are taught |
| `EXAMPLE` | In-session illustration | During introduce/explain phases | Near the TPs they illustrate |
| `REFERENCE` | Always available | Every session (glossary/cheat sheet) | No pacing — always in context |
| `LESSON_PLAN` | Tutor-only structure | Shapes session flow, not delivered to student | N/A |
| `COURSE_REFERENCE` | Tutor-only rules | Always in `[COURSE RULES]` section | N/A — never student-facing |

**The binding question:** When a teacher uploads a WORKSHEET, which sessions should it appear in?

```
Option A: Follow the TPs — worksheet covers TPs 12-18, those TPs are in sessions 3-4, so worksheet appears in sessions 3-4
Option B: Teacher assigns manually — drag worksheet to session 3
Option C: DocumentType heuristic — worksheets go in guided_practice phases, reading passages go pre-session
```

Currently the system does a weak version of Option A (assertions from the worksheet are round-robin'd, media follows via session scoping). But there's no explicit "this worksheet belongs to session 3" assignment, and no heuristic about WHEN in the session to use it.

**Proposed ContentSchedule (extended with materials):**

```typescript
type ContentSchedule = Map<sessionIndex, {
  pre: {                              // student sees before the call
    readingPassages: MediaAsset[]     // "Read this before our next session"
    prepVocab: ContentVocabulary[]    // "Learn these terms"
  }
  phases: Map<phaseId, {              // tutor uses during the call
    assertions: ContentAssertion[]    // TPs to teach
    questions: ContentQuestion[]      // to quiz with
    media: MediaAsset[]               // to share via share_content
    vocab: ContentVocabulary[]        // terms to introduce
  }>
  post: {                             // student gets after the call
    worksheets: MediaAsset[]          // "Complete this worksheet"
    practiceQuestions: ContentQuestion[] // "Try these before next time"
    reviewAssertions: ContentAssertion[] // key points summary
  }
}>
```

### 3. Content Sufficiency — does each session have enough material?

**Per-TP sufficiency score:**

```
score = hasDefinition(1) + hasExample(1) + hasQuestion(1) + hasVocab(1)  → 0-4
```

A TP with score 0 means the tutor has nothing to work with except the assertion text itself. Score 4 means full support: definition to explain, example to illustrate, question to check, vocab to reinforce.

**Per-session sufficiency:**

| Check | Formula | Concern |
|-------|---------|---------|
| Content coverage | `avgTPScore` across session's TPs | Low = teacher needs to upload more material |
| Question coverage | `questionsInSession / TPsInSession` | <0.5 = not enough to assess properly |
| Material variety | Unique DocumentTypes in session | 1 = monotonous, 3+ = good variety |
| Media availability | Student-visible media count | 0 = voice-only session (may be fine, may not) |

**What exists:** `content-breakdown` endpoint returns TP counts by teachMethod with reviewed/total. `session-assertions` returns unassigned TPs. No per-TP sufficiency score.

### 4. Content Schedule — phase-level timing

**Core concept: within a session, materials have delivery timing relative to phases**

**Mapping rules** (derivable from existing `phaseTemplates` + `tpDistributionHints`):

| ContentAssertion.category | Phase placement | DocumentType affinity |
|--------------------------|----------------|----------------------|
| `definition` | direct_instruction / explain | TEXTBOOK, REFERENCE |
| `worked_example` | guided_practice / elaborate | WORKSHEET, EXAMPLE |
| `rule`, `fact` | direct_instruction | TEXTBOOK, CURRICULUM |
| `process` | guided_practice | WORKSHEET |
| `edge_case` | deepen / elaborate | TEXTBOOK |

| ContentQuestion type | Phase placement |
|---------------------|----------------|
| `RECALL_QUIZ` | check / evaluate |
| `MCQ` | assess |
| `TUTOR_QUESTION` | hook / engage |

| DocumentType (original media) | Phase / timing |
|------------------------------|---------------|
| `READING_PASSAGE` | Pre-session OR hook phase (read together) |
| `WORKSHEET` | guided_practice phase (work through together) OR post-session |
| `COMPREHENSION` | Mid-session: read → discuss → answer |
| `EXAMPLE` | direct_instruction phase (illustrate a point) |

**What exists:** `phaseTemplates[].suitableTeachMethods` and `tpDistributionHints` describe this in prose. `DELIVERY_HINTS` in `teaching-content.ts` give per-DocumentType instructions. `session-assertions` endpoint does session-level filtering. No phase-level filtering exists in code.

---

### 5. Session Count Recommendation

**Formula:**

```
teachingSessions = ceil(totalTPs / maxTpsPerSession)
structuralSessions = 1 (onboarding)
                   + floor(modules / reviewFrequency) if reviewFrequency > 0
                   + 1 (consolidation)
                   + (1 if assessments !== 'none')

recommendedTotal = teachingSessions + structuralSessions
```

**Duration scaling** (not currently modeled):

```
effectiveMaxTPs = maxTpsPerSession × (durationMins / 15)
```

A 10-min voice call can handle ~7 TPs. A 30-min session can handle ~20. This multiplier adjusts the bin size.

**Output shape:**

```typescript
{
  min: number,          // absolute minimum (1 per module + onboarding)
  recommended: number,  // computed optimal
  max: number,          // if every module got deepen + review
  breakdown: {
    onboarding: 1,
    teaching: number,   // introduce + deepen
    review: number,
    assess: number,
    consolidation: 1
  }
}
```

**What exists:** Session count is a hard input. No recommendation or feedback. `distribute-tps.ts` computes `sessionsNeeded` per module but this isn't surfaced to the teacher.

---

### 6. Advisory System — warnings & suggestions

| Check | Inputs | Trigger | Message pattern |
|-------|--------|---------|----------------|
| **Overloaded session** | TP count per session vs maxTPs | >maxTPs in any session | "Session 3 has 14 TPs (max 10) — split or reduce scope" |
| **Thin session** | TP count per session | <3 TPs in any session | "Session 5 has 2 TPs — merge with session 4" |
| **Content gap** | TPs without linked questions/vocab | Any TP with score < 2 | "Module 'Taxation' has 8 TPs but 0 practice questions" |
| **Duration mismatch** | Sum of estimated TP times vs session duration | Estimated time > durationMins × 1.2 | "Session 2 needs ~22 min but sessions are 15 min" |
| **Prerequisite violation** | parentId chain vs session ordering | Child TP in earlier session than parent | "'Calculate VAT' (session 2) requires 'Define VAT' (session 3)" |
| **Uneven distribution** | Sessions-per-module variance | Max/min ratio > 3:1 | "'Law' needs 3 sessions but 'Ethics' needs 1 — rebalance?" |
| **Unassigned TPs** | TPs not matching any session's LO refs | Count > 0 | "12 TPs have no session assignment" |
| **Exam crunch** | High `examRelevance` TPs in final 20% of sessions | Concentration > 40% | "Most exam-relevant TPs are in the last 2 sessions — move earlier" |
| **Material orphan** | Uploaded document with 0 assertions in any session | Source not referenced | "Your 'Chapter 5' PDF isn't used in any session — assign or remove" |
| **No practice material** | Sessions with TPs but 0 questions + 0 worksheets | Teaching without checking | "Sessions 2, 4, 6 have no practice activities — students can't self-check" |
| **Document type gap** | Course has textbooks but no student-facing materials | No WORKSHEET/READING_PASSAGE/EXAMPLE | "All content is tutor-reference only — add worksheets or examples for students" |
| **Material overload** | Session has >3 shareable media items | Too many documents to share in one call | "Session 3 has 5 documents to share — students won't absorb all of them" |

**Severity levels:** `error` (blocks generation) | `warning` (shown to teacher) | `info` (suggestion)

**What exists:** `checkCourseReadiness()` checks content *exists*. `session-assertions` returns `unassigned[]`. No other advisory checks.

---

### 7. What Else — the extended model

| Capability | Value | Complexity |
|------------|-------|-----------|
| **Adaptive replanning** | After each session, recalculate remaining plan based on `CallerModuleProgress.mastery`. Struggling → add deepen. Ahead → skip review. | High — runtime plan mutation |
| **Time estimation per TP** | `definition: 1min, worked_example: 3min, problem_solving: 4min, recall_quiz: 2min`. Sum per session vs `durationMins`. | Low — lookup table |
| **Difficulty curve** | Track mean `depth` per session. Should be a ramp. Flag jumps >1 between consecutive sessions. | Low — arithmetic |
| **Spaced repetition** | Unmastered TPs reappear N sessions later. Ebbinghaus-inspired intervals (1, 3, 7 sessions). | Medium — mastery tracking |
| **Cross-module dependencies** | TPs sharing `topicSlug` across modules imply ordering. Graph analysis to enforce. | Medium — graph traversal |
| **Session preview for student** | Before a call: "Today: X, Y, Z. Please read [passage]. You should know A, B from last session." | Low — reads from ContentSchedule |
| **Teacher override + reflow** | Teacher drags a TP or material to a different session → system reflows downstream respecting constraints. | High — UI + constraint solver |
| **Material gap detection** | "You uploaded a textbook but no worksheets — students won't have practice activities" | Low — DocumentType inventory check |
| **Document chapter pacing** | Textbook has 10 chapters. 8 sessions. Map chapters to sessions using assertion `chapter`/`section` fields. | Medium — chapter extraction + mapping |
| **Homework/prep scheduling** | Automatically assign reading passages as pre-session prep. Generate "before your next session" messages. | Medium — requires student notification path (currently no learner portal) |
| **Content reuse across courses** | Same textbook used in 2 courses → different sessions use different chapters. SubjectSource is already per-course. | Low — already scoped via PlaybookSubject |

---

## The Architectural Shift

```
CURRENT:
  Teacher picks session count → AI generates everything → naive round-robin assigns TPs
  (deterministic code does almost nothing)

PROPOSED:
  Teacher states intent → Deterministic Planner produces constraints + schedule →
  AI fills in pedagogical prose within those constraints
  (AI does the creative work, planner does the structural work)
```

The planner is the **physics engine** of the course. The AI is the **narrator**.

---

## Existing Code to Wire Up

| Asset | Location | Status |
|-------|----------|--------|
| `distributeModuleTPs()` | `lib/lesson-plan/distribute-tps.ts` | Exists, orphaned — needs wiring to generation routes |
| `computeModuleTPStats()` | Same file | Exists, orphaned |
| 5 pedagogical models | `lib/lesson-plan/models.ts` | Active — `maxTpsPerSession`, `phaseTemplates`, `sessionPatternRules` |
| `phaseTemplates[].suitableTeachMethods` | `models.ts` | Active but only used for AI prompt text, not content filtering |
| `ContentAssertion.parentId` | Prisma schema | Stored, never read for ordering |
| `CurriculumModule.prerequisites` | Prisma schema | Stored, never enforced |
| `ContentAssertion.examRelevance` | Prisma schema | Stored, not used in distribution |
| `ContentAssertion.depth` | Prisma schema | Used for round-robin sort, not for spiral passes |
| `checkCourseReadiness()` | `lib/domain/course-readiness.ts` | Active but checks existence, not sufficiency |
| `session-assertions` endpoint | API route | Active — returns `unassigned[]` but no other advisory |
| `DELIVERY_HINTS` | `teaching-content.ts:278` | Per-DocumentType prose hints for AI — could become structured delivery rules |
| `isStudentVisibleDefault()` | `doc-type-icons.ts:153` | Student-visible gate per DocumentType — already codified |
| `SubjectSource.sortOrder` | Prisma schema | Document-level ordering — needs extending to session-level |
| `buildContentCatalog()` | `chat/tools.ts` | Session-scoped media catalog — already filters by lesson plan entry |
| `content-breakdown` endpoint | API route | TP counts by teachMethod — could extend to include sufficiency scores |
