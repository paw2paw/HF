# ADR: Outcome-graph pacing — outcomes, not sessions, are the course primitive

**Date:** 2026-04-14
**Status:** Proposed
**Deciders:** Paul W, AI planning session

## Context

HF's course model today requires the teacher to declare `sessionCount`, and the system builds a module→session map that is used as the clock for content selection, surveys, scoring, and journey progress. This breaks in several ways:

1. **Content mapping drift** — Secret Garden Session 1 served Chapter 4's passage because the module→session lookup is non-deterministic when the natural content order (book chapters) and the authored session order diverge. Reported as B2 in the 2026-04-13 Boaz test.
2. **Scoring without evidence** — The pipeline scored COMP_RECALL at 0.85 in a first session, which is logically impossible. The scoring rollup is keyed on session index ("this is session 1, score the session 1 bucket") rather than on whether the skill was actually assessed. Reported as S1–S4.
3. **No universal N** — Confident students and anxious students do not need the same number of sessions to reach mastery. Any fixed `sessionCount` is wrong for someone. The pedagogy research is unambiguous:
   - Mastery learning (Bloom; Kulik meta-analyses) — criterion is fixed, time varies (d ≈ 0.59)
   - Competency-based education — "students proceed at their own pace"
   - Adaptive scheduling beats fixed scheduling in ITS studies (Mettler et al.)
4. **Interleaving requires a pool, not a queue** — Research-backed interleaving (Rohrer & Taylor) cannot operate on a pre-authored session plan because interleaving IS the deliberate crossing of would-be session boundaries.

The existing `learningStructure: structured | continuous` field on `Playbook.config` and `Curriculum.deliveryConfig.lessonPlanMode` both express this tension, but the value is not routed from `teachingMode: comprehension` and is only consumed in two places.

## Decision

**Adopt an outcome-graph pacing model as the target architecture.** In this model:

- **Outcomes are the primitive** — a Course declares a DAG of learning outcomes, each with prerequisites and a mastery criterion.
- **Content is anchored to outcomes** — ContentSources are tagged with the outcomes they serve, plus an ordering mode (`sequential | pool | spaced`).
- **Sessions are containers, not plans** — a session is an operational unit (one call) tracked by the system for audit and analytics. The teacher never authors or counts sessions.
- **Session count is derived** — shown as a live forecast (`ceil(remaining_outcomes × avg_exchanges ÷ session_capacity)`), never stored as a declaration. Where an existing playbook has a stored `sessionCount`, it is honoured as a soft budget upper bound, not a plan.
- **Teacher surface shrinks** — the wizard asks for outcomes, content, constraints (call duration, optional time window, optional budget), and a pedagogical preset. It no longer asks "how many sessions" or generates a lesson plan.

## Teacher-declared vs system-derived

| Teacher declares | System derives |
|---|---|
| Outcomes with mastery criteria | Order of outcomes on the frontier (scheduler) |
| Content sources + outcomes they serve + ordering | Which content to use for the next exchange |
| Constraints: call duration, exam date, session budget | Pacing forecast, estimated finish |
| Pedagogical preset (Interleaved / Blocked / Comprehension / Exam prep / Confidence-building) | Policy weights on the scheduler |

## When a teacher legitimately specifies N sessions

Three cases, all operational, none pedagogical:

1. **Commercial** — "I'm selling a 10-session package." Honoured as a billing budget.
2. **Time-boxed** — "Exam in 8 weeks, 2 calls/week." Honoured as a derived upper bound.
3. **Imported structure** — "University has 12 lectures." Imported as 12 containers; the lectures *are* the outcomes.

In all three, N is a constraint, not a design primitive.

## Surveys and assessments without a session plan

Rekey triggers from `session_index` to **progress events**:

| Today | Tomorrow |
|---|---|
| Pre-survey on session 1 | `first_exchange_complete` |
| Mid-survey on session ⌈N/2⌉ | `outcomes_mastered ≥ 0.5 × total` |
| Post-survey on session N | `all_outcomes_mastered ‖ budget_exhausted` |
| Skill assessment every session | `skill_not_measured_for ≥ threshold` OR `skill_score_uncertain` |
| Check-in on fixed sessions | `calls_since_last_checkin ≥ N` |

Same behaviour for existing structured courses (triggers fire at roughly the same times as today) but the mechanism generalises to continuous courses.

## Mapping to what HF already has

| Existing | Maps to | Status |
|---|---|---|
| `Goal` | Outcome | ✅ already per-caller, already has progress |
| `ContentSource.orderIndex` | Sequential content ordering | ✅ already works |
| Pipeline scoring | Mastery measurement | ✅ works, needs event-gating |
| `learningStructure`, `lessonPlanMode: continuous` | Collapse into `orderingMode` + `pacingMode` + preset | 🟡 the right shape, too coarse |
| `Module` table | Collapse into Goals + ContentSource ordering | 🔴 deprecation plan needed |
| `sessionCount` required | Optional soft-cap budget | 🔴 wizard asks for it today |
| Survey triggers keyed to session index | Progress-event triggers | 🔴 needs new SurveyTrigger layer |
| `teachingMode: comprehension` | Orthogonal — *how the tutor behaves in-call*, independent of pacing | ✅ keep, don't conflate |

## Consequences

### Positive

- Resolves the B2 content-mapping bug at the model level — no "which session is module 3?" ambiguity exists
- Resolves the S1–S4 scoring-without-evidence class of bugs — scores only occur on assessed events
- Matches pedagogy research (mastery, CBE, adaptive scheduling)
- Teacher cognitive load drops — removes the impossible "how many sessions?" question
- Interleaving becomes feasible as a policy (blocked-practice fallback also stays available)
- Enables the AI TA direction (memory items #52–#55) cleanly — per-student skill modelling *is* the outcome-progress model
- The existing [socratic-guardrail](~/.claude/projects/-Users-paulwander-projects-HF/memory/socratic-guardrail.md) (generation effect) becomes a scheduler policy, not a prompt-text hack

### Negative / Trade-offs

- Replaces the most-used operator surface (Course Journey tab) — currently an editable session rail, becomes an observation timeline
- Requires a new Outcome Graph editor UI to replace the module editor (Phase 5 epic)
- Data migration: Module → Outcome transforms every existing course
- "Estimated N sessions" is less reassuring for teachers than "planned N sessions" — UX copy and affordances need work
- Accountability for content coverage moves from per-session plan to per-outcome mastery check — different reporting shape

### Migration risk

- Existing playbooks with stored `sessionCount` continue to work: treated as a soft upper bound during transition
- Old Module-based curricula continue to render through a compatibility layer until Phase 6
- Surveys keyed to session index continue to fire on the equivalent progress events — no behavioural change for structured courses

## Phased adoption

| Phase | Scope | UI impact | Ships |
|---|---|---|---|
| 0 | Narrow Boaz unblock: trim guards + `teachingMode: comprehension → continuous` routing in modules.ts | None | Today |
| 1 | Scheduler v1: interleaving + spacing + event-gated scoring. Policy defaults per `teachingMode`. | None visible | Next sprint |
| 2 | Event-triggered surveys (replace session-index keying with progress events) | SurveyTrigger table, seed changes | Next sprint |
| 3 | Hero + caller EnrollmentJourney: `sessionCount` → live forecast. Field becomes optional soft-cap. | Hero chip, EnrollmentJourney, wizard step 3 | Following sprint |
| 4 | Scheduler Decisions debug panel + pedagogical preset picker | New tab, Settings enhancement | Following sprint |
| 5 | Outcome Graph DAG editor — replaces Curriculum tab authoring. Goals merge. | Curriculum → Outcomes tab | Epic — dedicated sprint |
| 6 | Module → Outcome data migration; deprecate Module table; transform Learners grid and Caller Progress tab | All progress surfaces, Prisma schema | Epic — follow-up sprint |

Phases 1–4 deliver most of the pedagogical win without touching the data model or the biggest UI surfaces. Phases 5–6 are deferred until the scheduler has proven itself on real usage data.

## Alternatives considered

### A. Keep the session-plan model, patch the bugs case-by-case

Rejected. Every test run has surfaced a new symptom of the same root cause (session index as the clock). Fixing each symptom accumulates tech debt and leaves interleaving, spacing, and event-gated scoring impossible.

### B. Introduce a second flag (`curriculumShape: linear | modular`) without changing the primitive

Rejected as insufficient. The scheduling axis, content-ordering axis, and pacing axis are all distinct. A single binary conflates them again and reproduces the `learningStructure` problem at a different level.

### C. Full rewrite now (all phases in one epic)

Rejected. Too big. Phases 5–6 require data migration and a new authoring surface; shipping them in one push blocks the whole team for weeks and cannot be incrementally validated. Phase 1 (scheduler v1, no UI) is the high-leverage, low-risk opening move.

## References

- [Mastery learning — Wikipedia](https://en.wikipedia.org/wiki/Mastery_learning)
- [A Practical Review of Mastery Learning — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10159400/)
- [A Comparison of Adaptive and Fixed Schedules of Practice — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6028005/)
- [Khan Academy: How do mastery levels work?](https://support.khanacademy.org/hc/en-us/articles/5548760867853--How-do-Khan-Academy-s-Mastery-levels-work)
- [Competency-Based Education Guide — Research.com](https://research.com/education/competency-based-education)
- [Duolingo: A Trainable Spaced Repetition Model](https://research.duolingo.com/papers/settles.acl16.pdf)
- Rohrer, D. & Taylor, K. (2007). *The shuffling of mathematics problems improves learning.* Instructional Science.
- Bjork, R. A. (1994). *Memory and metamemory considerations in the training of human beings.* MIT Press.
- Related ADR: [learning-measurement-by-profile.md](learning-measurement-by-profile.md)
- Related ADR: [2026-04-06-align-comprehension-measurement-with-pirls-ks2.md](2026-04-06-align-comprehension-measurement-with-pirls-ks2.md)
