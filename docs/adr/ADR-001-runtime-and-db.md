# ADR-001 — Runtime, Database, and Admin UI

## Status
Proposed

## Context
HF needs a server-side runtime to support:
- Prompt composition
- Injection scheduling
- Transcript and event storage
- Memory extraction
- Admin configuration

Initial development will run locally on a Mac, with future deployment to a server.

## Decision
- Runtime: Node.js with TypeScript
- Database: PostgreSQL (local via Docker for dev)
- Admin UI: Web-based UI (minimal, internal-only)

## Consequences
- Enables BDD via cucumber-js
- Keeps Admin UI accessible without native tooling
- PostgreSQL schema can evolve toward production needs

## Alternatives considered
- SQLite: simpler, but less representative of production
- Native admin app: too heavy for MVP
- Serverless-only approach: complicates local deterministic testing

## Date
2025-12-18
