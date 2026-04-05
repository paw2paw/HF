# Learning Measurement by Teaching Profile

**Date:** 2026-04-05
**Status:** Approved — epic planned, not yet implemented

## Two Ways to Measure Learning

```
┌─────────────────────────────────────────────────────────────┐
│                    PATH A: TEST-BASED                       │
│                  (knowledge courses)                        │
│                                                             │
│   ┌──────┐    ┌──────────┐    ┌──────────┐    ┌─────────┐  │
│   │ Join │───▶│ Pre-test  │───▶│ Sessions │───▶│Post-test│  │
│   └──────┘    │  MCQs     │    │          │    │  MCQs   │  │
│               └──────────┘    └──────────┘    └─────────┘  │
│                    40%                            85%       │
│                    ├──────── 45% uplift ──────────┤        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 PATH B: SESSION-EMBEDDED                    │
│               (non-knowledge courses)                       │
│                                                             │
│   ┌──────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│   │ Join │───▶│Session 1  │───▶│Session 2 │───▶│Session N │ │
│   └──────┘    │ score: 0.2│    │score: 0.4│    │score: 0.7│ │
│               └──────────┘    └──────────┘    └──────────┘ │
│                    ├──── trajectory over time ────┤         │
└─────────────────────────────────────────────────────────────┘
```

## Which Profile Gets What

```
                        Pre-test    Session scoring    Post-test
                        ────────    ──────────────     ─────────
 recall-led        ✅ MCQs        module mastery      ✅ MCQs
 practice-led      ✅ MCQs        module mastery      ✅ MCQs
 syllabus-led      ✅ MCQs        module mastery      ✅ MCQs
                        ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
 comprehension-led   ⏭ skipped     COMP_* scores      ✅ MCQs (optional)
 discussion-led      ❌ none       DISC_* scores       ❌ none
 coaching-led        ❌ none       COACH_* scores      ❌ none
```

**Key insight:** The two paths are additive. Knowledge courses already get session scoring from the pipeline — session-embedded measurement just adds *learning outcome* scoring for courses that can't use pre/post tests.

## Learner Journey by Course Type

```
KNOWLEDGE COURSE
  Join → Survey → 📝 Pre-test → 🎓 Sessions → 📝 Post-test → Done
                  ▲                                ▲
                  └────── compare scores ───────────┘

COMPREHENSION COURSE
  Join → Survey → 🎓 Sessions (COMP_* scored each call) → 📝 Post-test (optional) → Done

DISCUSSION / COACHING COURSE
  Join → Survey → 🎓 Sessions (DISC_*/COACH_* scored each call) → Done

RETURNING LEARNER (any course)
  Sign in → Resume from last stop → Sessions continue (pipeline scores each call)
```

## Session-Embedded Score Types

| Profile | Scores extracted per session |
|---------|----------------------------|
| **comprehension-led** | COMP_THEME · COMP_INFERENCE · COMP_EVIDENCE · COMP_RECALL |
| **discussion-led** | DISC_PERSPECTIVE · DISC_ARGUMENT · DISC_SHIFT · DISC_REFLECTION |
| **coaching-led** | COACH_CLARITY · COACH_ACTION · COACH_AWARENESS · COACH_FOLLOWUP |

## Decision Record

- **2026-04-05 (Boaz):** Comprehension courses skip pre-tests. Measurement embedded in sessions.
- **2026-04-05 (Implementation):** Comprehension MCQs tagged `assessmentUse: POST_TEST`. Pre-test builder excludes them.
- **2026-04-05 (Epic):** Session-Embedded Learning Measurement — 3 non-knowledge profiles, same pipeline infra, different specs. ~19h, 5 stories.
