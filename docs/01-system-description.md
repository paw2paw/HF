# SYS-001 — System Description (HF)

## 1) One-line definition
HF is a configurable voice-conversation platform that composes layered prompts, injects updates mid-session, logs transcripts/events, extracts structured memories, and produces next-call parameters to improve future conversations.

## 2) Target outcomes (MVP)
- Demonstrate prompt composition from layers and mid-call injection at T+N seconds.
- Persist call events and transcripts.
- Run memory extraction into a structured store (facts, preferences, traits, style indicators).
- Provide an admin view to inspect calls, injections, and memories, and toggle configuration.

## 3) Actors
- End user: participates in a conversation.
- Operator/Admin: configures prompt layers, schedules, and reviews outcomes.
- Collaborator/Reviewer: contributes to specs and code via Git/Notion.

## 4) System boundaries
Inside HF:
- Prompt composition (layering + runtime parameters)
- Injection scheduler
- Session/event store
- Memory extraction pipeline
- Admin UI and config store

Outside HF (integrations / dependencies):
- Voice/telephony provider (e.g., VAPI) or realtime voice engine
- LLM provider (OpenAI)
- Optional automation/orchestration (Make/Airtable) — later

## 5) Core workflows
### 5.1 Session start → prompt composition
- A session starts for a user.
- HF composes an initial prompt from:
  - Foundation/system rules
  - Context layer (session purpose, constraints)
  - Personality/style layer (current best estimate)
  - Memory layer (relevant prior facts/preferences)
  - Guardrails/policy layer

### 5.2 Mid-session injection
- At configured times or triggers, HF composes an updated prompt (or instruction set).
- HF injects it into the active session.
- HF logs an InjectionEvent with timestamp, reason, and diff metadata (where possible).

### 5.3 Transcript/event logging
- HF captures turns/transcripts and key events (start/end, injections, tool calls, errors).
- HF stores them with correlation IDs for auditability.

### 5.4 Memory extraction
- HF processes transcript into structured MemoryItems:
  - type (fact/preference/trait/style)
  - value
  - confidence
  - provenance (where it came from)
  - decay/weighting metadata
- HF stores MemoryItems and makes them queryable for future sessions.

### 5.5 Next call parameters (NBM)
- HF produces “next call” parameters from memory + rules:
  - preferred tone, pacing, structure
  - prompts to ask next
  - safety boundaries
- MVP: LLM-only NBM. Later: hybrid/learned model.

## 6) Non-goals (MVP)
- Full multi-tenant enterprise admin
- Perfect personality inference
- Full experimentation platform

## 7) Key risks
- Drift between Notion and Git: mitigated by Ways of Working + IDs.
- Flaky tests due to time/external APIs: mitigated by deterministic test mode + stubs.
- Privacy/PII: mitigated by explicit data inventory + retention policy (to be defined).