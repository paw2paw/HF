---

### 3) `docs/05-data/MEM-001-memory-taxonomy.md`
```md
# MEM-001 — Memory Taxonomy, Lifecycle, and Retrieval (MVP)

## Status
Proposed

## Purpose
Define what “memory” means in HF: item types, required fields, decay/weighting rules, and retrieval policy for prompt composition.

## Memory item types (MVP)
1) fact — relatively stable information (e.g., “lives in London”)
2) preference — likes/dislikes and choices (e.g., “prefers concise answers”)
3) constraint — boundaries/sensitivities (e.g., “avoid topic X”)
4) goal — user intent over time (e.g., “improve confidence speaking”)
5) trait — personality trait scores (from PRS-001)
6) style — style indicators (from PRS-001)

## MemoryItem schema (MVP)
```json
{
  "memory_id": "m_001",
  "user_id": "u_123",
  "type": "preference",
  "key": "verbosity_preference",
  "value": "prefers concise answers",
  "value_json": { "scale_0_1": 0.2 },
  "confidence": 0.0,
  "importance": 0.0,
  "half_life_days": 30,
  "status": "active",
  "provenance": {
    "source": "evaluation_agent",
    "session_id": "s_abc",
    "evidence_turn_ids": ["t_03"]
  },
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}