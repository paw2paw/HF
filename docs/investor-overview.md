# HumanFirst Foundation

## One-to-one tutoring works. It has never scaled. We fix that.

Bloom's 1984 research established the most replicated finding in education: students who receive one-to-one tutoring outperform classroom-taught peers by two standard deviations — the average tutored student beats 98% of the group-taught cohort. For forty years, this "2-sigma effect" has been economically inaccessible. There are not enough skilled tutors. Large language models remove that constraint — but only if the system behind them is principled, not merely conversational.

HumanFirst is an adaptive voice AI tutoring engine. The end-user experience is a phone call. Behind that call sits a seven-stage adaptive pipeline that measures each learner in real time, builds a persistent profile across sessions, and continuously re-composes every prompt to match how that individual learns. The institution — school, employer, training provider — controls all content, all pedagogy, and all boundaries. The learner never encounters a hallucination, because the AI only teaches what it has been given.

---

### 1. The adaptive engine is the moat

Most AI tutoring products wrap a chatbot around a curriculum. HumanFirst runs a full closed-loop pipeline on every conversational turn:

<!-- DIAGRAM 1: Adaptive Loop
     Full-width circular diagram showing:
     VOICE CALL (top) → transcript down → EXTRACT → SCORE → AGGREGATE →
     REWARD → ADAPT → SUPERVISE → COMPOSE → personalised prompt up → VOICE CALL
     Show the closed loop clearly. Brand colours. -->

Each stage is driven by declarative specifications stored in the database — not code. Today the system runs 62 specs covering personality measurement, learning style detection, memory consolidation (SM-2 spaced repetition), engagement scoring, cognitive load management, and safety guardrails. Adding a new measurement or adaptation behaviour is a configuration change, not a development cycle.

The pipeline produces something no competitor has: a **per-learner adaptive profile** that persists across sessions and compounds over time. The fifth call is qualitatively different from the first — the AI knows what this learner finds difficult, how they prefer to be challenged, what they've forgotten, and what to reinforce next. This is the 2-sigma mechanism made algorithmic.

---

### 2. Institutional control eliminates the hallucination problem

The buyer is an institution. They upload their existing materials — textbooks, policy documents, curricula — and the system extracts structured teaching points automatically. A content trust pipeline classifies every assertion by provenance and confidence level before it reaches a learner. The AI teaches only what the institution has approved. It cannot improvise facts, invent content, or drift off-syllabus.

This is the critical difference between "AI in education" (which terrifies procurement teams) and a controlled instructional engine (which they will buy).

<!-- DIAGRAM 2: The Two Surfaces
     Side-by-side showing:
     LEFT: "Educator sees" — conversational wizard, "Tell me about your course..."
     RIGHT: "Learner sees" — a phone call, that's it.
     BELOW BOTH: The engine (62 specs, 7-stage pipeline, content trust, learner profiles)
     Message: radical simplicity hides deep complexity. -->

Setup is fast. A conversational wizard walks an educator through institution creation, course design, content upload, and first-call preview in a single sitting. We call this **conversational application control** — the complexity of a configurable adaptive engine, accessed through a guided conversation. Minutes to deploy, not months of integration.

---

### 3. Go to market

**Phase 1 — Design Partners (now).** Implementing with design partners across both markets in parallel. **Schools:** UK secondary — 100 learners making voice calls, measuring per-topic mastery deltas and before/after assessment outcomes. **Corporate:** compliance and certification training — high-volume, regulation-heavy, immediate ROI case. The goal in both: measurable improvement backed by data, not opinion.

**Phase 2 — Scale (2026–27).** **Schools:** per-institution SaaS across UK secondary and FE — vocabulary-intensive subjects, exam revision, compliance. **Corporate:** professional certification, onboarding, L&D programmes. Marginal cost per session is near zero. Both markets grow from design partner evidence.

**Phase 3 — Platform & Channel.** Platform licensing for L&D and EdTech companies who embed the adaptive engine inside their own products. One integration = access to their entire customer base. Second revenue line without additional go-to-market cost.

---

### 4. The B2B platform opportunity: components, not applications

The enterprise software market is shifting from monolithic suites to composable platforms — best-of-breed components that thread into existing business stacks via APIs. This pattern is now reaching L&D, HR, and education technology. Buyers do not want a standalone tutoring product. They want an adaptive learning capability they can embed inside the systems they already own.

HumanFirst is built for this. The architecture separates into embeddable components:

- **Adaptive pipeline** — API-callable engine: transcript in, personalised prompt out. Any conversational application can call it.
- **Content ingestion** — upload documents, get structured teaching points with provenance and confidence scoring.
- **Learner profile store** — persistent, cross-session adaptive profiles that any front-end can read and write to.
- **Spec library** — 62 declarative specifications. Partners configure behaviour by selecting specs, not writing code.

<!-- DIAGRAM 3: Platform Component Model
     Three boxes at top: LMS (Moodle/Canvas), HR Suite (Workday), Own App (school portal)
     All connect via API arrow down to:
     HumanFirst Engine box containing: Adaptive Pipeline | Content Ingestion | Learner Profiles
     Message: one integration, every customer they serve. -->

Three market entry modes: **direct product** (schools use it end-to-end), **platform component** (L&D software companies embed the engine via API), and **white-label** (enterprises deploy under their own brand). One LMS partnership puts the engine in front of every customer they already serve. Cornerstone, Docebo, Moodle, and dozens of mid-market platforms all face the same gap: static content, multiple-choice assessments, no adaptive conversation capability. HumanFirst is the component that upgrades them.

The window is 12–18 months before the major LMS vendors attempt to build this themselves. Enterprise AI budgets are large and growing, but buyers are wary of "AI-washed" products. A spec-driven engine with measurable outcomes and institutional control is what a serious platform buyer evaluates for.

---

### The market

The global private tutoring market is $120B (7% CAGR). Corporate L&D exceeds $380B. Both share the same structural inefficiency: expert instruction does not scale with headcount. Every solution today is either human-dependent (expensive, inconsistent) or shallow AI (no memory, no adaptation, no institutional control). The defensibility is in the pipeline, not the model. LLMs are commoditising. The adaptive loop is what produces learning outcomes.

---

### Risks and challenges

We present these directly because investors who understand AI will identify them anyway.

**1. The evidence gap.** No one has proven the 2-sigma effect transfers to voice AI at scale. Phase 1 is designed to produce exactly this evidence — per-topic mastery deltas, before/after assessments, teacher testimony. If the data does not show measurable improvement, we do not have a business. We are structured to find out fast and cheaply.

**2. Foundation model and voice infrastructure dependency.** The engine sits on top of LLMs and voice providers we do not control. Commoditisation drives input costs down but creates supply-chain risk. Mitigation: the pipeline is model-agnostic (Claude, GPT-4, Gemini today via single config change) and we are building a voice provider abstraction layer. The value is in the adaptive loop, not the model call.

**3. Education is a slow buyer; regulation is heavy.** Schools have long procurement cycles and limited budgets. Serving minors triggers the highest tier of data protection (GDPR age-appropriate design, emerging AI-in-education regulation). We sell bottom-up to teachers, not top-down to CIOs. Enterprise L&D (adults, corporate data) carries lower regulatory friction — one reason it is Phase 3, not Phase 1.

**4. Competition from incumbents.** Khan Academy (Khanmigo), Duolingo (voice AI), Google and Microsoft AI tutoring programmes — well-funded and well-distributed. Our position: they are building features within existing products. None run a closed-loop adaptive pipeline with persistent learner profiles and institutional content control. The risk is that "good enough" from a trusted brand satisfies the market before deep adaptation proves its value. Speed of evidence matters.

**5. Unit economics depend on inference costs declining.** A single session involves multiple LLM calls across pipeline stages. Per-session cost is manageable at premium pricing but would compress margins at scale with low-price-point buyers. We are betting — with the market — that inference costs continue to fall 50–70% annually. If that stalls, the pipeline must become more token-efficient. A tractable engineering problem, but real.
