# Journey Rail Redesign — Open Questions

**Date:** 1 April 2026
**Context:** Boaz's partner review confirmed the Journey Rail approach but changed 5 design points. Three changes are clear and shipped. Two changes plus three new features need decisions before we can build them.

---

## Already Done

- **Pre-survey is mandatory** — students cannot skip the pre-survey (onboarding data).
- **Surveys sit outside sessions** — pre before first session, post after last, mid optional between.

---

## Questions for Boaz

### 1. First Call — what replaces it?

Today the system auto-adds a "First Call" stop and uses it to trigger personalisation: loading the welcome message, setting the tutoring style, running the get-to-know-you flow. If educators build all sessions themselves, how does the system know which session is the student's first real interaction?

**Options:**
- **A) Educator tags one session as "First Call"** — a toggle on any session. System runs the personalisation flow on that session. Simple, explicit.
- **B) System treats session 1 as the first call automatically** — whatever the educator puts first gets the personalisation flow. No tagging needed.
- **C) Deprecate first-call-specific behaviour entirely** — the AI always personalises based on available data, no special first-call mode. Simpler system, but loses the structured welcome flow educators currently see.

**Our recommendation:** Option B. Least educator effort, keeps the welcome flow working.

### 2. Knowledge checks — what happens when a student gets it wrong?

Multiple choice questions can now have a correct answer (knowledge checks vs opinion questions). But what should happen when the student picks the wrong answer?

**Options:**
- **A) Log and continue** — record the answer, move on. The AI knows they got it wrong and can adapt teaching.
- **B) Show correct answer, then continue** — brief feedback ("Actually, mitosis is cell division"), then move on.
- **C) Block until correct** — student must pick the right answer before proceeding. Feels like a gate.

**Our recommendation:** Option A. The pre-survey is about measuring where students are, not testing them. Wrong answers are useful data, not failures.

### 3. Personalisation flag — what's a "section"?

Boaz wants educators to flag which survey answers feed into AI personalisation vs reporting only. He mentioned this should work "per question and per section." What does "section" mean here?

**Options:**
- **A) Survey-level toggle** — the whole pre/mid/post survey is either for personalisation or reporting. Simple but coarse.
- **B) Question group** — surveys can have named groups (e.g. "About You", "Knowledge Check", "Feedback"). The toggle applies to the group. Educator can override per-question within.
- **C) Per-question only** — no section concept. Each question has its own toggle. Most granular but more clicks for educators.

**Our recommendation:** Option B. Matches how educators think about surveys ("the onboarding questions feed the AI, the measurement questions are for us").

### 4. Journey validation — what are the rules?

The system should flag when a course journey doesn't make sense. But "makes sense" needs definition.

**Proposed rules (confirm or change):**
1. Course must have at least 2 sessions
2. First session should be introductory (Learn type, not Assessment)
3. Assessment/Review sessions shouldn't appear before any Learn sessions
4. Last session should be reflective (Review type, not Learn)
5. No empty/unconfigured sessions
6. Pre-survey must be enabled (it's mandatory per Boaz)

**What level of enforcement?**
- **Warning only** — flags issues, educator can publish anyway
- **Soft block** — flags issues, educator must acknowledge before publishing
- **Hard block** — cannot publish until all rules pass

**Our recommendation:** Soft block. Educators know their context better than rules do, but they should see the flags.

### 5. Last Call — same question as First Call

If First Call is no longer pinned, Last Call has the same issue. Today it triggers the offboarding flow (summary, feedback, next steps). Should we:
- **A) Educator tags a session as "Last Call"** — same as First Call decision
- **B) System treats the final session automatically**
- **C) Deprecate offboarding-specific behaviour**

**Our recommendation:** Match whatever we decide for First Call.

---

## Impact on Timeline

| If decided this week | Effort | Can ship by |
|---------------------|--------|-------------|
| Questions 1 + 5 (First/Last Call) | 2h spike + 4h build | End of week |
| Question 2 (knowledge checks) | 3h | 2 days |
| Question 3 (personalisation flag) | 2h spike + 3h build | 3 days |
| Question 4 (validation rules) | 4h | 2 days |

**Total:** ~18h of work once decisions are made. None of this blocks the market test — the current journey rail works, these are improvements.
