# ADR: Survey Rethink — From Rail to State Machine

**Date:** 2026-04-16
**Status:** Accepted (phase 1 in progress)
**Deciders:** Paul

## Context

Students hit 5 separate touchpoints before their first learning moment: join page, onboarding wizard (4-step UI), personality survey (6 questions), pre-test MCQs, and an onboarding voice call. Goals are asked twice (wizard + survey). Welcome is said twice (wizard + AI call). Three of the six personality questions (learning_style, pace_preference, interaction_style) are collected but never consumed by prompt composition — the pipeline infers personality traits from conversation analysis instead.

Additionally, the journey rail (a linear positional list of stops) was designed for structured courses with fixed session counts. Continuous/scheduler-driven courses bypass the rail entirely, meaning surveys never fire.

## Decision

### Phase 1: Course Setup UX (this sprint)
- **Kill mid-survey** — off by default, no consumers, dead weight
- **Trim personality questions** — drop 3 unused questions, keep confidence + goal + motivation
- **Add student experience config to wizard** — wizard currently hardcodes survey defaults; make it ask the educator
- **Design tab on course page** — visual editor for ongoing student experience configuration

### Phase 2: Student Journey (future sprint)
- **Replace the journey rail with a 4-state machine**: `WELCOME -> LEARNING -> NPS -> COMPLETE`
- Lesson plan entries remain for educator view + prompt composition, but student navigation becomes state resolution
- Offboarding becomes prompt guidance only (via `isFinalSession`), not a separate navigation stop
- NPS triggered by mastery threshold, not positional on the rail
- Same logic for structured and continuous mode — no special-casing

### Config shape (shared by wizard + Design tab)
```typescript
interface WelcomeConfig {
  goals:          { enabled: boolean };  // default: true
  aboutYou:       { enabled: boolean };  // default: true
  knowledgeCheck: { enabled: boolean };  // default: false
  aiIntroCall:    { enabled: boolean };  // default: false
}

interface NpsConfig {
  enabled: boolean;                      // default: true
  trigger: "mastery" | "session_count";  // default: "mastery"
  threshold: number;                     // default: 80 (%)
}
```

## Rationale

- **Kirkpatrick model**: L1 (satisfaction/NPS) is orthogonal to L2 (learning/MCQs). Both needed, but delivered differently.
- **Testing effect research**: Threaded MCQs are more effective than separate pre/post tests (d=0.5-0.7).
- **Pre-test persistence risk**: Pre-tests negatively affect persistence in MOOCs (Zheng et al., 2020).
- **Personality data disconnect**: Survey collects VARK-style preferences; composition reads pipeline-inferred Big Five. Different data entirely.

## Consequences

- Existing students with old survey data keep their CallerAttribute rows — admin views still render them
- Pre-test and post-test kept for market test (belt-and-braces with threaded MCQs)
- Continuous mode will gain survey support via state machine (Phase 2)
- `applyAutoIncludeStops()` simplifies to just numbering teaching entries (Phase 2)
- `journey-position/route.ts` rail walker replaced with ~30-line state resolver (Phase 2)

## Related

- [#171](https://github.com/paw2paw/HF/issues/171) — Survey System Rethink issue
- `docs/decisions/journey-rail-open-questions.md` — earlier design questions (superseded by this ADR)
