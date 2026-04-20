---
name: Tuning Assistant Epic
description: In-app chat panel for course designers to ask natural language tuning questions, answered with live DB context — 3-phase build plan (PARKED)
type: project
---

# Epic: Tuning Assistant — In-App Chat for Course Configuration

**Status:** PARKED — not scheduled. Captured for future sprint planning.

**Why:** Course designers and testers currently navigate raw spec pages and pipeline config to understand what controls course behaviour. This requires technical knowledge that most educators don't have. A chat panel grounded in live DB context removes that friction.

---

## Problem Statement

**Who:** Course designers, HF admin operators, institution testers.

**Pain:** "How do I make pronunciation scoring less strict?" requires the user to know about:
1. PIPELINE-001 REWARD stage
2. `Parameter` records with `parameterType: "BEHAVIOR"`
3. `BehaviorTarget` values and their `interpretationHigh`/`interpretationLow` strings
4. Which `DataContract` governs the relevant output type

None of this is surfaced in plain English anywhere. The agent-tuner (AgentTuner component + `/api/agent-tuner/interpret`) solves the *apply change* problem but not the *learn what to change* problem.

**Goal:** A chat panel where questions like "What controls difficulty progression speed?" are answered with live DB context, course-specific values, and (eventually) direct links to make changes.

---

## What Already Exists — Do NOT Rebuild

| File | What it provides |
|---|---|
| `app/api/chat/route.ts:37` | Multi-mode chat route: DATA / CALL / BUG / WIZARD / COURSE_REF — add TUNING here |
| `app/api/chat/system-prompts.ts` | `buildSystemPrompt()` — switch-cased per mode, extend with TUNING case |
| `app/api/chat/tools.ts` | Tool definition + execution pattern to copy for Phase 3 tools |
| `components/chat/ChatPanel.tsx` | Full chat UI — streaming, breadcrumbs, markdown, mode icons — use as-is |
| `contexts/ChatContext.tsx:7` | `ChatMode = "DATA"` — extend union to add "TUNING" |
| `lib/chat/v5-system-prompt.ts` | Reference for system prompt composition pattern |
| `lib/agent-tuner/interpret.ts` | NL → parameters mapping — reuse `loadAdjustableParameters()` for context |
| `lib/agent-tuner/params.ts` | `loadAdjustableParameters()` + `formatParameterList()` — ready-made parameter catalogue builder |
| `lib/contracts/registry.ts` | `ContractRegistry` with 30s TTL — call `registry.getAll()` for contract catalogue |
| `lib/prompts/spec-prompts.ts` | `getPromptSpec(slug, fallback)` — loads PROMPT-* spec from DB with 30s cache; add PROMPT-TUNA-001 |
| `lib/config.ts:421` | `config.specs.chatDataHelper` pattern — add `config.specs.tuningAssistant` |
| `lib/pipeline/specs-loader.ts` | Bulk spec loading by scope/outputType — for Phase 2 dynamic context |
| `lib/metering/instrumented-ai.ts` | `getConfiguredMeteredAICompletionStream()` — use for streaming responses |
| `lib/permissions.ts` | `requireAuth("OPERATOR")` — same auth level as DATA mode |

---

## Phase 1 — MVP: Static System Prompt with Parameter Catalogue

**Effort: ~6h**

**What it does:** New chat mode "TUNING" backed by a new route branch in `/api/chat`. System prompt includes the full BEHAVIOR parameter catalogue (loaded from DB — same source as agent-tuner), plus all DataContract IDs and descriptions. The assistant answers questions from this static context.

**What it does NOT do:** No course-specific values. No dynamic spec lookup. No apply-change links.

### Needs Building — Phase 1

- `lib/chat/tuning-system-prompt.ts` — builds the TUNING system prompt: parameter catalogue (reuse `loadAdjustableParameters()` + `formatParameterList()`), contract catalogue (reuse `ContractRegistry.getAll()`), pipeline stage descriptions (static string from PIPELINE-001 fallback or `getPromptSpec`)
- `config.specs.tuningAssistant` entry in `lib/config.ts` pointing to a new `PROMPT-TUNA-001` spec slug
- Seed entry for `PROMPT-TUNA-001` (AnalysisSpec with specRole: PROMPT, promptTemplate)
- `contexts/ChatContext.tsx` — add "TUNING" to the ChatMode union and MODE_CONFIG (icon, label, description)
- `app/api/chat/route.ts` — add TUNING branch in the mode switch (no tool calling, streaming only)
- `app/api/chat/system-prompts.ts` — add TUNING case calling `buildTuningSystemPrompt()`
- UI: expose TUNING mode in the chat panel mode selector (operator-only)

### Acceptance Criteria — Phase 1

- [ ] Admin user can switch ChatPanel to "TUNING" mode
- [ ] Question "What parameters affect pronunciation scoring?" returns an answer referencing real parameter names and their `interpretationHigh`/`interpretationLow` strings from DB
- [ ] Question "What does the REWARD stage do?" returns pipeline stage description
- [ ] Question "What is the BEH-WARMTH parameter?" returns its group, high/low descriptions, and current system-level target value
- [ ] Response streams correctly (no buffered response)
- [ ] TESTER/VIEWER roles cannot access TUNING mode (same guard as DATA mode)
- [ ] PROMPT-TUNA-001 spec is editable in /x/specs and the change takes effect within 30s (spec cache TTL)
- [ ] No hardcoded parameter names or descriptions in the prompt-builder — all sourced from DB

---

## Phase 2 — Course-Aware: Dynamic Context per Question

**Effort: ~8h**

**What it adds:** When the user navigates to a course in the admin UI, the TUNING chat panel injects course-specific values into context: which playbook is active, the current `BehaviorTarget` overrides for that domain, and the relevant `DataContract` bindings. Answers become "for YOUR course, the vocabulary threshold is currently 0.7."

**Dependencies:** Phase 1 complete. Entity breadcrumb system must carry `domainId` + `playbookId` (already does via EntityContext).

### Needs Building — Phase 2

- `lib/chat/tuning-context-loader.ts` — loads course-specific context from breadcrumbs: domain BehaviorTargets (scope: DOMAIN), active playbook config, subject/discipline from PlaybookSource
- Extend `buildTuningSystemPrompt()` to accept `entityContext` breadcrumbs and inject course-specific overrides section
- Route branch in `app/api/chat/route.ts:TUNING` passes `entityContext` through to the prompt builder
- Optional: lightweight keyword classifier to detect which parameter group the question is about, then only include that group's context (reduces token cost)

### Acceptance Criteria — Phase 2

- [ ] When course breadcrumb is present: "What is the current difficulty speed for this course?" returns the actual domain-level BehaviorTarget value, not just the system default
- [ ] When no course breadcrumb: answer falls back to system defaults clearly labelled "system default"
- [ ] "What subjects is this course teaching?" returns subject names from the active playbook's PlaybookSource
- [ ] Token count for TUNING context stays under 8k tokens with a real course loaded (validate with a logging assertion)
- [ ] Changing a BehaviorTarget in the UI and re-asking refreshes the answer (30s TTL)
- [ ] Breadcrumb-context is NOT injected when the user is not on a course page (guards against stale context bleed)

---

## Phase 3 — Full Tool Use: Query on Demand + Apply-Change Links

**Effort: ~12h**

**What it adds:** Claude calls tool functions to look up specs, parameters, and contracts on demand rather than having the full catalogue injected upfront. Reduces context size and enables precise multi-hop answers. Adds "apply this change" action buttons as structured tool output, linking to the AgentTuner or the relevant spec page.

**Dependencies:** Phase 2 complete.

### Needs Building — Phase 3

- `lib/chat/tuning-tools.ts` — tool definitions:
  - `get_parameter` — fetch a specific parameter by ID or name
  - `search_parameters` — fuzzy search parameters by concept (e.g. "pronunciation")
  - `get_pipeline_stage` — fetch a spec by stage output type
  - `get_contract` — fetch a DataContract by ID
  - `get_course_targets` — fetch domain BehaviorTargets for the current course
- `lib/chat/tuning-tool-handlers.ts` — implementations (wrap existing prisma queries)
- Structured action response type: AI can return `{ actionType: "open_agent_tuner" | "open_spec", entityId: string }` which the frontend renders as a button
- `ChatPanel.tsx` — render action buttons from TUNING mode message metadata
- AI-to-DB guard: tool results are read-only; no write path in Phase 3 (apply happens via existing AgentTuner component, not through this chat)

### Acceptance Criteria — Phase 3

- [ ] "How do I make pronunciation scoring less strict?" returns a tool-grounded answer that names the specific parameter(s) and offers an "Open in Agent Tuner" button
- [ ] Tool calls are logged to the AI interaction log (same as DATA mode tools)
- [ ] Max tool iterations enforced (use existing `MAX_TOOL_ITERATIONS = 5` constant from route.ts)
- [ ] "Open in Agent Tuner" button navigates to the correct playbook/domain tuning page
- [ ] Tool execution errors (e.g. parameter not found) produce a graceful fallback answer, not a 500
- [ ] System prompt token count does NOT include the full parameter catalogue (deferred to tool calls)
- [ ] `// TODO(ai-guard):` comment added at every tool write-path boundary (there should be none — confirm)
- [ ] Phase 1 and Phase 2 behaviour is unaffected

---

## Technical Notes

### Pattern to Follow

The COURSE_REF mode (added to chat/route.ts at line 136) is the closest existing pattern:
- Has its own system prompt builder (`lib/chat/course-ref-system-prompt.ts`)
- Has its own tools (`lib/chat/course-ref-tools.ts`)
- Has its own tool handler (`lib/chat/course-ref-tool-handlers.ts`)
- Injected via the mode switch in POST handler

Copy this structure verbatim for TUNING mode.

### Spec Slug Naming

Following the pattern at `lib/config.ts:421-431`:
```
config.specs.tuningAssistant → "PROMPT-TUNA-001"  (env: TUNING_ASSISTANT_SPEC_SLUG)
```

### Key Reuse Points

- `loadAdjustableParameters()` from `lib/agent-tuner/params.ts` — already builds the grounding context the agent-tuner uses. The Tuning Assistant's Phase 1 system prompt is essentially this function's output wrapped in narrative prose.
- `ContractRegistry` from `lib/contracts/registry.ts` — `await registry.ensureLoaded(); registry.getAll()` gives all contracts with their field definitions.
- `getConfiguredMeteredAICompletionStream()` from `lib/metering/instrumented-ai.ts` — streaming, metered, uses AI cascade config.

### AI-to-DB Guard

Phase 3 tool calls are read-only (SELECT only). No write path. If a future Phase 4 adds "apply this change" directly from chat (bypassing AgentTuner), a full AI-to-DB guard is required (see `ai-to-db-guard.md`). Flag this as a risk at Phase 4 design time.

---

## Dependencies and Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Parameter catalogue exceeds context budget | Medium | Phase 2 optional keyword pre-filter; Phase 3 tool-use solves it entirely |
| User expects chat to *apply* changes, but Phase 1-2 are read-only | Medium | Clear UX copy: "I can explain — use Agent Tuner to apply changes" |
| ChatMode union extension breaks persisted localStorage state | Low | `loadPersistedMessages()` already handles unknown mode keys gracefully (line 104 in ChatContext) |
| PROMPT-TUNA-001 spec not seeded in fresh DB | Low | Hardcoded fallback string in `buildTuningSystemPrompt()`, same pattern as DATA mode |
| Agent-tuner params.ts `temperature: 0.3` hardcode | Low | That file is interpret.ts, not reused at runtime — Tuning Assistant uses metering cascade |

---

## Out of Scope (All Phases)

- Writing changes back to the DB from chat (apply-change is always delegated to AgentTuner or spec editor)
- Student-facing version (OPERATOR-only)
- Conversation persistence beyond session (localStorage only, same as DATA mode)
- Multi-turn tool planning (single tool-call chain per turn, max 5 iterations)

---

## Effort Summary

| Phase | Estimate | Unlock |
|---|---|---|
| Phase 1 — Static prompt + new mode | ~6h | Standalone — no deps |
| Phase 2 — Course-aware context | ~8h | Needs Phase 1 |
| Phase 3 — Tool use + action links | ~12h | Needs Phase 2 |
| **Total** | **~26h** | |

---

## Deploy Notes

- Phase 1: `/vm-cp` (no migration — no schema change)
- Phase 2: `/vm-cp` (no migration — reads existing BehaviorTarget/PlaybookSource)
- Phase 3: `/vm-cp` (no migration — tool calls are read-only SELECT)
- Seed: Phase 1 needs `PROMPT-TUNA-001` AnalysisSpec row. Add to `prisma/seed-demo-logins.ts` or the spec seed script. Confirm with `/vm-cpp` if seeding is part of the first deploy.

---

## Related Issues and Files

- No existing GitHub issue — PARKED
- Related: AgentTuner component (used in wizard/playbook flows for *applying* changes)
- Related: `/x/specs` — where PROMPT-TUNA-001 would be editable
- Related: `app/api/chat/route.ts` — single entry point for all chat modes
