# KS2 Reading SATs — Wizard Prompt

Paste this prompt into the V5 wizard chat. Upload the listed docs when prompted.

All three KS2 SATs courses share `groupName: "KS2 SATs Prep"` so they appear
grouped together in the UI.

---

## Wizard prompt

```
I'm setting up a KS2 SATs English Reading revision course for Year 6 pupils (age 10-11).

Subject: English Language
Course name: KS2 Reading SATs Prep
Department: KS2 SATs Prep
Audience: primary

The course prepares Year 6 pupils for the Key Stage 2 English Reading SATs — one paper (60 minutes) with a reading booklet containing three texts of increasing difficulty and an answer booklet with comprehension questions. The cognitive domain references are 2a (word meaning), 2b (retrieval), 2c (summary), 2d (inference), 2e (prediction), 2f (structure), 2g (language choices), 2h (comparisons).

Teaching approach: socratic — reading comprehension is about thinking, not memorising. The AI should ask "What tells you that?" and "How do you know?" to build inference skills. Pupils need to learn to find evidence in the text, not guess.

Teaching emphasis: comprehension — this is about understanding what they read, not decoding or fluency.

Sessions: 8 × 30 minutes
Lesson plan model: spiral — revisit the same reading skills (inference, language, retrieval) across different text types. One text per session, all question types on that text.
Coverage: balanced — cover all content domains but weight toward 2d (inference) and 2g (language) which carry the most marks.

Assessment targets:
- Score 100+ on scaled score (national expected standard)
- Use PEE structure (Point, Evidence, Explain) on all 2-3 mark questions
- Answer 1-mark retrieval questions in under 30 seconds (quick scanning)

Constraints:
- Never accept an inference answer without text evidence — always ask "Which words tell you that?"
- Never teach creative writing — this is comprehension only
- Never accept "it makes the reader want to read on" as a language effect answer — push for specific effects
- Never rush past a text the pupil finds difficult — scaffold it, do not simplify it

Assessment style: formal — track mastery per content domain reference (2a through 2h).

I have teaching documents to upload — the reading test framework (the official skill taxonomy), past paper reading booklets with answer booklets and mark schemes, and a course reference guide for how the AI should tutor reading comprehension.
```

---

## Documents to upload

Drop all files at once — the analyzer will group them.

| # | File | Document Type | What it provides |
|---|------|---------------|------------------|
| 1 | `course-ref-reading.md` | COURSE_REFERENCE | Tutor guide — PEE chains, text types, stamina, answer technique |
| 2 | `ks2-reading-test-framework-2016.pdf` | CURRICULUM | Cognitive domain refs (2a-2h) — the skill taxonomy |
| 3 | `papers/2024/reading-booklet.pdf` | READING_PASSAGE | 2024 reading booklet (3 texts) |
| 4 | `papers/2024/answer-booklet.pdf` | COMPREHENSION | 2024 answer booklet (linked to reading booklet) |
| 5 | `papers/2024/mark-schemes.pdf` | ASSESSMENT | 2024 mark schemes |
| 6 | `papers/2025/reading-booklet.pdf` | READING_PASSAGE | 2025 reading booklet (3 texts) |
| 7 | `papers/2025/answer-booklet.pdf` | COMPREHENSION | 2025 answer booklet (linked to reading booklet) |
| 8 | `papers/2025/mark-schemes.pdf` | ASSESSMENT | 2025 mark schemes |
