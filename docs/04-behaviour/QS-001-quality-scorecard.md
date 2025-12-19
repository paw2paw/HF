---

### 2) `docs/04-behaviour/QS-001-quality-scorecard.md`
```md
# QS-001 — Conversation Quality Scorecard (MVP)

## Status
Proposed

## Purpose
Define the quality dimensions HF evaluates after a session, their scoring scales, and how scores drive memory updates and baseline improvements.

## Scope (MVP)
- Transcript-first scoring via EvaluationAgent rubric
- Optional user feedback input (1–5 rating + free text)
- Audio/voice features are out of scope for MVP (reserved fields only)

## Output format
- Each metric: score in [0..100], rationale, evidence turn IDs
- An overall score in [0..100]
- A set of “actions” recommended for ImprovementAgent

## Metrics (MVP set)
### Q1 Topic adherence
- Score meaning: stayed aligned with the intended topic while allowing natural dialogue
- Evidence: turns where topic drift occurred vs recovered

### Q2 Emotional attunement
- Score meaning: acknowledged emotions appropriately; avoided tone mismatch
- Evidence: user affect indicators + assistant responses

### Q3 Engagement / responsiveness
- Score meaning: user stayed engaged; assistant responses invited continuation
- Evidence: user reply length, explicit engagement cues, drop-offs

### Q4 Pacing & flow
- Score meaning: conversation rhythm felt smooth; no excessive back-to-back questions
- Evidence: question density; turn length variability

### Q5 Question effectiveness
- Score meaning: questions were relevant, timely, and produced useful answers
- Evidence: user response richness following questions

### Q6 Memory usage quality
- Score meaning: referenced memory when helpful; avoided inappropriate/incorrect recall
- Evidence: memory references and user reaction

### Q7 Clarity / structure
- Score meaning: assistant was clear, not rambling, and guided the conversation
- Evidence: repeated clarifications, confusion markers

### Q8 User feedback score (optional)
- Direct mapping from explicit rating (if provided)

## EvaluationResult schema (MVP)
```json
{
  "session_id": "s_abc",
  "user_id": "u_123",
  "overall_score": 0,
  "metrics": [
    {
      "name": "topic_adherence",
      "score": 0,
      "rationale": "short explanation",
      "evidence_turn_ids": ["t_02", "t_04"]
    }
  ],
  "observations": [
    "bullet observation 1",
    "bullet observation 2"
  ],
  "recommended_actions": [
    {
      "action": "increase_memory_usage",
      "strength": 0.0,
      "why": "short reason"
    }
  ],
  "inputs": {
    "has_audio_features": false,
    "has_user_feedback": false
  },
  "created_at": "ISO-8601",
  "evaluator_version": "eval-1"
}