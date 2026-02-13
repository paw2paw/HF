## Introduction

HF is a behaviour-driven, memory-adaptive conversational AI platform. It builds
rich personality profiles from live conversations, extracts and recalls memories,
and composes personalised prompts that make every interaction feel human.

### What you can do with the API

| Capability | Description |
|-----------|-------------|
| **Caller Management** | Create and query caller profiles, memories, and personality data |
| **Call Processing** | Submit transcripts, trigger the analysis pipeline, retrieve insights |
| **Prompt Composition** | Generate context-aware system prompts for any LLM |
| **Behaviour Specs** | Define, activate, and query BDD analysis specifications |
| **Playbooks** | Configure domain-specific conversation playbooks |
| **Webhooks** | Receive real-time event notifications for pipeline completions |

### Deployment models

HF supports two deployment models:

- **Cloud** -- Managed multi-tenant SaaS at `https://api.hf.app`
- **Self-hosted** -- Run the full stack in your own infrastructure

Both models expose the same REST API surface. All endpoints documented here
work identically in either deployment.

### Open standards

- All request and response bodies are **JSON** (`application/json`).
- Dates are **ISO 8601** strings in UTC.
- IDs are **UUIDs** (v4) unless otherwise noted.
- The API follows REST conventions with standard HTTP status codes.
