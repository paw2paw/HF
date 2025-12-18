# ARC-001 — Business Context

## Context
HF enables configurable voice conversations that improve over time using structured memory extraction and runtime prompt injection.

## Actors and external systems
- End user (caller)
- Operator/Admin
- Voice provider (e.g., VAPI / realtime engine)
- LLM provider (OpenAI)
- Data store (DB)
- Notion (planning/index only)

## Context diagram (Mermaid)
```mermaid
flowchart LR
  User[End User] -->|Voice conversation| Voice[Voice Provider / Realtime Engine]
  Admin[Operator/Admin] -->|Configure + review| HF[HF Platform]

  Voice -->|Events + transcript| HF
  HF -->|Prompt updates/injections| Voice

  HF -->|LLM calls| LLM[LLM Provider]
  LLM -->|Responses/outputs| HF

  HF --> DB[(Database)]
  Admin -->|Status/notes| Notion[Notion (index)]
  Notion -->|Links to artefacts| Git[(Git Repo)]
  HF -->|Specs/tests/code| Git