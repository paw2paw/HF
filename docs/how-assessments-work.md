# How Assessments Work

> MCQ generation, selection, and delivery — for comprehension and non-comprehension courses.

---

## Overview

Every course can have automatically generated multiple-choice assessments. The system:

1. **Generates** MCQs from extracted content (or extracts them directly from test papers)
2. **Selects** a subset for each assessment point (pre-test, mid-test, post-test)
3. **Delivers** them in a chat-like interface before or after teaching sessions
4. **Scores** answers and measures learning uplift (post-test score minus pre-test score)

The generation strategy differs based on the course's **teaching profile** — comprehension-led courses (reading/literacy) use a different approach from knowledge-based courses.

---

## When Are MCQs Generated?

MCQs are generated **automatically after content extraction** — no manual step required.

```
Document uploaded
     |
  Extracted (Content Assertions created)
     |
  maybeGenerateMcqs() fires automatically
     |
  Guards check:
     - Does this source already have MCQs? (skip if yes)
     - Is it linked to a course? (skip if orphan)
     - Is it a QUESTION_BANK or COURSE_REFERENCE? (skip — excluded types)
     |
  Generate 8 MCQs per source
     |
  Validate + save as ContentQuestion records
```

### Which document types produce MCQs?

| Document Type | MCQ Behaviour |
|---|---|
| Textbook, Curriculum, Worksheet, Reading Passage, Reference, Example, Lesson Plan, Policy Document | **Auto-generated** from extracted assertions |
| Comprehension | **Auto-generated** using comprehension skill prompts |
| Assessment (test papers) | **Directly extracted** — the AI parses existing questions from the paper |
| Question Bank | **Excluded from direct generation** — contains only tutor-facing questions (with tiered model responses). These tutor questions are used as *source material* to generate higher-quality MCQs on sibling content sources (see "From a Question Bank" below) |
| Course Reference | **Excluded** — teacher guidance, not student content |

---

## Two Generation Strategies

### Non-Comprehension Courses (Knowledge-Based)

Used for: professional qualifications, history, science, most subjects.

**Strategy: Bloom's Taxonomy Distribution**

The AI generates questions distributed across cognitive levels:

| Bloom Level | Target % | Example |
|---|---|---|
| REMEMBER | 25% | "Which year did the Factory Act pass?" |
| UNDERSTAND | 25% | "Why was the Factory Act significant for child workers?" |
| APPLY | 25% | "Given this scenario, which regulation would apply?" |
| ANALYZE | 25% | "Compare the impact of the 1833 and 1844 Factory Acts" |

- Mix target: ~75% multiple choice, ~25% true/false
- Each question tagged with its `bloomLevel` for later selection
- Questions must be **self-contained** — no references to "the passage" or "the text"

### Comprehension Courses (Reading/Literacy)

Used for: KS2 reading, PIRLS-aligned literacy, language comprehension.

**Two paths, depending on available content:**

#### Path A: From a Question Bank (highest fidelity)

A **Question Bank** is a teacher-authored document containing open-ended tutor questions — each with three tiers of expected student responses (Emerging, Developing, Secure) and recommended tutor moves. These are **not student-facing questions** — they're guidance for the AI tutor.

However, when a Question Bank exists with 3+ tutor questions, the system uses those tiered responses as raw material to generate high-quality student MCQs:

```
Tutor's open-ended question: "Why did the character feel anxious?"
     |
  Secure response    -->  Correct answer
  Emerging response  -->  Misconception distractor (common misunderstanding)
  Developing response -> Partial-truth distractor (incomplete understanding)
  AI generates        -> 1-2 additional distractors
     |
  = MCQ with pedagogically meaningful wrong answers
```

This produces the highest quality MCQs because the distractors are grounded in real proficiency-level differences, not random wrong answers. The MCQs are saved against the reading passage source, not the Question Bank itself.

#### Path B: From Assertions (fallback)

If no Question Bank exists, questions are distributed across **6 PIRLS/KS2-aligned comprehension skills**:

| Skill Ref | Skill | Example question type |
|---|---|---|
| SKILL-01 | Retrieval | "What did the character do after...?" |
| SKILL-02 | Inference | "Why do you think the author chose...?" |
| SKILL-03 | Vocabulary | "What does the word '___' mean in this context?" |
| SKILL-04 | Language Effect | "What effect does the metaphor create?" |
| SKILL-05 | Evaluation | "Do you agree that the ending is effective?" |
| SKILL-06 | Recall | "What happened at the beginning of the story?" |

All questions must embed any necessary context — no "refer to paragraph 3" without including the text.

---

## Quality Validation

Every generated MCQ passes through a validation pipeline before being saved:

| Check | What it catches |
|---|---|
| **Structure** | Must have exactly 1 correct answer, at least 4 options for MCQ type |
| **Framework filter** | Strips rubric/assessment-framework language that leaked into questions |
| **Option length** | Flags when the correct answer is noticeably longer than distractors |
| **Distractor similarity** | Flags when two distractors are too similar |
| **AI review** (optional) | Second AI pass flags arguably-correct distractors, reading level mismatches, giveaway patterns |

Questions that fail structural validation are discarded. AI review flags are stored but never auto-applied — an educator can review them.

---

## How Questions Are Selected for Tests

When a learner reaches an assessment point, the system selects a subset of questions. Default: **5 questions per test**.

### Selection Strategies

| Strategy | Used when | How it works |
|---|---|---|
| **Bloom spread** | Non-comprehension courses (most common) | Round-robin across levels: UNDERSTAND first, then ANALYZE, REMEMBER, EVALUATE, APPLY, CREATE |
| **Skill spread** | Comprehension mid/post-tests | Round-robin across the 6 comprehension skills |
| **One per module** | Legacy fallback | One question per curriculum module |
| **Random** | Last resort | Shuffle and pick |

The system automatically chooses the best strategy based on available question metadata.

---

## Assessment Points in the Learner Journey

### Non-Comprehension Courses

```
[Onboarding]
     |
[PRE-TEST] -----> 5 MCQs (Bloom spread)
     |
[Session 1]
[Session 2]
  ...
[Session N]
     |
[POST-TEST] ----> Same 5 questions as pre-test
     |              Score compared to pre-test = UPLIFT
[Offboarding]
```

- **Pre-test** is enabled by default
- **Post-test** reuses the exact same question IDs to measure learning gain
- Uplift = post-test score - pre-test score

### Comprehension Courses

```
[Onboarding]
     |
[Session 1]
[Session 2]
  ...
[~Halfway point]
     |
[MID-TEST] -----> 5 MCQs (Skill spread, from POST_TEST pool)
     |
[Session N-1]
[Session N]
     |
[POST-TEST] ----> 5 MCQs (Skill spread, independent selection)
     |
[Offboarding]
```

- **Pre-test is skipped** by default (comprehension skills are harder to pre-assess without passage context)
- **Mid-test** is enabled, placed after the halfway session
- Mid and post-tests draw from a separate question pool (tagged `POST_TEST` or `BOTH`)
- Each test selects independently — they are not the same questions

---

## How Assessments Are Delivered

Assessments appear in a **chat-like interface** (ChatSurvey), not as a separate test page. The experience feels conversational:

```
 AI:  "Before we start, let's see what you already know!
       Here's your first question:"

 AI:  Which territory was known as the "jewel in the crown"
      of the British Empire?

      [A] Canada
      [B] Australia
      [C] India           <-- learner taps
      [D] South Africa

 AI:  "Correct! India was considered the most valuable
       territory due to its resources and trade routes."

 AI:  "Great start! Here's question 2..."
```

Features:
- Inline correct/incorrect feedback after each answer
- Explanation shown for correct answers (if available)
- Streak encouragement ("3 in a row!")
- Results stored per-learner for progress tracking

---

## Special Cases

### Assessment Documents (Test Papers)

When an educator uploads an actual test paper (classified as `ASSESSMENT`), the system **extracts existing questions directly** rather than generating new ones. The AI parses the paper's questions, answers, and mark scheme into `ContentQuestion` records. These are tagged `assessmentUse: BOTH` so they can appear in both pre and post-tests.

### Question Bank Re-trigger

When a Question Bank document is uploaded to a subject that already has other content sources with MCQs, the system **regenerates** MCQs for sibling sources. This is because the Question Bank provides higher-fidelity source material (tutor questions with tiered responses), so MCQs generated from it are better than those generated from assertions alone.

### Manual Reset

Educators can force-regenerate all MCQs for a course. The system warns if active learners already have pre-test results (regenerating would make their scores incomparable to new questions).

---

## Key Concepts Summary

| Term | What it means |
|---|---|
| **ContentQuestion** | A stored MCQ or true/false question in the database |
| **Bloom level** | Cognitive complexity tier (Remember → Analyze) |
| **Comprehension skill** | PIRLS-aligned reading skill (Retrieval, Inference, Vocabulary...) |
| **assessmentUse** | Which tests a question can appear in (PRE_TEST, POST_TEST, BOTH) |
| **Teaching profile** | Whether a course is comprehension-led or knowledge-based |
| **Uplift** | Post-test score minus pre-test score — the measure of learning gain |
| **ChatSurvey** | The chat-like UI component that delivers assessments |
