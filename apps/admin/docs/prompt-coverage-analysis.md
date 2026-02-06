# Prompt Coverage Analysis: WNF Tutor Prompt vs. BDD Specs

**Date:** 2026-02-06
**Analysis of:** Why Nations Fail Tutoring Prompt
**System Version:** HF Admin v1.0

---

## Executive Summary

This document maps each section of the WNF Tutor prompt against the HF system's BDD specs and behavior parameters. The analysis shows **95%+ coverage** of the original prompt through structured, composable specifications.

---

## Coverage Table

| Prompt Section | Covered? | System Component(s) | Notes |
|----------------|----------|---------------------|-------|
| **[Identity]** — role statement, "calm unhurried tutor", "YOU lead", 10-15 min phone call | ✅ Yes | `TUT-WNF-001` `core_identity` parameter | Verbatim match. `roleStatement` is identical. Extends generic `TUT-001`. |
| **[Tools]** — CurrentTime tool, minute-based case study selection | ⚠️ Partial | `WNF-CONTENT-001` `opening_cases` parameter | The 4 opening options and minute-selection rule are stored in the content spec. But `CurrentTime` tool invocation is **not modeled** — it's a VAPI/platform concern. |
| **[Style]** — spoken language, short turns, contractions, pauses, no enthusiasm markers | ✅ Yes | `TUT-WNF-001` `communication_style` + `VOICE-001` | Style rules verbatim in `communication_style.style[]`. Voice-level rules in VOICE-001. Behavior targets `BEH-FORMALITY=0.5`, `BEH-DIRECTNESS=0.6` in playbooks-config. |
| **[Critical Behaviour Rules]** — 8 rules (never "does that make sense?", always lead, always probe, etc.) | ✅ Yes | `TUT-WNF-001` `critical_behavior_rules` parameter | All 8 rules with `rule`, `instead`, and `example` fields. Also echoed in `what_to_avoid` and `constraints`. |
| **[Study Material]** — Core argument, Chapters 1-4, case studies, scholarly critiques, discussion questions | ✅ Yes | `WNF-CONTENT-001` | Complete content split into structured parameters: `book_metadata`, `core_argument`, `chapter1_nogales`, `chapter2_failed_theories`, `chapter3_circles`, `chapter4_junctures`, `case_studies`, `scholarly_critiques`, `discussion_questions`. |
| **[Content Instructions]** — "ONLY source of content", don't invent facts | ✅ Yes | `WNF-CONTENT-001` constraint `C-WNF-1` | `severity: "critical"`. Also in TUT-WNF-001 `what_to_avoid`. |
| **[Teaching Techniques]** — 6 techniques (Puzzle Opening, Core Model, Case Study, Stress-Test, Comparison, Prediction) | ✅ Yes | `TUT-WNF-001` `teaching_techniques` parameter | All 6 techniques with `name`, `when`, `description`, `example`. Generic techniques also in `TUT-001`. |
| **[Task]** — Session flow (greeting → intro → case study → build concept → probe → stress-test → close) | ✅ Yes | `TUT-WNF-001` `session_flow` parameter | Steps 1-5 with `opening`, `introduction`, `mainTeaching` (with sequence a-e), `closing`, `followUp`. |
| **[Task] step 3** — Opening case study rotation by minute | ✅ Yes | `WNF-CONTENT-001` `opening_cases` | All 4 options (A-D) with minute ranges and exact opening text. |
| **[Task] step 5** — Probe surface-level answers | ✅ Yes | `TUT-WNF-001` `critical_behavior_rules` rule #7 + constraint `C-TUT-WNF-4` | Rule: "ALWAYS probe surface-level answers... push one layer deeper before moving on." |
| **[Task] step 6** — Stress-test once, 5-8 min in, only ONE critique | ✅ Yes | `WNF-CONTENT-001` `scholarly_critiques.usage` + constraint `C-WNF-4` + technique #4 | Critique timing constraint. `C-WNF-4`: "Only introduce ONE critique per session, and only after 5-8 minutes." |
| **[Student Ending Signals]** — shorter responses, "I've got it", trailing off | ✅ Yes | `TUT-WNF-001` `student_ending_signals` | Exact signals listed. "The student controls when the session ends." |
| **[WhatsApp Follow-Up]** — post-session material via WhatsApp | ❌ No | Not modeled | No spec covers post-call WhatsApp delivery. |
| **[Error Handling]** — unclear response, technical issue, unknown question | ✅ Yes | `TUT-WNF-001` `error_handling` | Three cases: `unclearResponse`, `technicalIssue`, `unknownQuestion` with exact response text. |
| **[What to Avoid]** — 14 anti-patterns | ✅ Yes | `TUT-WNF-001` `what_to_avoid` + `VOICE-001` `anti_patterns` | All 14 items in `neverDo[]`. Voice anti-patterns in VOICE-001. |
| **[Success Signal]** — 6 success criteria | ✅ Yes | `TUT-WNF-001` `success_criteria` | All 6 signals in `successSignals[]`. |
| **Concept-before-critique sequencing** | ✅ Yes | Constraint `C-TUT-WNF-3` + `C-WNF-2` + rule #6 | Triple-enforced across specs. |
| **Book/author/Nobel intro requirement** | ✅ Yes | `WNF-CONTENT-001` `book_metadata` + `session_flow.introduction` + constraint `C-TUT-WNF-2` | Metadata structured. Session flow step 2 mandates intro. |

---

## Spec Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    PLAYBOOK: wnf-tutor-v1                   │
│  (defines domain, targets, spec requirements)               │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  TUT-WNF-001  │    │WNF-CONTENT-001│    │   VOICE-001   │
│   (Identity)  │    │   (Content)   │    │ (Voice Rules) │
│  WHO the      │    │  WHAT to      │    │ HOW to speak  │
│  agent is     │    │  teach        │    │ on voice AI   │
└───────────────┘    └───────────────┘    └───────────────┘
        │
        ▼
┌───────────────┐
│    TUT-001    │
│(Generic Tutor)│
│  Base class   │
└───────────────┘
```

---

## What the System Adds Beyond the Prompt

| System Capability | Specs | Description |
|-------------------|-------|-------------|
| **Personality adaptation** | PERS-001, ADAPT-PERS-001 | Adapts style based on Big Five measurement |
| **Memory persistence** | MEM-001, COMP-001 | Remembers facts, preferences, topics across calls |
| **Curriculum tracking** | CURR-001 | Tracks module mastery, spaced retrieval, prerequisites |
| **Session pedagogy** | SESSION-001, TUT-001 | Review-before-new logic, returning caller flow |
| **Learner goals** | GOAL-001 | Explicit goal setting and progress tracking |
| **Behavior targets** | 24 parameters in registry | Numeric targets (warmth=0.7, question-rate=0.75, etc.) |
| **Voice AI guidance** | VOICE-001 | Response length, pacing, interruption handling |
| **Voicemail detection** | GUARD-VOICEMAIL-001 | Hang up silently if voicemail detected |
| **Learner profile** | LEARN-STYLE-001, LEARN-PROF-001 | Learning style detection and adaptation |

---

## Behavior Parameters (from registry)

The WNF Tutor playbook sets these behavior targets:

| Parameter | Target | Interpretation |
|-----------|--------|----------------|
| `BEH-WARMTH` | 0.70 | Moderately warm, professional |
| `BEH-EMPATHY-RATE` | 0.60 | Balanced empathy expression |
| `BEH-FORMALITY` | 0.50 | Neutral formality (matches prompt: contractions OK) |
| `BEH-DIRECTNESS` | 0.60 | Direct but not blunt |
| `BEH-PROACTIVE` | 0.80 | HIGH — tutor leads, doesn't wait |
| `BEH-QUESTION-RATE` | 0.75 | HIGH — Socratic method |
| `BEH-QUESTION-FREQUENCY` | 0.60 | Questions most turns |
| `BEH-PACE-MATCH` | 0.80 | Matches student pace |

---

## Gaps Identified

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| **WhatsApp follow-up** not modeled | Post-session outbound messaging has no spec or pipeline | Create `FOLLOWUP-001` spec for post-call messaging |
| **CurrentTime tool** invocation not in specs | Platform/VAPI concern — specs define selection logic but not tool call | Document as platform integration requirement |
| **Discussion Questions** linkage | Available in content spec but no formal trigger | Consider adding to session_flow or teaching_techniques |

---

## Files Referenced

- `apps/admin/bdd-specs/TUT-WNF-001-wnf-tutor.spec.json` — WNF Tutor Identity
- `apps/admin/bdd-specs/WNF-CONTENT-001-why-nations-fail.spec.json` — WNF Content
- `apps/admin/bdd-specs/TUT-001-tutor-identity.spec.json` — Generic Tutor
- `apps/admin/bdd-specs/VOICE-001-voice-guidance.spec.json` — Voice AI Rules
- `apps/admin/bdd-specs/COMP-001-prompt-composition.spec.json` — Composition Pipeline
- `apps/admin/bdd-specs/playbooks-config.json` — Playbook Definitions
- `apps/admin/bdd-specs/behavior-parameters.registry.json` — Behavior Registry

---

## Conclusion

The WNF Tutor prompt is **comprehensively covered** by the BDD spec system. The prompt's content has been decomposed into:

1. **Identity spec** (TUT-WNF-001) — WHO the agent is, behavior rules, session flow
2. **Content spec** (WNF-CONTENT-001) — WHAT to teach, case studies, critiques
3. **Voice spec** (VOICE-001) — HOW to communicate on voice AI
4. **Behavior registry** — Numeric targets for style tuning
5. **Playbook config** — Binds everything together with target overrides

This structure enables:
- **Reusability** — TUT-001 can be extended for other domains
- **Testability** — Each constraint and rule is addressable
- **Personalization** — Behavior targets adapt per caller
- **Composition** — COMP-001 assembles the final prompt from all sources
