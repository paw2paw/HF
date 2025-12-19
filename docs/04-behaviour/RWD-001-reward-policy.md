---

### 4) `docs/04-behaviour/RWD-001-reward-policy.md`
```md
# RWD-001 — Reward Policy and Baseline Adjustment (MVP)

## Status
Proposed

## Purpose
Define the “reward system” that converts quality outcomes into next-session baseline adjustments, while respecting constraints and safety.

## Concept
- EvaluationAgent produces scores + recommended_actions (QS-001)
- RewardPolicyEngine converts these into a parameter update
- BaselineGenerator emits a versioned BaselineSnapshot

MVP uses a rule+LLM hybrid:
- Rules for hard constraints and safe bounds
- LLM (optional) for nuanced recommendation text (not required for first slice)

## Objectives (MVP)
Primary objectives to maximize:
- engagement / responsiveness (QS-001 Q3)
- emotional attunement (Q2)
- question effectiveness (Q5)
- user feedback score (Q8, if present)

Constraints (must maintain):
- topic adherence within configured tolerance (Q1)
- memory usage must not be incorrect or intrusive (Q6)
- any “constraint” memory items are always respected (MEM-001)

## Parameter bundle (baseline knobs)
These are the only knobs the reward system can change in MVP:

- memory_injection_strength: 0..1
- question_ratio: 0..1
- directness: 0..1
- verbosity: 0..1
- pacing: 0..1
- topic_shift_tolerance: 0..1
- reflection_vs_action: 0..1
- empathy_strength: 0..1

## BaselineSnapshot schema (MVP)
```json
{
  "baseline_id": "b_002",
  "user_id": "u_123",
  "derived_from": "b_001",
  "params": {
    "memory_injection_strength": 0.5,
    "question_ratio": 0.5,
    "directness": 0.5,
    "verbosity": 0.5,
    "pacing": 0.5,
    "topic_shift_tolerance": 0.5,
    "reflection_vs_action": 0.5,
    "empathy_strength": 0.5
  },
  "reasons": [
    "Q4 pacing low → reduce question_ratio",
    "Q2 attunement low → increase empathy_strength"
  ],
  "created_at": "ISO-8601",
  "generator_version": "baseline-gen-1"
}