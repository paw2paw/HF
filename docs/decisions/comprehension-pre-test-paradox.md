# Comprehension Pre-Test Paradox

**Status:** Resolved — comprehension MCQs tagged POST_TEST only
**Date:** 2026-04-05
**Context:** English Comprehension course (Secret Garden 1001)

## The Problem

Pre-tests are designed to measure what a student knows **before** they start a course. This works well for knowledge-based subjects:

- "What is photosynthesis?" — testable before teaching
- "Name three causes of WW1" — testable before teaching
- "What does `O(n)` mean?" — testable before teaching

But for **comprehension-led courses**, the content IS the passage. The student hasn't read it yet. Our system currently generates MCQs from TUTOR_QUESTIONs that reference specific text — creating an impossible pre-test.

## Live Example: Secret Garden 1001

These are the actual pre-test questions generated for the Secret Garden comprehension course:

| # | Question | Bloom | Skill | The problem |
|---|----------|-------|-------|-------------|
| 1 | "How is Mary feeling when the men find her, based on the text?" | UNDERSTAND | Inference | Student hasn't read the text |
| 2 | "What is happening at the beginning of the passage?" | REMEMBER | Retrieval | Which passage? They haven't seen it |
| 3 | "What is the writer's primary intention regarding the reader's feelings toward Mary?" | EVALUATE | Evaluation | Can't evaluate writing intent without reading |
| 4 | "Why does the writer include the detail about the snake?" | UNDERSTAND | Inference | What snake? They haven't read this |

Every question assumes the student has already read the passage. As a pre-test, this is meaningless — students would score near-zero not because they lack comprehension skills, but because they lack access to the source material.

## Why It Happens

The MCQ generation pipeline has two paths:

1. **Assertion path** (knowledge courses) — generates bloom-distributed questions from content assertions (facts). Works for pre-test because facts can be known beforehand.
2. **Comprehension path** — converts TUTOR_QUESTIONs (which have model responses at Emerging/Developing/Secure tiers) into MCQs. These TUTOR_QUESTIONs are inherently passage-dependent.

The comprehension path produces excellent **post-test** questions (after the student has studied the text), but they're useless as **pre-test** questions.

## Options

### A. Skip pre-test for comprehension courses
If `teachingProfile === 'comprehension-led'`, don't generate pre-test MCQs. The student goes straight into teaching. Post-test still works (generated after they've read the passage).

- **Pro:** Simple, honest, no misleading data
- **Con:** No baseline measurement for comprehension courses, can't show uplift

### B. Generate passage-independent skill questions
For comprehension courses, generate a short unseen paragraph + questions that test the same skills (inference, retrieval, vocabulary, evaluation) but on neutral content the student CAN read.

- **Pro:** Genuine baseline of comprehension ability
- **Con:** Significantly harder to generate well, the unseen paragraph needs to be age-appropriate and unrelated to the course content

### C. Use the pre-test as a "diagnostic after first read"
Reframe the pre-test: don't serve it before session 1, but after the student's first reading of the passage (before any teaching). This measures raw comprehension before tutoring intervention.

- **Pro:** Questions make sense, measures genuine starting point
- **Con:** Requires a "read the passage first" step before pre-test, changes the journey flow

### D. Tag questions with `assessmentUse: POST_ONLY`
Keep generating comprehension MCQs but mark them as post-test only. Pre-test slot stays empty for comprehension courses.

- **Pro:** Clean separation, questions still useful for post-test
- **Con:** Same as A for the pre-test gap

## Question for Boaz

For comprehension-led courses like Secret Garden:

1. Do we need a pre-test at all? If so, what would it measure?
2. Is option C viable — give the passage first, then test before tutoring?
3. Or should comprehension courses simply not have a pre/post uplift metric?
