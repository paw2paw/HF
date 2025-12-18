# BDD-001 — MVP Feature Map (Thin Vertical Slice)

## Status
Proposed

## Goal
Deliver an end-to-end, demoable slice of HF that proves:
1) layered prompt composition works
2) mid-session prompt injection works at T+N
3) transcripts/events are persisted
4) memory extraction produces structured MemoryItems
5) an admin can inspect outcomes and toggle config

## Scope (MVP)
### In
- Create user + start session
- Compose initial prompt from layers (foundation/context/style/memory/guardrails)
- Injection scheduler triggers at configured time (e.g. 30s)
- Injection is sent to voice/session provider adapter (stubbed for MVP)
- Persist events + transcript turns
- Extract memories from transcript into structured store
- Minimal admin UI endpoints to:
  - toggle injections on/off
  - set injection time(s)
  - view sessions + injection events + memories

### Out
- Real telephony reliability/edge cases
- Full multi-tenant permissions model
- Perfect personality inference / long-term learning model
- Complex A/B testing framework

## Personas
- End User: participates in a call/session
- Operator/Admin: configures layers and injection schedules; inspects outcomes

## Feature list (MVP)
F1. Session lifecycle (start/end)
F2. Prompt composition (layering)
F3. Prompt injection (scheduled)
F4. Event + transcript logging
F5. Memory extraction + storage
F6. Admin configuration + inspection (minimal)

## Story map (MVP journey)
### User journey: “Run one adaptive session”
1. Start session for user
2. Compose initial prompt from layers
3. (Time passes) trigger injection at T+N
4. Log injection + turns/events
5. End session
6. Process transcript → memory items
7. Admin inspects session + memories and adjusts config

## Acceptance criteria (P0)
### P0-1 Session start/end
- Starting a session returns a unique session ID and initial prompt metadata.
- Ending a session marks it immutable for further injections.

### P0-2 Prompt composition
- Initial prompt is composed deterministically from configured layers.
- Composition output includes which layers were used + version IDs.

### P0-3 Scheduled injection
- At T+N seconds, if session is active and injections enabled:
  - an InjectionEvent is created
  - the provider adapter receives the injected prompt payload
- If session ended before T+N:
  - no injection occurs
  - no InjectionEvent is created

### P0-4 Logging
- Session has an audit log that includes:
  - session_started
  - prompt_composed (initial)
  - prompt_injected (if applicable)
  - session_ended
- Transcript turns are persisted (even if minimal for MVP)

### P0-5 Memory extraction
- Processing a transcript produces one or more MemoryItems with:
  - type (fact | preference | trait | style)
  - value
  - confidence (0..1)
  - provenance (source session + turn references)
  - decay metadata (e.g., halfLifeDays or similar)
- MemoryItems are queryable by user ID.

### P0-6 Admin controls
- Admin can:
  - enable/disable injections
  - set T+N injection time (seconds)
  - view sessions list
  - open a session to view injections + audit log + transcript
  - view memories for a user

## BDD coverage plan (Gherkin features)
### Feature: prompt_injection.feature
Scenarios:
- Inject at T+N and log event
- Skip injection if session ended
- Disable injections blocks runtime injection

### Feature: prompt_composition.feature
Scenarios:
- Compose from foundation+context+style+memory+guardrails
- Missing optional layer still composes (graceful degrade)
- Composition includes layer provenance

### Feature: memory_extraction.feature
Scenarios:
- Extract MemoryItems from transcript fixture
- Confidence and decay metadata populated
- Query returns stored memories

### Feature: admin_configuration.feature
Scenarios:
- Admin updates injection time and it takes effect next session
- Admin disables injections and no injection occurs

## Test mode requirements (for deterministic BDD)
The runtime MUST support:
- deterministic time control in test mode:
  - POST /__test__/time/advance { seconds }
- state reset between scenarios:
  - POST /__test__/reset
- stubbed provider adapters for voice + LLM:
  - no live external calls in BDD runs

## Primary demo script (what “done” looks like)
1) Configure injection at 30s (enabled)
2) Start session for user u_123
3) Show initial prompt composed with layer provenance
4) Advance time by 30s → show injection event created and sent to stub provider
5) End session → show audit log
6) Run memory extraction on transcript fixture → show MemoryItems stored
7) Admin UI lists session + memories and toggles injections off

## Open questions
- Exact layer storage format (DB tables vs config files)
- Memory schema (minimum types/fields)
- Provider adapter contract (VAPI vs internal realtime engine)