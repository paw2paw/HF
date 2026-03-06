# Adaptive Knowledge Component Mastery with Dialogic Instruction (AKMD): The Pedagogical Framework of an AI Tutoring System

**Document type:** Academic reference
**Audience:** Educators, school leaders, educational researchers, curriculum designers
**Version:** 1.0 — February 2026

---

## Executive Summary

This document describes the pedagogical foundations of a conversational AI tutoring system designed to deliver personalised, mastery-based instruction at scale. The system implements a framework termed **Adaptive Knowledge Component Mastery with Dialogic Instruction (AKMD)** — a synthesis of eight complementary traditions in cognitive science, instructional design, and educational psychology. Each tradition addresses a distinct bottleneck in how students learn: the granularity of what is tracked (Knowledge Component theory), the timing of when material is revisited (Spaced Retrieval Practice), the standard for progress (Mastery Learning), the cognitive level of challenge (Bloom's Taxonomy), the quality of the conversational exchange (Dialogic and Socratic Instruction), the management of mental load (Cognitive Load Theory), the mechanism of ongoing feedback (Formative Assessment), and the technological lineage from which the system descends (Intelligent Tutoring Systems).

The central claim is one grounded in a substantial body of empirical evidence: one-on-one tutoring reliably produces two standard deviations of improvement over conventional classroom instruction — the so-called "2-sigma" effect documented by Bloom (1984). For most of educational history, this effect has been inaccessible at scale. A single skilled human tutor cannot work with thirty students simultaneously. Large language model (LLM) technology changes this constraint. For the first time, it is possible to deploy a system capable of genuine Socratic dialogue, responsive to each student's individual state, operating asynchronously, and available at near-zero marginal cost per session. The AKMD framework describes the pedagogical architecture that makes such a system principled rather than merely conversational.

The document proceeds as follows: Section 1 establishes the case for AI tutoring in terms of the personalisation gap; Sections 2 through 5 detail the four core pillars of AKMD; Section 6 describes three supporting frameworks that constrain and enrich the core pillars; Section 7 explains how the pillars interact in practice; and Section 8 addresses known limitations and directions for future development. A complete reference list in APA format is provided at the end.

---

## 1. The Case for AI Tutoring: Personalisation at Scale

### 1.1 The 2-Sigma Problem

In a landmark pair of papers, Benjamin Bloom established what has since become one of the most cited findings in educational research. Bloom (1984) demonstrated that students who received one-to-one mastery tutoring consistently outperformed students taught in conventional classroom conditions by approximately two standard deviations. In practical terms, the average tutored student performed better than 98% of students taught through conventional group instruction. Bloom called this the "2-sigma problem" because, while the effect was robust and replicable, the solution — universal access to skilled private tutors — was economically impossible.

This gap has persisted for four decades. The structural reason is not a lack of will or evidence but a fundamental scarcity problem: the ratio of skilled human tutors to students cannot be improved through conventional means. Classroom instruction, by necessity, targets the middle of the distribution. Students at the tail — those who have not yet consolidated prerequisite knowledge, or those who are ready to move faster — are systematically under-served.

The tutoring effect operates through identifiable mechanisms: immediate corrective feedback, adaptive pacing based on demonstrated understanding rather than time elapsed, and the requirement that a student demonstrate mastery before advancing. Each of these mechanisms requires a model of the individual student's current state — something impossible to maintain at scale without technology.

### 1.2 Why Conversational AI Changes the Equation

Earlier generations of Intelligent Tutoring Systems (ITS) — from SCHOLAR (Carbonell, 1970) through the Carnegie Mellon Cognitive Tutor (Anderson, Corbett, Koedinger, & Pelletier, 1995) — demonstrated that algorithmic tutoring could produce meaningful gains. A meta-analysis by VanLehn (2011) found that well-designed ITS produced effect sizes of approximately 0.76 standard deviations relative to classroom instruction. These gains are substantial and replicable, but they fall short of the human-tutor benchmark. The gap was largely attributable to the rigidity of rule-based dialogue: an ITS could guide a student through a structured problem space but could not engage in the open-ended, adaptive exchange that characterises skilled human tutoring.

LLM-based tutoring systems represent a qualitative change. A system capable of generating contextually appropriate Socratic questions, rephrasing explanations in response to a student's expressed confusion, and sustaining a coherent dialogue across multiple turns can, for the first time, approximate the conversational flexibility of a human tutor — while retaining the computational infrastructure of a classical ITS. The AKMD framework is designed to harness both capacities: the LLM for dialogue quality, and the classical ITS architecture for knowledge tracking, mastery gating, and adaptive sequencing.

---

## 2. The Four Core Pillars

### 2.1 Pillar I — Knowledge Component (KC) Model

#### Theory

The Knowledge Component model originates in John Anderson's ACT-R (Adaptive Control of Thought — Rational) theory of cognition (Anderson, 1983) and was operationalised in the Carnegie Mellon Cognitive Tutor by Corbett, Anderson, and their collaborators. A Knowledge Component is the smallest meaningful unit of what a student must learn to acquire a skill or body of knowledge. The fundamental insight of KC theory is that learning is not monolithic: a student who can correctly apply a procedure in one context may lack the corresponding declarative knowledge, or may have consolidated one sub-skill while another remains fragile.

Knowledge tracing — maintaining a probabilistic estimate of a student's mastery state for each KC independently — was formalised by Corbett and Anderson (1994) using a Bayesian model (BKT: Bayesian Knowledge Tracing). The key quantities in BKT are the probability of having learned a KC given observed performance, the probability of a correct response even if the KC is not yet learned (guessing), and the probability of an incorrect response despite mastery (slipping). These quantities allow the system to distinguish between a student who answers correctly by chance and one who has genuinely consolidated the KC.

#### Evidence

Anderson et al. (1995) reported that Cognitive Tutor algebra students performed approximately one standard deviation above control in large-scale randomised evaluations. Subsequent field trials in Pittsburgh Public Schools showed that Cognitive Tutor produced 15–25% gains on standardised algebra assessments compared to traditional instruction. The KC model is the common factor across these results: by tracking mastery at the sub-skill level, the system could identify gaps that were invisible at the topic or chapter level.

#### Implementation in AKMD

In the AKMD system, each **Teaching Point (TP)** corresponds to a Knowledge Component. TPs are authored at the course level and carry metadata including a cognitive level target (Bloom level L1–L5), an interaction pattern (Socratic, Directive, or Advisory), and a spaced retrieval schedule derived from the SM-2 algorithm (see Pillar II). The mastery state for each TP is tracked independently across sessions. A student's progress within a course is a function of their per-TP mastery profile, not their chapter completion or time on task.

Each tutoring session selects a session set from the full TP inventory: typically three TPs scheduled for retrieval practice (scheduled by SM-2), two TPs newly introduced, and one TP previewed. This design reflects both spaced retrieval principles (Pillar II) and cognitive load constraints (Section 6.1).

---

### 2.2 Pillar II — Spaced Retrieval Practice

#### Theory

Hermann Ebbinghaus's experiments on memory, published in 1885, established the **forgetting curve**: without review, newly learned material decays exponentially, with the steepest loss occurring in the hours and days immediately following acquisition. Ebbinghaus also demonstrated the **spacing effect**: memory is more durable when study is distributed across time than when it is massed in a single session of equivalent total duration.

Piotr Wozniak formalised the spacing effect into a practical scheduling algorithm — SM-2 (SuperMemo 2) — in 1990. SM-2 assigns each item an inter-repetition interval, which expands exponentially upon successful recall and contracts upon failure. The algorithm's key parameter, the "easiness factor," is adjusted based on the quality of each recall response, allowing the schedule to adapt to individual forgetting rates.

Robert Bjork's framework of **desirable difficulties** (1994) provides a complementary theoretical account. Bjork argues that conditions which make retrieval effortful in the short term — spacing, interleaving, varied practice — produce greater long-term retention precisely because the act of effortful retrieval itself strengthens the memory trace. This is the **testing effect**: retrieving information from memory is a more powerful learning act than re-reading or re-studying the same material (Roediger & Butler, 2011). Interleaving — the practice of mixing different topics or problem types within a session rather than blocking all practice on one type before moving to another — further amplifies retention, particularly for concept learning (Kornell & Bjork, 2008).

#### Evidence

The empirical evidence for spaced retrieval practice is among the strongest in educational psychology. A meta-analysis of 254 studies (Cepeda et al., 2006) found an average effect size of 0.72 standard deviations for spaced versus massed practice. The testing effect has been replicated across age groups, content domains, and retention intervals. Karpicke and Roediger (2008) showed that students who were tested four times after studying retained 80% of material after a week, compared to 36% for students who studied four times without testing — a result that challenges prevailing assumptions about the role of assessment as mere measurement rather than instruction.

#### Implementation in AKMD

The AKMD system applies the SM-2 algorithm to schedule each TP's retrieval session. When a student responds to a check question (the AI's test of whether a TP has been retained), the response quality is evaluated on a 0–5 quality scale: 5 (perfect response), 4 (correct after hesitation), 3 (correct with difficulty), 2 (incorrect but easy to recall after seeing correct answer), 1 (incorrect; correct answer was hard to recall), 0 (total blackout). TPs rated below 3 are rescheduled for near-term re-presentation; TPs rated 4 or 5 see their intervals extended.

This architecture means that each student's session set is individually customised based on their actual forgetting pattern for each specific TP — not a single global forgetting rate. The interleaving effect is automatically achieved by mixing TPs from different content areas within a single session, rather than working through a topic sequentially.

---

### 2.3 Pillar III — Mastery Learning

#### Theory

Mastery Learning, as formalised by Bloom (1968, 1984), rests on a deceptively simple premise: virtually all students can achieve high levels of learning, given adequate time and appropriate instruction. The corollary is that the conventional practice of advancing all students on a fixed time schedule — regardless of demonstrated understanding — systematically creates gaps that compound over time. A student who has not consolidated 60% of Year 7 content cannot fully benefit from Year 8 instruction built on those prerequisites.

Bloom's operational definition of mastery is explicit: a student is considered to have mastered a unit when they can demonstrate achievement of the unit's objectives at or above a defined criterion (typically 75–90% correct on a formative assessment). Only after reaching criterion does the student advance. Students who do not reach criterion receive additional corrective instruction — targeted, not repetitive — before being re-assessed. The critical move is to treat time as the variable and learning as the constant, rather than the reverse.

Guskey (2010) summarises three decades of Mastery Learning research: mean effect sizes of 0.6–0.8 standard deviations relative to conventional instruction across a wide range of subjects and age groups, with the strongest effects on lower-achieving students who are typically most harmed by fixed-pace progression.

#### Evidence

The evidence base for Mastery Learning is substantial. A meta-analysis by Kulik, Kulik, and Bangert-Drowns (1990) covering 108 studies found a mean effect size of 0.52 standard deviations. When combined with one-on-one tutoring (Bloom's 2-sigma result), the effect sizes are considerably larger. The mechanism is well-understood: mastery gating prevents the accumulation of prerequisite gaps, which are the primary driver of achievement divergence over time.

#### Implementation in AKMD

In the AKMD system, mastery is operationalised at the **phase** level: before a student advances from one instructional phase (arc) to the next, they must demonstrate a mastery threshold of 75% of the TPs in the current phase. This threshold is configurable at the course level, reflecting the principle that appropriate mastery standards vary by subject and consequence of error.

A student who has not met the phase mastery threshold does not advance — they receive additional retrieval practice and targeted re-instruction. Crucially, the system distinguishes between a student who is working toward mastery (progressive mastery pattern) and one who appears stuck (stalled pattern). The latter triggers a different instructional response: simplification, re-framing, or a return to prerequisite TPs. There is no "written off" state: the loop continues until mastery is achieved.

---

### 2.4 Pillar IV — Dialogic and Socratic Instruction

#### Theory

The tutoring effect operates not merely through feedback timing and mastery gating, but through the quality of the conversational exchange itself. Human tutoring, at its best, is not transmission of information but co-construction of understanding. This principle has ancient roots in Socratic method and contemporary grounding in Vygotsky's (1978) concept of the **Zone of Proximal Development (ZPD)**: the range of tasks a learner can accomplish with assistance but not yet independently. Effective instruction targets the ZPD — scaffolding at the productive edge of capability, neither above nor below it.

Neil Mercer's research on "exploratory talk" (Mercer, 2000) and Robin Alexander's framework of "dialogic teaching" (Alexander, 2008) provide the classroom-level evidence: students who engage in cumulative, interrogative, structured dialogue with peers or teachers demonstrate significantly higher conceptual understanding than those who receive transmission-style instruction. The mechanism is metacognitive: articulating one's reasoning — even (especially) when wrong — forces the learner to identify gaps in their own understanding.

Graesser, Person, and Magliano (1995) analysed naturalistic human tutoring transcripts and found that expert tutors ask five question types far more frequently than novice tutors: completion questions (fill in the missing element), concept identification (what is this an instance of?), feature specification (what are the features of X?), causal antecedent (why did this happen?), and goal orientation (what are you trying to achieve?). These question types scaffold progressively deeper processing and map naturally onto Bloom's taxonomy levels L1–L5.

#### Pattern-Specific Instruction

Not all subject domains are equally suited to open-ended Socratic dialogue. The AKMD framework distinguishes three interaction patterns:

- **Socratic pattern** — used for subjects where understanding is constructed through interpretation, argument, and nuance (e.g., history, literature, social sciences). The AI tutor poses dilemmas, asks for justification, challenges student conclusions, and withholds the "answer" in favour of extended dialogue.
- **Directive pattern** — used for subjects where there are definitive correct methods (e.g., mathematics, sciences). The AI tutor guides the student through a procedure, corrects errors immediately and explicitly, and closes the loop when the correct answer is reached.
- **Advisory pattern** — used for professional development, coaching, and skill-building contexts. The AI tutor elicits the student's goals, reflections, and self-assessments, then offers frameworks and perspectives rather than correct answers.

The interaction pattern is set at the course (Playbook) level and can be overridden at the individual TP level where a specific KC warrants a different approach.

#### Evidence

VanLehn (2011) found that human tutors achieve a mean effect size of approximately 1.0 standard deviation relative to classroom instruction, compared to 0.76 for ITS. The gap is attributed largely to dialogue quality: human tutors adapt their questioning strategy dynamically in ways that rule-based systems cannot. LLM-based systems close this gap by enabling genuine open-ended dialogue generation calibrated to the student's demonstrated level.

---

## 3. Supporting Frameworks

### 3.1 Cognitive Load Theory

Sweller (1988) proposed that learning is constrained by the limited capacity of working memory. The theory distinguishes three types of cognitive load: **intrinsic load** (inherent complexity of the material), **extraneous load** (unnecessary complexity introduced by poor instructional design), and **germane load** (cognitive effort that directly contributes to schema formation). Effective instruction maximises germane load while minimising extraneous load, and manages intrinsic load through sequencing and chunking.

Sweller, van Merriënboer, and Paas (1998) provide the instructional design implications: worked examples before problem solving, part-task training for complex skills, and careful pacing to avoid overloading working memory.

**Implementation:** The AKMD session set is capped at six TPs (three retrieve + two new + one preview) to respect working memory limits. Introducing more new TPs in a single session would increase intrinsic load beyond the point at which the student can form stable schemas. The preview function (introducing a TP without requiring mastery demonstration) further manages load by creating an initial encoding before the TP enters the retrieval rotation.

### 3.2 Bloom's Taxonomy — Cognitive Level Targeting

Bloom's original taxonomy (Bloom et al., 1956), revised by Anderson and Krathwohl (2001), describes six levels of cognitive processing: Remember (L1), Understand (L2), Apply (L3), Analyse (L4), Evaluate (L5), and Create (L6). Each level represents a qualitatively different cognitive demand, and each requires a different style of check question and a different rubric for evaluating the student's response.

**Implementation in AKMD:**

| Bloom Level | Label | Check Question Style | Evaluation Rubric |
|-------------|-------|----------------------|-------------------|
| L1 | Remember | "What is X?" | Recall: right/wrong |
| L2 | Understand | "Explain X in your own words." | Explanation: captures key concept? |
| L3 | Apply | "How would X work in situation Y?" | Connection-making: correct mapping? |
| L4 | Analyse | "Why does X cause Y?" | Causal reasoning: identifies mechanism? |
| L5 | Evaluate | "Is X a good approach? Defend your view." | Argumentation: evidence + counterargument? |

Each TP in the system carries a Bloom level tag, set at authoring time based on the intended depth of understanding. The check question generated by the AI tutor is calibrated to that level. A TP tagged L1 receives a straightforward recall question; a TP tagged L5 receives a multi-turn argumentation prompt. This prevents the common failure mode of teaching L4-level material but assessing only at L1 — a mismatch that inflates apparent mastery while leaving deep understanding unformed.

### 3.3 Formative Assessment

Black and Wiliam's foundational review (1998a, 1998b) established that ongoing, low-stakes formative assessment — feedback given in the flow of learning rather than in summative examinations — is among the most powerful interventions available to educators. Effect sizes of 0.4–0.7 standard deviations were found across 250 studies covering a 30-year span. The mechanism is direct: the student receives information about their current understanding while there is still opportunity to act on it.

**Implementation:** In the AKMD system, every tutoring session generates a per-TP mastery signal. The AI tutor's evaluation of each check question response (quality score 0–5) feeds directly into the SM-2 scheduling algorithm and the phase mastery threshold calculation. There are no summative examinations — the entire assessment architecture is formative, continuous, and embedded in the tutoring dialogue. The student experiences this not as being tested but as being asked questions in the course of a conversation.

### 3.4 ITS Lineage

The AKMD system sits within a 55-year tradition of Intelligent Tutoring Systems:

- **SCHOLAR** (Carbonell, 1970) — first ITS, used semantic networks to model student knowledge
- **GUIDON** (Clancey, 1979) — tutoring overlay on MYCIN expert system; first explicit separation of domain knowledge and pedagogical strategy
- **Cognitive Tutor** (Anderson et al., 1995) — KC model + BKT + mastery gating; rigorous empirical validation
- **ASSISTments** (Heffernan & Heffernan, 2014) — formative assessment at scale; used for large-scale RCTs
- **GPT-era systems** (2023–) — LLM dialogue generation combined with ITS infrastructure

VanLehn's (2011) meta-analysis provides the definitive comparison across generations: human tutors (~1.0 SD), step-level ITS (~0.76 SD), unsolicited hint ITS (~0.40 SD), answer-based ITS (~0.35 SD). The AKMD system targets the step-level ITS range while using LLM dialogue to push toward the human-tutor ceiling.

---

## 4. The AKMD Synthesis: How the Pillars Interact

The four core pillars of AKMD are not independent — they form an integrated instructional loop that executes within and across sessions. The diagram below shows the relationship:

```
┌──────────────────────────────────────────────────────────────────────┐
│                        THE AKMD LOOP                                 │
│                                                                      │
│  ┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐  │
│  │  KC TRACKING │────▶│ SPACED RETRIEVAL│────▶│  SESSION SET     │  │
│  │              │     │   SCHEDULER     │     │  COMPOSITION     │  │
│  │ Per-TP state │     │  (SM-2 algo)    │     │  3 retrieve      │  │
│  │  mastery %   │     │  schedules next │     │  2 new           │  │
│  │  Bloom level │     │  retrieval date │     │  1 preview       │  │
│  └──────────────┘     └─────────────────┘     └────────┬─────────┘  │
│         ▲                                               │            │
│         │                                               ▼            │
│  ┌──────┴─────────┐                          ┌──────────────────┐   │
│  │ MASTERY GATING │                          │  DIALOGIC        │   │
│  │                │                          │  TUTORING        │   │
│  │  ≥75% TPs in   │◀─────────────────────── │  SESSION         │   │
│  │  phase = next  │     post-session         │                  │   │
│  │  arc unlocked  │     mastery signal       │  Socratic /      │   │
│  └────────────────┘                          │  Directive /     │   │
│                                               │  Advisory        │   │
│                                               │                  │   │
│                            Supporting         │  Check Q at      │   │
│                            frameworks:        │  Bloom level     │   │
│                            • Cognitive Load   │  (L1–L5)         │   │
│                            • Formative        │                  │   │
│                              Assessment       │  Quality score   │   │
│                            • ITS lineage      │  0–5 per TP      │   │
│                                               └──────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘

        ──────────────────────────────────────────────
        PILLAR INTERACTION MATRIX

        ┌────────────────┬───────────┬─────────┬─────────┬───────────┐
        │                │  KC Model │ Spaced  │ Mastery │ Dialogic  │
        │                │           │Retrieval│Learning │Instruction│
        ├────────────────┼───────────┼─────────┼─────────┼───────────┤
        │ KC Model       │     —     │ WHAT is │ WHEN to │ HOW to    │
        │                │           │ tracked │  gate   │ question  │
        ├────────────────┼───────────┼─────────┼─────────┼───────────┤
        │ Spaced         │ Per-KC    │    —    │ Mastery │ Retrieval │
        │ Retrieval      │ schedule  │         │ resets  │ practice  │
        │                │           │         │ interval│= dialogue │
        ├────────────────┼───────────┼─────────┼─────────┼───────────┤
        │ Mastery        │ KC state  │ Mastery │    —    │ Dialogue  │
        │ Learning       │ = gate    │ gates   │         │ reveals   │
        │                │ condition │ advance │         │ mastery   │
        ├────────────────┼───────────┼─────────┼─────────┼───────────┤
        │ Dialogic       │ KC level  │ Check Q │ Check Q │    —      │
        │ Instruction    │ sets Bloom│generates│generates│           │
        │                │ of check Q│ signal  │ signal  │           │
        └────────────────┴───────────┴─────────┴─────────┴───────────┘
```

In operational terms, the loop runs as follows:

1. At session start, the **SM-2 scheduler** reads each TP's current state (interval, easiness factor, next-due date) and composes the session set.
2. The **dialogic tutoring session** engages the student in conversation, introducing new TPs through explanation and preview, and probing retained TPs through check questions calibrated to their Bloom level.
3. Each check question response generates a quality score (0–5), which feeds back into SM-2 to schedule the next retrieval and into the **mastery state** for that TP.
4. After the session, the **mastery gate** evaluates whether the student has now crossed the phase threshold (75% of TPs ≥ mastery level). If so, the next arc is unlocked. If not, the next session set will weight toward the TPs furthest from mastery.
5. Throughout, **Cognitive Load Theory** constrains the session set size and pacing, **Formative Assessment** ensures the mastery signal is continuous rather than summative, and the **ITS architecture** maintains the computational state that makes personalisation possible.

The result is a system where each session is genuinely different for each student — not because the content differs (all students study the same curriculum), but because the selection, sequencing, and depth of questioning are driven by each student's individual KC mastery profile.

---

## 5. Known Limitations and Future Directions

### 5.1 Transfer Learning

The KC model and mastery gating ensure that a student consolidates each TP in the contexts used during instruction. However, **transfer** — the ability to apply knowledge in genuinely novel contexts — requires separate, deliberate design. A student who has mastered "the causes of World War I" as a KC may not spontaneously apply that understanding when asked about a contemporary geopolitical scenario. Transfer tasks require the explicit design of far-transfer check questions and, ideally, deliberate variation of context across retrieval sessions. This is a well-documented limitation of mastery-based ITS (VanLehn, 2011) and remains an open design challenge for the AKMD system.

### 5.2 Metacognition and Self-Regulation

The system does not currently teach **metacognitive strategies** — study planning, self-testing, error monitoring, or the selection of appropriate learning strategies. Flavell's (1979) framework of metacognition, and subsequent work by Zimmerman (2000) on self-regulated learning, suggest that students who understand how their own memory works — and who are trained to use spaced retrieval and interleaving independently — outperform those who receive these benefits passively through a system. A future direction is to make the system's pedagogical logic transparent to students and to develop explicit metacognitive modules.

### 5.3 Collaborative Learning

All AKMD tutoring is one-to-one: AI tutor and individual student. The research tradition of **collaborative learning** (Vygotsky, 1978; Johnson & Johnson, 1989) documents substantial gains from peer learning — explaining to a peer, resolving conflicting understandings, and co-constructing knowledge. The AKMD system has no peer dimension. This is not merely a feature gap: there are categories of learning — particularly at Bloom L4–L5 levels and in Socratic-pattern subjects — where peer dialogue may be irreplaceable. A future integration could involve structured peer exchanges scaffolded by the AI, with the AI tutor serving as facilitator rather than sole interlocutor.

### 5.4 The Affective Dimension

Research by Lepper and Woolverton (2002) and Pekrun (2006) documents the substantial role of affect — motivation, curiosity, anxiety, and boredom — in learning outcomes. Students experiencing mathematics anxiety, for example, show measurably different cognitive processing than anxiety-free students on identical tasks. The AKMD system addresses the affective dimension indirectly through VARK-style preference adaptation and personality-responsive dialogue, but does not systematically model or intervene on affective states such as frustration or learned helplessness. This is a recognised limitation of the current architecture and a priority for future development.

### 5.5 Developmental Stage and Bloom Ceiling

The system's per-TP Bloom level targeting is designed for learners capable of operating at the targeted cognitive level. Piaget's (1970) theory of cognitive development establishes that certain reasoning capacities — particularly formal operational thinking required for L4–L5 tasks — are not reliably available until adolescence, and that developmental stage constrains what kind of instruction is productive. For younger learners (typically under 12), Bloom level targets must be calibrated to developmental stage rather than curriculum ambition. The AKMD system currently relies on course authors to set appropriate Bloom targets; future versions should include developmental stage guidance in the authoring interface.

### 5.6 Future Directions

Several extensions are under active consideration:
- **Knowledge state visualisation** for learners: making the mastery profile visible to students as a personal learning map
- **Voice and prosodic signal integration**: supplementing transcript-based KC evaluation with paralinguistic cues (hesitation, pace, confidence markers) as additional mastery signals
- **Peer dialogue scaffolding**: structured AI-facilitated peer sessions for L4–L5 Socratic topics
- **Metacognitive module**: explicit instruction in spaced retrieval strategy, helping students apply the system's logic independently
- **Long-term cohort analytics**: aggregate KC mastery data across cohorts to identify systematically difficult TPs, informing curriculum redesign

---

## 6. References

Alexander, R.J. (2008). *Towards dialogic teaching: Rethinking classroom talk* (4th ed.). Dialogos.

Anderson, J.R. (1983). *The architecture of cognition*. Harvard University Press.

Anderson, J.R., Corbett, A.T., Koedinger, K.R., & Pelletier, R. (1995). Cognitive tutors: Lessons learned. *Journal of the Learning Sciences, 4*(2), 167–207. https://doi.org/10.1207/s15327809jls0402_2

Anderson, L.W., & Krathwohl, D.R. (Eds.). (2001). *A taxonomy for learning, teaching, and assessing: A revision of Bloom's educational objectives*. Longman.

Bjork, R.A. (1994). Memory and metamemory considerations in the training of human beings. In J. Metcalfe & A. Shimamura (Eds.), *Metacognition: Knowing about knowing* (pp. 185–205). MIT Press.

Black, P., & Wiliam, D. (1998a). Assessment and classroom learning. *Assessment in Education: Principles, Policy & Practice, 5*(1), 7–74. https://doi.org/10.1080/0969595980050102

Black, P., & Wiliam, D. (1998b). Inside the black box: Raising standards through classroom assessment. *Phi Delta Kappan, 80*(2), 139–148.

Bloom, B.S. (1968). Learning for mastery. *Evaluation Comment, 1*(2), 1–12. UCLA Center for the Study of Evaluation of Instructional Programs.

Bloom, B.S. (1984). The 2 sigma problem: The search for methods of group instruction as effective as one-to-one tutoring. *Educational Researcher, 13*(6), 4–16. https://doi.org/10.3102/0013189X013006004

Bloom, B.S., Engelhart, M.D., Furst, E.J., Hill, W.H., & Krathwohl, D.R. (1956). *Taxonomy of educational objectives: The classification of educational goals. Handbook I: Cognitive domain*. Longmans, Green.

Carbonell, J.R. (1970). AI in CAI: An artificial-intelligence approach to computer-assisted instruction. *IEEE Transactions on Man-Machine Systems, 11*(4), 190–202. https://doi.org/10.1109/TMMS.1970.299942

Cepeda, N.J., Pashler, H., Vul, E., Wixted, J.T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. *Psychological Bulletin, 132*(3), 354–380. https://doi.org/10.1037/0033-2909.132.3.354

Clancey, W.J. (1979). Tutoring rules for guiding a case method dialogue. *International Journal of Man-Machine Studies, 11*(1), 25–49.

Corbett, A.T., & Anderson, J.R. (1994). Knowledge tracing: Modeling the acquisition of procedural knowledge. *User Modeling and User-Adapted Interaction, 4*(4), 253–278. https://doi.org/10.1007/BF01099821

Ebbinghaus, H. (1913). *Memory: A contribution to experimental psychology* (H.A. Ruger & C.E. Bussenius, Trans.). Teachers College, Columbia University. (Original work published 1885)

Flavell, J.H. (1979). Metacognition and cognitive monitoring: A new area of cognitive-developmental inquiry. *American Psychologist, 34*(10), 906–911. https://doi.org/10.1037/0003-066X.34.10.906

Graesser, A.C., Person, N.K., & Magliano, J.P. (1995). Collaborative dialogue patterns in naturalistic one-to-one tutoring. *Applied Cognitive Psychology, 9*(6), 495–522. https://doi.org/10.1002/acp.2350090604

Guskey, T.R. (2010). Lessons of mastery learning. *Educational Leadership, 68*(2), 52–57.

Heffernan, N.T., & Heffernan, C.L. (2014). The ASSISTments ecosystem: Building a platform that brings scientists and teachers together for minimally invasive research on human learning and teaching. *International Journal of Artificial Intelligence in Education, 24*(4), 470–497. https://doi.org/10.1007/s40593-014-0024-x

Johnson, D.W., & Johnson, R.T. (1989). *Cooperation and competition: Theory and research*. Interaction Book Company.

Karpicke, J.D., & Roediger, H.L. (2008). The critical importance of retrieval for learning. *Science, 319*(5865), 966–968. https://doi.org/10.1126/science.1152408

Kornell, N., & Bjork, R.A. (2008). Learning concepts and categories: Is spacing the "enemy of induction"? *Psychological Science, 19*(6), 585–592. https://doi.org/10.1111/j.1467-9280.2008.02127.x

Kulik, C.C., Kulik, J.A., & Bangert-Drowns, R.L. (1990). Effectiveness of mastery learning programs: A meta-analysis. *Review of Educational Research, 60*(2), 265–299. https://doi.org/10.3102/00346543060002265

Lepper, M.R., & Woolverton, M. (2002). The wisdom of practice: Lessons learned from the study of highly effective tutors. In J. Aronson (Ed.), *Improving academic achievement: Impact of psychological factors on education* (pp. 135–158). Academic Press.

Mercer, N. (2000). *Words and minds: How we use language to think together*. Routledge.

Pekrun, R. (2006). The control-value theory of achievement emotions: Assumptions, corollaries, and implications for educational research and practice. *Educational Psychology Review, 18*(4), 315–341. https://doi.org/10.1007/s10648-006-9029-9

Piaget, J. (1970). *Science of education and the psychology of the child*. Orion Press.

Roediger, H.L., & Butler, A.C. (2011). The critical role of retrieval practice in long-term retention. *Trends in Cognitive Sciences, 15*(1), 20–27. https://doi.org/10.1016/j.tics.2010.09.003

Sweller, J. (1988). Cognitive load during problem solving: Effects on learning. *Cognitive Science, 12*(2), 257–285. https://doi.org/10.1207/s15516709cog1202_4

Sweller, J., van Merriënboer, J.J.G., & Paas, F. (1998). Cognitive architecture and instructional design. *Educational Psychology Review, 10*(3), 251–296. https://doi.org/10.1023/A:1022193728205

VanLehn, K. (2011). The relative effectiveness of human tutoring, intelligent tutoring systems, and other tutoring systems. *Educational Psychologist, 46*(4), 197–221. https://doi.org/10.1080/10508406.2011.581320

Vygotsky, L.S. (1978). *Mind in society: The development of higher psychological processes*. Harvard University Press.

Wozniak, P.A. (1990). *Economics of learning*. SuperMemo World. Retrieved from https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtained-in-working-with-the-supermemo-method

Zimmerman, B.J. (2000). Attaining self-regulation: A social cognitive perspective. In M. Boekaerts, P.R. Pintrich, & M. Zeidner (Eds.), *Handbook of self-regulation* (pp. 13–39). Academic Press.

---

*Document maintained by the HumanFirst engineering team. For questions about implementation details, see the system architecture documentation. For questions about the underlying research, contact the curriculum design team.*
