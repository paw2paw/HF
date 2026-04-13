# KS2 Maths SATs — Wizard Prompt

Paste this prompt into the V5 wizard chat. Upload the listed docs when prompted.

All three KS2 SATs courses share `groupName: "KS2 SATs Prep"` so they appear
grouped together in the UI.

---

## Wizard prompt

```
I'm setting up a KS2 SATs Maths revision course for Year 6 pupils (age 10-11).

Subject: Mathematics
Course name: KS2 Maths SATs Prep
Department: KS2 SATs Prep
Audience: primary

The course prepares Year 6 pupils for the Key Stage 2 Mathematics SATs — three papers: one arithmetic (30 mins, 36 questions) and two reasoning (40 mins each). The content domains are number and place value, calculations, fractions/decimals/percentages, ratio, algebra, measurement, geometry, and statistics — coded as 6N, 6C, 6F, 6R, 6A, 6M, 6G, 6S.

Teaching approach: directive — structured, step-by-step instruction. SATs maths is procedural: pupils need to learn methods and practise applying them under time pressure. Socratic discovery is too slow for exam prep.

Teaching emphasis: practice — this is revision, not first teaching. Pupils have already learned the content in class. The AI tutor should drill, reinforce, and build speed and accuracy.

Sessions: 8 × 30 minutes
Lesson plan model: mastery — one content domain per session, build to fluency before moving on.
Coverage: depth — better to be secure on fewer domains than shaky on all of them.

Assessment targets:
- Score 100+ on scaled score (national expected standard)
- Complete Paper 1 arithmetic in under 25 minutes with 90%+ accuracy
- Show full working on multi-step reasoning questions

Constraints:
- Never teach methods outside the KS2 curriculum (no simultaneous equations, no trigonometry)
- Never skip showing working — "the mark scheme gives marks for method, not just the answer"
- Never use the word "test" or "exam" casually — say "practice paper" or "SATs questions"
- Never set homework — this is tutoring, not classroom teaching

Assessment style: formal — SATs is a formal exam, so track content domain mastery explicitly.

I have teaching documents to upload — the SATs test framework (the official skill taxonomy), past papers with mark schemes, and a course reference guide for how the AI should tutor.
```

---

## Documents to upload

Drop all files at once — the analyzer will group them.

| # | File | Document Type | What it provides |
|---|------|---------------|------------------|
| 1 | `course-ref-maths.md` | COURSE_REFERENCE | Tutor guide — session structure, scaffolding, timing, misconceptions |
| 2 | `ks2-maths-test-framework-2016.pdf` | CURRICULUM | Content domain refs (6N, 6C, 6F, etc.) — the skill taxonomy |
| 3 | `ks2-maths-programmes-of-study.pdf` | CURRICULUM | Year-by-year objectives |
| 4 | `ks2-maths-guidance.pdf` | COURSE_REFERENCE | DfE teaching progression |
| 5 | `papers/2024/paper1-arithmetic.pdf` | ASSESSMENT | 2024 arithmetic paper |
| 6 | `papers/2024/paper2-reasoning.pdf` | ASSESSMENT | 2024 reasoning paper 2 |
| 7 | `papers/2024/paper3-reasoning.pdf` | ASSESSMENT | 2024 reasoning paper 3 |
| 8 | `papers/2024/mark-schemes.pdf` | ASSESSMENT | 2024 mark schemes |
| 9 | `papers/2025/paper1-arithmetic.pdf` | ASSESSMENT | 2025 arithmetic paper |
| 10 | `papers/2025/paper2-reasoning.pdf` | ASSESSMENT | 2025 reasoning paper 2 |
| 11 | `papers/2025/paper3-reasoning.pdf` | ASSESSMENT | 2025 reasoning paper 3 |
| 12 | `papers/2025/mark-schemes.pdf` | ASSESSMENT | 2025 mark schemes |

### Optional (large — skip if not needed)

| File | Document Type | Notes |
|------|---------------|-------|
| `primary-national-curriculum.pdf` | CURRICULUM | Full KS1+KS2 national curriculum (all subjects) |
