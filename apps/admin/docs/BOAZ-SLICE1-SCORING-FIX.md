# Scoring Fix — What Changed and How to Test It

**Environment:** dev.humanfirstfoundation.com
**Deployed:** 2026-04-14
**Issue:** [#154](https://github.com/paw2paw/HF/issues/154) — Scheduler v1 Phase 1

---

## What you reported

In your last comprehension-session review, you flagged four issues:

| # | What you saw | Why it was wrong |
|---|---|---|
| S1 | `COMP_VOCABULARY` scored 0.85 | No vocabulary question was ever asked in that session |
| S2 | `COMP_EVALUATION` scored 0.8 | Evaluation was never directly tested |
| S3 | `COMP_RECALL` scored 0.85 in Session 1 | Impossible — nothing to recall yet |
| S4 | Goals were template-seeded, not extracted | Separate issue, not in this fix |

S1–S4 all share a root cause: **the tutor was rating the student on skills that were never assessed in the conversation.**

---

## What we changed

We added an **event-gate** between the tutor session and the scoring pipeline. The rule is now:

> No skill gets scored unless the scheduler decided, at the end of the *previous* call, that the *current* call should assess that skill.

In plain English:

- A **teach** session generates no skill scores. You can't mark a student on vocabulary if you never asked them about vocabulary.
- An **assess** or **practice** session generates scores as normal.
- A **review** session generates no scores (review isn't measurement).

The decision is written at the end of each call and read at the start of the next one — same mechanism we already use for carry-forward teaching points.

---

## What you'll see on DEV right now

Slice 1 is the minimum-viable version. The full scheduler that *picks* assess/teach/review modes lands in Slices 2 + 3 ([#155](https://github.com/paw2paw/HF/issues/155), [#156](https://github.com/paw2paw/HF/issues/156)). Until those land, Slice 1 behaves conservatively:

| Course mode | First call | Subsequent calls |
|---|---|---|
| **Continuous** (comprehension, exam-prep) | Scores normally | **No skill scoring** until Slice 2 picks assess mode |
| **Structured** (fixed lesson plan) | Scores normally | Scores normally — unchanged |

So today on DEV, a continuous-mode learner will:
1. Complete call #1 → get scored (first call, nothing to gate on)
2. Complete call #2 onwards → receive `0 scores, gated: true` in the pipeline result

**This is intentional.** It's the "safer to score nothing than to score garbage" mode. The bogus 0.85 vocabulary scores are gone. Real scoring comes back when the scheduler lands.

---

## How to verify it works

### Quick check (1 min)

1. Log in to [dev.humanfirstfoundation.com](https://dev.humanfirstfoundation.com)
2. Open a **continuous-mode** course (any comprehension course)
3. Go to `/x/sim` and pick a caller on that course
4. Run a practice call → complete it → check the pipeline result panel
   - **Call 1:** expect `scoresCreated > 0`
   - **Call 2+:** expect `scoresCreated: 0` and `gate.reason: "prior decision mode=teach — no assessment evidence, skipping caller scoring"`

### Full walkthrough (5 min)

1. Create a fresh caller on a comprehension course (so they have no prior history)
2. Run call #1 — teach session, complete normally
3. In the pipeline result for that call, check the `EXTRACT` stage output:
   - `scoresCreated` should be > 0
   - The `scheduler:last_decision` CallerAttribute now contains `{mode: "teach", ...}`
4. Run call #2 — teach session again, complete normally
5. Pipeline result for call #2:
   - `scoresCreated: 0`
   - `callerAnalysisGated: true`
   - `gate.mode: "teach"`
   - Log line: `EXTRACT caller-scoring gated: prior decision mode=teach...`
6. The comprehension skill scores that used to appear (COMP_VOCABULARY, COMP_RECALL, COMP_EVALUATION) — gone.

### Structured-mode regression check (1 min)

Run a call on a **structured-mode** course (lesson-plan courses). Scoring should be unchanged — full caller analysis runs on every call, same as before. If structured mode starts skipping scores, that's a bug — flag it.

---

## What happens next

- **Slice 2** (#155, ~6h): the real scheduler. Picks between teach / review / assess / practice using research-backed policy weights (interleaving, spaced repetition, ZPD, cognitive load). Once this lands, continuous-mode courses will start getting real assessment scores again — but only when a call is actually an assessment.

- **Slice 3** (#156, ~4h): integration test that drives a 5-call continuous course and verifies the mix: roughly 2 teach / 1 review / 1 assess / 1 practice under the `BALANCED` preset.

Combined estimate: ~10 hours. I'll ping you when Slice 2 ships so you can test continuous-mode scoring with the real scheduler.

---

## Escape hatch (if needed)

If Slice 1's strictness causes a problem before Slice 2 lands — e.g. you *do* want scoring on a continuous-mode course for a specific demo — we can flip an env var on DEV:

```
SCHEDULER_SLICE1_PLACEHOLDER_MODE=assess
```

That makes every continuous-mode call score as if it were an assessment. Not recommended for real evaluation (scores will still be noisy for teach-mode sessions), but useful as a short-term override. Ask me if you need it.

---

## Questions to watch for

1. **Does the first call of a brand-new caller score correctly?** It should — no prior decision means the gate allows.
2. **Does a structured-mode course still score every call?** It should — no decision is ever written in structured mode, so the gate always allows.
3. **Do you see the old bogus comprehension scores on any continuous-mode call other than call #1?** You shouldn't. If you do, that's a bug — grab the callId and ping me.
4. **Do you notice anything *else* breaking** — artifacts not generated, sessions not advancing, memories not extracted? These should all still work. The gate only blocks skill scoring, nothing else in the pipeline.

---

**Tracking:** #154 parent, [#155](https://github.com/paw2paw/HF/issues/155) Slice 2, [#156](https://github.com/paw2paw/HF/issues/156) Slice 3
**Commit:** `3d12a028`
**Revision:** `hf-admin-dev-00250-v7q`
