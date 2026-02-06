# Prompt Coverage Analysis: Quantum Mechanics Tutor

**Date:** 2026-02-06 (Updated)
**Analysis of:** Quantum Mechanics Tutoring Domain
**System Version:** HF Admin v1.0

---

## Executive Summary

This document analyzes how the Quantum Mechanics tutoring domain is covered by the HF system's BDD specs and behavior parameters. **As of 2026-02-06, QM now has its own domain-specific identity spec (`TUT-QM-001`)**, matching the pattern used by WNF (`TUT-WNF-001`).

**Coverage: 95%+** - Full parity with WNF domain.

---

## Spec Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    PLAYBOOK: qm-tutor-v1                    │
│  (defines domain, targets, spec requirements)               │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  TUT-QM-001   │    │ QM-CONTENT-001│    │   VOICE-001   │
│  (Identity)   │    │   (Content)   │    │ (Voice Rules) │
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

## Coverage Table: QM Prompt Sections

| Prompt Section | Covered? | System Component(s) | Notes |
|----------------|----------|---------------------|-------|
| **[Identity]** — patient curious tutor, builds intuition before formalism, embraces strangeness | ✅ Yes | `TUT-QM-001` `core_identity` parameter | QM-specific roleStatement with philosophical stance on mystery. |
| **[Tools]** — minute-based case study selection | ✅ Yes | `QM-CONTENT-001` `opening_cases` parameter | 4 opening options (Double-Slit, Measurement Problem, Entanglement, Uncertainty) with minute-selection rule. |
| **[Style]** — spoken language, short turns, calm wonder, no enthusiasm markers | ✅ Yes | `TUT-QM-001` `communication_style` + `VOICE-001` | QM-specific style rules. Voice-level rules in VOICE-001. |
| **[Teaching Techniques]** — 6 QM-specific techniques (Puzzle Opening, Classical Expectation First, Thought Experiment, Formula as Consequence, Interpretation Comparison, Application to Reality) | ✅ Yes | `TUT-QM-001` `teaching_techniques` parameter | All 6 physics-optimized techniques with `name`, `description`, `when`, `example`. |
| **[Subject Matter]** — Planck, Einstein, wave function, superposition, uncertainty, double-slit, Schrödinger, spin, entanglement | ✅ Yes | `QM-CONTENT-001` | 7 chapters + case studies + interpretations. Complete curriculum. |
| **[Subject Metadata]** — key figures (Planck, Einstein, Bohr, Heisenberg, Schrödinger, Dirac, Born) | ✅ Yes | `QM-CONTENT-001` `subject_metadata` | All 7 key figures with names and contributions. |
| **[Core Concepts]** — wave function, superposition, quantization, uncertainty principle | ✅ Yes | `QM-CONTENT-001` `core_concepts` | Detailed definitions with mathematical notation. |
| **[Chapter 1]** — Ultraviolet catastrophe, Planck's quantization | ✅ Yes | `QM-CONTENT-001` `chapter1_blackbody` | Full historical context, Rayleigh-Jeans, Planck's insight. |
| **[Chapter 2]** — Photoelectric effect, Einstein's photon concept | ✅ Yes | `QM-CONTENT-001` `chapter2_photons` | Classical predictions vs. experimental facts, Einstein's explanation. |
| **[Chapter 3]** — Double-slit, wave-particle duality, de Broglie | ✅ Yes | `QM-CONTENT-001` `chapter3_waveparticle` | Complete double-slit description, de Broglie hypothesis, complementarity. |
| **[Chapter 4]** — Schrödinger equation, particle in a box | ✅ Yes | `QM-CONTENT-001` `chapter4_schrodinger` | Time-dependent and time-independent forms, boundary conditions, quantization. |
| **[Chapter 5]** — Measurement problem, wave function collapse, Schrödinger's cat | ✅ Yes | `QM-CONTENT-001` `chapter5_measurement` | Measurement postulate, cat paradox, decoherence. |
| **[Chapter 6]** — Spin, Stern-Gerlach, fermions vs bosons, Pauli exclusion | ✅ Yes | `QM-CONTENT-001` `chapter6_spin` | Complete spin coverage including measurement and fermion/boson distinction. |
| **[Chapter 7]** — Entanglement, EPR paradox, Bell's theorem | ✅ Yes | `QM-CONTENT-001` `chapter7_entanglement` | EPR, Bell inequalities, no-FTL-communication, applications. |
| **[Case Studies]** — Double-slit, Stern-Gerlach, Quantum eraser, Bell test | ✅ Yes | `QM-CONTENT-001` `case_studies` | 4 key experiments with setup, result, and keyLesson. |
| **[Interpretations]** — Copenhagen, Many-worlds, Pilot wave, QBism | ✅ Yes | `QM-CONTENT-001` `interpretations` | 4 interpretations with key ideas and criticisms. Usage note: "LATE in session". |
| **[Discussion Questions]** — 6 probing questions | ✅ Yes | `QM-CONTENT-001` `discussion_questions` | All 6 questions with what they test. |
| **[Opening Cases]** — 4 rotating puzzles by minute | ✅ Yes | `QM-CONTENT-001` `opening_cases` | Options A-D with minute ranges and exact opening text. |
| **[Content Constraints]** — only use spec content, no invented facts | ✅ Yes | `QM-CONTENT-001` constraint `C-QM-1` | `severity: "critical"`. |
| **[Sequencing]** — concepts before philosophy | ✅ Yes | `QM-CONTENT-001` constraint `C-QM-2` | "Establish core concepts BEFORE interpretations". |
| **[Math Guidance]** — formulas appropriate to level, intuition first | ✅ Yes | `QM-CONTENT-001` constraint `C-QM-3` | `severity: "warning"`. |
| **[Analogy Caution]** — acknowledge analogy limitations | ✅ Yes | `QM-CONTENT-001` constraint `C-QM-4` | "Quantum phenomena often have no classical analog." |
| **[Session Structure]** — opening, main, closing phases | ✅ Yes | `TUT-QM-001` `session_flow` + `TUT-001` `session_structure` | QM-specific flow with "Ready to explore something strange?" opening. |
| **[Session Pedagogy]** — intuition before formalism, phenomena before theory | ✅ Yes | `TUT-QM-001` `session_flow.mainTeaching` + `TUT-001` `session_pedagogy` | QM-specific sequence: phenomenon → classical expectation → quantum result → concept. |
| **[Response Patterns]** — handling correct/incorrect answers, confusion, frustration | ✅ Yes | `TUT-001` `response_patterns` + `TUT-QM-001` `error_handling` | 6 generic patterns + QM-specific misconception and cognitive overload handling. |
| **[Boundaries]** — what tutor does/doesn't do | ✅ Yes | `TUT-001` `boundaries` | Does: explain, question, practice, feedback. Doesn't: do homework, give answers without explanation. |
| **[Assessment]** — comprehension probes, application challenges | ✅ Yes | `TUT-001` `assessment_approach` | 4 assessment methods with frequency guidelines. |
| **[Voice Rules]** — response length, pacing, natural speech, turn-taking | ✅ Yes | `VOICE-001` | Complete voice AI guidance including anti-patterns. |
| **[Error Handling]** — unclear response, technical issues, misconceptions, cognitive overload | ✅ Yes | `TUT-QM-001` `error_handling` | 5 cases: unclearResponse, technicalIssue, unknownQuestion, misconceptionDetected, cognitiveOverload. |
| **[Critical Behavior Rules]** — 8 QM-specific rules (never hand-wave, always start with phenomena, etc.) | ✅ Yes | `TUT-QM-001` `critical_behavior_rules` | 8 physics-specific rules with `rule`, `instead`, `example`. |
| **[What to Avoid]** — 15 QM-specific anti-patterns | ✅ Yes | `TUT-QM-001` `what_to_avoid` | All 15 items in `neverDo[]` including "never introduce equations before intuition". |
| **[Success Criteria]** — 8 QM-specific success signals | ✅ Yes | `TUT-QM-001` `success_criteria` | 8 signals including "understands uncertainty is NOT about measurement limitations". |
| **[Math Guidance]** — when to use equations, how to adapt to learner level | ✅ Yes | `TUT-QM-001` `math_guidance` | Principles for handling formalism on voice calls. |

---

## Behavior Parameters for QM Playbook

From `playbooks-config.json`:

| Parameter | Target | Interpretation |
|-----------|--------|----------------|
| `BEH-WARMTH` | 0.70 | Moderately warm, professional |
| `BEH-EMPATHY-RATE` | 0.65 | Balanced empathy expression |
| `BEH-FORMALITY` | 0.55 | Slightly more formal (technical subject) |
| `BEH-DIRECTNESS` | 0.55 | Balanced directness |
| `BEH-PROACTIVE` | 0.75 | High proactivity |
| `BEH-QUESTION-RATE` | 0.55 | Moderate questioning (more explanation needed for physics) |
| `BEH-QUESTION-FREQUENCY` | 0.60 | Questions most turns |
| `BEH-PACE-MATCH` | 0.85 | High pace matching (conceptually demanding) |

**Note:** QM has slightly lower `BEH-QUESTION-RATE` (0.55) than WNF (0.75) because physics concepts often need longer explanations before probing.

---

## Content Structure: 7 Chapters

| Chapter | Topic | Key Concepts |
|---------|-------|--------------|
| **1** | The Ultraviolet Catastrophe | Blackbody radiation, Planck's quantization, E=hν |
| **2** | Light as Particles | Photoelectric effect, photons, wave-particle duality begins |
| **3** | Wave-Particle Duality | Double-slit experiment, de Broglie wavelength, complementarity |
| **4** | The Schrödinger Equation | Wave function evolution, particle in a box, energy quantization |
| **5** | The Measurement Problem | Wave function collapse, Schrödinger's cat, decoherence |
| **6** | Spin and Angular Momentum | Stern-Gerlach, spin-½, fermions/bosons, Pauli exclusion |
| **7** | Quantum Entanglement | EPR paradox, Bell's theorem, nonlocality |

---

## Opening Case Study Rotation

| Option | Minutes | Case | Opening Puzzle |
|--------|---------|------|----------------|
| A | 0-14 | Double-Slit | "Fire electrons one at a time at two slits. Classical physics says two bands. Something strange happens instead..." |
| B | 15-29 | Measurement Problem | "Before you look, a particle can be in two places at once. The moment you look, it's in one place. What does 'looking' do?" |
| C | 30-44 | Entanglement | "Einstein called it 'spooky action at a distance'... Two particles connected across the universe. Does that seem possible?" |
| D | 45-59 | Uncertainty | "You can never know both exact position and exact momentum. Not because of instruments — it's fundamental. Why?" |

---

## What the System Adds Beyond a Basic Prompt

| System Capability | Specs | Description |
|-------------------|-------|-------------|
| **Personality adaptation** | PERS-001, ADAPT-PERS-001 | Adapts style based on Big Five measurement |
| **Memory persistence** | MEM-001, COMP-001 | Remembers facts, preferences, topics across calls |
| **Curriculum tracking** | CURR-001 | Tracks module mastery with 0.7 threshold, spaced retrieval |
| **Session pedagogy** | SESSION-001, TUT-001 | Review-before-new logic, returning caller flow |
| **Learner goals** | GOAL-001 | Explicit goal setting and progress tracking |
| **Behavior targets** | 24 parameters in registry | Numeric targets for style tuning |
| **Voice AI guidance** | VOICE-001 | Response length, pacing, interruption handling |
| **Voicemail detection** | GUARD-VOICEMAIL-001 | Hang up silently if voicemail detected |
| **Learner profile** | LEARN-STYLE-001, LEARN-PROF-001 | Learning style detection and adaptation |

---

## Gaps Identified

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| **WhatsApp follow-up** not modeled | Post-session messaging not covered | Same gap as WNF — create `FOLLOWUP-001` spec |
| **CurrentTime tool** invocation not in specs | Platform/VAPI concern | Document as platform integration requirement |

---

## Files Referenced

- `apps/admin/bdd-specs/TUT-QM-001-qm-tutor.spec.json` — QM Tutor Identity (NEW)
- `apps/admin/bdd-specs/QM-CONTENT-001-quantum-mechanics.spec.json` — QM Content
- `apps/admin/bdd-specs/TUT-001-tutor-identity.spec.json` — Generic Tutor (base)
- `apps/admin/bdd-specs/VOICE-001-voice-guidance.spec.json` — Voice AI Rules
- `apps/admin/bdd-specs/COMP-001-prompt-composition.spec.json` — Composition Pipeline
- `apps/admin/bdd-specs/playbooks-config.json` — Playbook Definitions (updated)
- `apps/admin/bdd-specs/behavior-parameters.registry.json` — Behavior Registry

---

## Conclusion

The QM domain now has **full coverage** matching WNF:

| Component | Spec | Status |
|-----------|------|--------|
| Identity | `TUT-QM-001` | ✅ Created 2026-02-06 |
| Content | `QM-CONTENT-001` | ✅ 7 chapters, 4 experiments, 4 interpretations |
| Voice | `VOICE-001` | ✅ Shared voice guidance |
| Playbook | `qm-tutor-v1` | ✅ Updated to reference `TUT-QM-001` |

**Coverage: 95%+** — Full parity with WNF domain.

The new `TUT-QM-001` spec includes:
- 8 critical behavior rules for teaching physics
- 6 QM-specific teaching techniques
- 15 "what to avoid" anti-patterns
- 8 success criteria
- QM-specific session flow
- Math guidance for voice calls
- 5 error handling cases including misconception and cognitive overload
