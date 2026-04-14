# ADR: The scheduler owns the plan — sessions are containers, not primitives

**Date:** 2026-04-14
**Status:** Proposed
**Deciders:** Paul W, AI planning session
**Related:** [outcome-graph-pacing.md](2026-04-14-outcome-graph-pacing.md)

## Context

The companion ADR ([outcome-graph-pacing](2026-04-14-outcome-graph-pacing.md)) establishes *what* HF courses are made of: outcomes, content, constraints. This ADR establishes *who decides what happens on the next exchange*: a research-backed policy engine the team will call "the scheduler."

The immediate trigger is the Boaz 2026-04-13 test report, which surfaced several scoring-without-evidence bugs (S1–S4) and a content-mapping bug (B2) that all share a common root cause: **selecting what to teach next is currently a side effect of whatever transform happens to run in the COMPOSE stage**, with no single owner. There is no function you can point at and say "this is where we decided to interleave / space / assess / pick content." The adaptive loop exists conceptually; in code, it is scattered.

The broader pedagogy research also argues for an explicit scheduler:

- **Interleaving** (Rohrer & Taylor) — mixing related skills within a practice block outperforms blocked practice. Requires pool-based selection; impossible under a pre-authored session plan.
- **Spaced repetition** (Ebbinghaus; Duolingo half-life regression) — even "mastered" items decay; re-exposure is a scheduling decision, not a teacher decision.
- **Retrieval practice / testing effect** (Roediger & Karpicke) — recall is stronger than re-reading; when to retrieve is a scheduling decision.
- **Desirable difficulties** (Bjork) — deliberately choosing harder items against fluency creates better long-term retention.
- **Zone of Proximal Development** (Vygotsky) — target "just above current ability"; the "current" depends on per-learner live state, which no upfront plan can capture.
- **Worked-example → faded practice** (Sweller, cognitive load theory) — fading is a per-learner decision.
- **Dual coding** (Paivio) — balancing verbal and visual content is a selection decision.
- **Generation effect** — already enforced at prompt level via the [socratic-guardrail](~/.claude/projects/-Users-paulwander-projects-HF/memory/socratic-guardrail.md); a scheduler makes this uniform across transforms.

Every one of these requires the system to make a selection decision per exchange, balancing multiple factors. A teacher-authored session plan cannot encode all of them; a single transform reading one signal cannot balance them.

## Decision

**Introduce a single, explicit scheduler function** that owns per-exchange selection decisions, replacing the current scatter of ad-hoc logic in transforms.

### Contract

```
selectNextExchange(state, policy) → {
  outcomeId,        // which outcome to work on
  contentSourceId,  // which content to use for it
  mode,             // teach / review / assess / practice
  reason,           // short explanation, for debug panel + logs
}
```

### Policy weights

Selection is a weighted multi-objective decision. Initial defaults (v1):

| Factor | Symbol | Default | Policy that tunes it |
|---|---|---|---|
| Mastery gap (prioritise frontier outcomes) | α | 1.0 | all |
| Spaced-repetition due | β | 0.8 | all |
| Interleave bonus (switch skill vs last exchange) | γ | 0.5 | Interleaved / Comprehension |
| Difficulty targeting (ZPD: +15% above current) | δ | 0.4 | Confidence-build: −5%, Exam-prep: +25% |
| Recently-used penalty | −ε | 0.3 | all |
| Cognitive load penalty | −ζ | 0.2 | all |
| Retrieval-opportunity bonus (older mastered due for test) | η | 0.4 | Revision-heavy |

### Pedagogical presets (bundled policies)

Teachers select a preset in the course wizard; under the hood it adjusts weights. Users do not see raw numbers.

| Preset | When to pick | Policy adjustment |
|---|---|---|
| **Balanced** (default) | General purpose | All default weights |
| **Interleaved** | Skill-based subjects (maths, language, music) | γ ↑, ε ↑, β slightly ↑ |
| **Comprehension** | Reading a book, passage analysis | Sequential content ordering within frontier; interleave *skills* not content; γ ↑ on skill switching |
| **Exam-prep** | Time-boxed syllabus coverage | α ↑ (breadth first), lower mastery threshold, β ↑↑ (retention-focused) |
| **Revision** | Returning student, known material | η ↑↑, β ↑↑, minimal new content |
| **Confidence-build** | Anxious / first-time learners | δ ↓ (easier ZPD), −ζ ↑ (avoid stacking hard items), ε ↑ |

### Where the scheduler runs in the pipeline

The scheduler sits between `AGGREGATE` (which produces the caller's current state) and `COMPOSE` (which assembles the prompt). It produces a `SchedulerDecision` that COMPOSE then reads to prioritise transforms and inject content. COMPOSE transforms stop making selection decisions — they become pure renderers of the scheduler's output.

Existing transforms that currently do ad-hoc selection (`modules.ts` continuous branch, `teaching-content.ts` working-set reader) are refactored to read from the scheduler's output rather than calling `selectWorkingSet` inline.

### Event-gated scoring (bundled with scheduler v1)

The scheduler also owns "when to measure." A skill is only scored by the pipeline if the scheduler asked for it to be assessed this exchange (mode: `assess`) OR if the transcript classifier detects that the skill was genuinely tested (tool call, explicit question tag, high-confidence LLM classification).

This directly fixes Boaz's S1–S4:
- **S1** (vocabulary scored without test) — vocabulary only scores on `mode: assess` or on detected vocab test. Without either, the score stays `null / unassessed`.
- **S2** (evaluation scored from indirect evidence) — same.
- **S3** (recall 0.85 in session 1) — recall only scores when the scheduler deliberately asks the tutor to test prior-session recall. In session 1 this never fires.
- **S4** (template goals marked as per-caller progress) — separate fix in the goal-instantiation path, but the scheduler can refuse to score goals that were never measured.

## Consequences

### Positive

- **Single point of truth** for "what happens next" — easy to reason about, easy to debug, easy to eval
- **Research-backed defaults** apply to every course, for free, without teacher configuration
- **Presets are a soft knob** — teachers express intent ("this is exam prep") not weights
- **Scoring fabrication ends** — every pipeline score traces back to an explicit assessment event
- **Interleaving, spacing, retrieval practice all work** — not just for new courses, retroactively for every course
- **Debuggable** — the scheduler produces a decision trace (`reason`) that can be surfaced in a debug panel for the team to watch live and for evals to assert on
- **Replaces the need for large parts of the upstream UI epic** — no urgent need for the Outcome Graph editor (Phase 5) because the scheduler v1 can operate on the existing goal/module structure

### Negative / Trade-offs

- A new centralised component introduces a single point of failure. The pipeline must fall back gracefully if the scheduler errors (default to "current frontier outcome, no interleave").
- Policy weights are opinionated. Teachers or domain experts may disagree with defaults; presets need room to evolve.
- Requires refactoring the existing `modules.ts` continuous branch to delegate to the scheduler — some churn in a hot code path.
- Debugging a multi-objective scheduler is harder than debugging a single selection function. The decision trace partly mitigates this but adds its own cost.
- Event-gated scoring changes existing pipeline behaviour: some skills that used to get confident scores will now report `null / unassessed`. Dashboards and reports must handle this.

### Compatibility

- Existing courses with stored `sessionCount` are unaffected — the scheduler still produces decisions within the session budget.
- Structured courses (with authored lesson plans) keep running, but the scheduler is consulted inside each session to pick ordering and interleave within that session's TPs.
- Continuous courses (now including all `teachingMode: comprehension` courses per the modules.ts routing fix) run under the scheduler entirely.

## Ship plan

### Phase 1 — Scheduler v1 (this is the story)

- `lib/pipeline/scheduler.ts` — new file with `selectNextExchange(state, policy)`
- Policy presets in `lib/pipeline/scheduler-presets.ts`
- Refactor `modules.ts` continuous branch to delegate to scheduler
- Refactor scoring pipeline to consult scheduler's `mode: assess` before writing scores
- Unit tests per policy + integration test against Boaz-style scenarios
- No UI changes — defaults work from existing `teachingMode`

Estimated: 1 story, ~2–3 days. No schema changes. Single-commit-per-concern.

### Phase 1.5 — Scheduler Decisions debug panel

- Course settings tab: "Pedagogical preset" picker (writes to Playbook.config)
- Course operator tab: read-only "Recent decisions" stream with reason traces
- Caller Progress tab: collapsible "What the scheduler picked this call" panel
- Estimated: 1 story, ~1 day, after Phase 1 ships

### Phase 2 — Event-triggered surveys

Separate ADR and story. Rekeys surveys from session-index to progress events. Depends on scheduler v1 only for the "skill assessment" trigger; other triggers are independent.

## Alternatives considered

### A. Distributed selection logic (current state)

Rejected. This is what we have, and it has produced Boaz's B2, S1, S2, S3, S4 bugs. No single function owns selection; no one knows who to blame; evals cannot target the decision point.

### B. Hand-authored session plans with annotation hints

Rejected. Even if a teacher heroically authored a perfectly interleaved 20-session plan, it cannot respond to per-learner state (ZPD, fluency, anxiety). The *fluidity* is the point.

### C. Pure AI scheduler (let the LLM pick next item)

Rejected for v1. LLM planners are opaque, expensive per exchange, and hard to eval. A deterministic multi-objective scheduler with explicit weights is cheaper, faster, and auditable. An LLM can be a policy *input* (e.g., "this exchange showed confusion, ↓ difficulty") but not the decision function.

### D. Wait for the full outcome-graph (Phases 5–6) before building the scheduler

Rejected. The scheduler delivers most of the pedagogical benefit without requiring the data migration. Operating on the existing Goal/Module structure is good enough for v1, and the abstraction is forward-compatible: when outcomes replace modules in Phase 5, the scheduler's input shape changes but its output shape stays the same.

## Success criteria

1. **Zero fabricated scores** — no CallScore row is written for a skill the scheduler did not request assessment for AND the transcript classifier did not confirm was tested.
2. **Visible interleaving** — in a comprehension course, the scheduler's decision log shows skill-switching ≥ 50% of exchanges within a session.
3. **No regression on structured courses** — existing Year 5 Maths / CFA / A-Level test suites pass unchanged.
4. **Debuggable** — every scheduler decision has a reason string the team can grep or display.
5. **Boaz re-test passes** — S1, S2, S3 no longer produce scores without evidence.

## References

- Rohrer, D. & Taylor, K. (2007). *The shuffling of mathematics problems improves learning.* Instructional Science, 35, 481–498.
- Bjork, R. A. & Bjork, E. L. (2011). *Making things hard on yourself, but in a good way.* In Psychology and the Real World.
- Roediger, H. L. & Karpicke, J. D. (2006). *Test-enhanced learning.* Psychological Science, 17, 249–255.
- Vygotsky, L. S. (1978). *Mind in Society.* Harvard University Press.
- Sweller, J. (1988). *Cognitive load during problem solving.* Cognitive Science, 12, 257–285.
- Settles, B. & Meeder, B. (2016). *A trainable spaced repetition model for language learning.* ACL.
- [A Comparison of Adaptive and Fixed Schedules of Practice — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6028005/)
- Related ADR: [outcome-graph-pacing](2026-04-14-outcome-graph-pacing.md)
- Related memory: [socratic-guardrail.md](~/.claude/projects/-Users-paulwander-projects-HF/memory/socratic-guardrail.md)
- Boaz 2026-04-13 test report (conversation context, ref B1–B3 / S1–S4 / D1–D3)
