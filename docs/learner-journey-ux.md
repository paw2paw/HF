# Learner Journey UX

How the student experience works from join to course completion, and how course type affects each step.

## Entry: Magic Link

A teacher shares a join link: `lab.humanfirstfoundation.com/join/{token}`

The link encodes: cohort, playbook(s), and optional pre-filled student details (?firstName=X&email=Y).

## NEW Learner Journey

```
Click link → Join page → Enrollment → Sim chat page → Journey begins
```

### 1. Join Page (`/join/{token}`)
- Shows classroom info (teacher name, institution, logo)
- Student enters name + email (or auto-filled from URL params)
- POST creates: User → Caller → CohortMembership → Enrollment(s)
- Auto-signs in with JWT, redirects to `/x/sim/{callerId}`

### 2. Journey Resolution
SimChat loads `useJourneyChat` which calls `/api/student/journey-position` to find the next stop.

The journey walks a **lesson plan rail** — a sequence of stops defined by the course's lesson plan:

```
pre_survey → [onboarding] → session 1 → [mid_survey] → session 2 → ... → [post_survey] → complete
```

Stops in brackets are optional (configured per course).

### 3. Pre-Survey Stop (personality + pre-test)

**Phase 1 — Personality survey:**
- 6 questions (learning preference, pace, confidence, goal, concern, motivation)
- Rendered as chat bubbles with chip/text input
- Answers stored as CallerAttributes (scope: PRE)

**Phase 2 — Pre-test (course-type dependent):**

| Course type | What happens |
|---|---|
| **Knowledge** (recall, practice, syllabus) | MCQ questions from ContentQuestion table. Student answers, scored, stored for post-test comparison. |
| **Comprehension** | **Skipped silently.** Questions tagged `POST_TEST` only — pre-test builder returns `skipped: true`. Journey advances to next stop. |
| **Discussion / Coaching** | **Skipped silently.** No MCQ questions exist. Same skip path. |

When pre-test is skipped, the student sees the personality survey → then immediately gets the "Start your practice session" button. No empty state, no error — the pre-test phase simply doesn't appear.

### 4. First Teaching Session
- Green phone button appears in chat
- Student taps → compose-prompt runs → call created → AI greets
- Session follows lesson plan phases (profile-specific)
- Student ends call via "End Call" button
- Pipeline runs: extracts memories, scores personality, adapts targets

### 5. Between Sessions
After call ends, journey resolves the next stop:
- If mid-survey configured → shows mid-course check-in questions
- Otherwise → shows "Continue" button → next teaching session

### 6. Final Session + Post-Survey
- Last teaching session follows offboarding guidance (summarise, reflect, celebrate)
- Post-survey: satisfaction + feedback questions
- Post-test: same MCQ questions as pre-test (for knowledge courses), or comprehension MCQs (POST_TEST tagged, available now that student has read the passage)

### 7. Complete
Journey state = `complete`. Congratulations message shown.

---

## RETURNING Learner Journey

```
Click link → Join page → "Welcome back!" → Sim chat page → Resume
```

### What's different:
- Join POST detects existing CohortMembership → `alreadyEnrolled: true`
- Signs in, redirects to `/x/sim/{callerId}`
- Journey-position finds the **next incomplete stop** and resumes there
- Completed surveys and sessions are already marked done
- Past call history shown as collapsed message groups in the chat

### Resume scenarios:

| Left off at... | What they see |
|---|---|
| Mid personality survey | Survey resumes (answers already submitted are pre-filled) |
| After pre-test, before session 1 | "Start your practice session" button |
| After session 2, before session 3 | Past calls shown → "Continue" button → session 3 |
| After mid-survey | Next teaching session |
| Course complete | Congratulations message |

---

## How Course Type Affects the Assessment Step

### Knowledge courses (recall-led, practice-led, syllabus-led)

```
pre_survey:
  ├── personality (6 questions) ✓
  └── pre-test (MCQs from assertions) ✓
        ↓
  teaching sessions...
        ↓
post_survey:
  ├── satisfaction survey ✓
  └── post-test (same MCQs, score compared) ✓
        ↓
  Evidence: "Score improved from 45% to 82%"
```

- Pre-test works because facts/methods can be known before teaching
- MCQs generated from ContentAssertions via bloom-distributed prompt
- `assessmentUse: BOTH` — same questions used pre and post
- Post-test mirrors exact same question IDs for valid comparison

### Comprehension courses

```
pre_survey:
  ├── personality (6 questions) ✓
  └── pre-test: SKIPPED (passage-dependent questions, student hasn't read it)
        ↓
  teaching sessions (each scored: COMP_RETRIEVAL, COMP_INFERENCE, COMP_VOCABULARY, COMP_LANGUAGE, COMP_EVALUATION, COMP_RECALL)
        ↓
post_survey:
  ├── satisfaction survey ✓
  └── post-test: MCQs available (student has now read the passage) — optional
        ↓
  Evidence: "Theme understanding improved from 0.2 to 0.7 across 5 sessions"
```

- Pre-test skipped because questions reference specific text passages
- MCQs tagged `assessmentUse: POST_TEST` — excluded from pre-test builder
- Session-embedded measurement planned (epic: Session-Embedded Learning Measurement)
- Post-test optionally available — student has read the passage by course end

### Discussion courses

```
pre_survey:
  ├── personality (6 questions) ✓
  └── pre-test: SKIPPED (no right answers to test)
        ↓
  teaching sessions (each scored: DISC_PERSPECTIVE, DISC_ARGUMENT, DISC_SHIFT, DISC_REFLECTION)
        ↓
post_survey:
  ├── satisfaction survey ✓
  └── post-test: N/A (no MCQs)
        ↓
  Evidence: "Perspective diversity improved from 0.3 to 0.75 across 4 sessions"
```

### Coaching courses

```
pre_survey:
  ├── personality (6 questions) ✓
  └── pre-test: SKIPPED (goal-specific, not knowledge)
        ↓
  teaching sessions (each scored: COACH_CLARITY, COACH_ACTION, COACH_AWARENESS, COACH_FOLLOWUP)
        ↓
post_survey:
  ├── satisfaction survey ✓
  └── post-test: N/A (no MCQs)
        ↓
  Evidence: "Action commitment improved from 0.25 to 0.8 across 6 sessions"
```

---

## UX: Joining a Course with No Pre-Test Questions

**What the student experiences:**

1. Clicks magic link → enters name + email → joins
2. Chat opens with personality survey (6 questions as chat bubbles)
3. Answers all 6 → survey submitted
4. **No pre-test appears** — the journey silently skips it
5. "Start your practice session" button appears immediately
6. Student taps → first session begins

**No empty state, no loading spinner, no "0 questions found" message.** The pre-test phase is simply absent from the flow. The student wouldn't know it was ever expected.

**Technical flow:**
- `useJourneyChat` calls `/api/student/assessment-questions?type=pre_test`
- Response: `{ skipped: true, skipReason: "no_questions" }` (or "excluded_doc_type" for comprehension)
- Journey treats pre_survey stop as complete
- Advances to next stop (onboarding or first teaching session)

---

## Key Files

| File | Role |
|---|---|
| `hooks/useJourneyChat.ts` | Journey state machine — stop resolution, survey loading, phase transitions |
| `app/api/student/journey-position/route.ts` | Resolves next stop by walking the lesson plan rail |
| `app/api/join/[token]/route.ts` | Enrollment — creates User, Caller, membership, enrollments |
| `lib/assessment/pre-test-builder.ts` | Sources MCQs, respects `assessmentUse` filter, returns skip if empty |
| `lib/lesson-plan/session-ui.ts` | Stop type definitions (pre_survey, onboarding, teaching, etc.) |
| `lib/content-trust/teaching-profiles.ts` | 6 teaching profiles with delivery hints |
| `docs/decisions/learning-measurement-by-profile.md` | How assessment tests + session measurement interact per profile |
| `docs/decisions/comprehension-pre-test-paradox.md` | Why comprehension pre-tests are paradoxical |
