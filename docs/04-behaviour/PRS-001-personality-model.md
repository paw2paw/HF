# PRS-001 — Personality & Style Model (MVP)

## Status
Proposed

## Purpose
Define how HF represents inferred personality and conversational style preferences, how they are updated, and how they influence prompts and rewards.

## Scope (MVP)
- Text-first inference from transcripts
- Optional user-provided preference inputs (explicit)
- Voice-derived signals are out of scope for MVP (reserved fields only)

## Models in scope
### 1) Big Five trait scores (primary)
Continuous scores in [0, 1] with confidence and decay:
- openness
- conscientiousness
- extraversion
- agreeableness
- neuroticism (or emotional_stability = 1 - neuroticism)

### 2) Style Indicators (primary)
Continuous scores in [0, 1] with confidence and decay:
- verbosity_preference (short ↔ long)
- directness_preference (gentle ↔ direct)
- pacing_preference (slow ↔ fast)
- question_density_preference (few ↔ many)
- reflection_vs_action_preference (reflect ↔ act)
- topic_shift_tolerance (low ↔ high)

## Data schemas
### TraitScore
```json
{
  "user_id": "u_123",
  "model": "big5",
  "trait": "openness",
  "value": 0.0,
  "confidence": 0.0,
  "half_life_days": 30,
  "provenance": {
    "source": "evaluation_agent",
    "session_id": "s_abc",
    "evidence_turn_ids": ["t_01", "t_07"]
  },
  "updated_at": "ISO-8601"
}