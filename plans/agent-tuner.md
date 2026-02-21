# Plan: `<AgentTuner />` — Intent-Driven Agent Identity Tuning

## Overview

A reusable React component with three phases: **Suggest → Peek → Confirm**. Users describe how they want the agent to behave in natural language. The system translates intent into `BehaviorTarget` parameter values — users manage pills, never see raw numbers.

Wizards opt-in by including `<AgentTuner />` wherever it fits their flow. No wizard is forced to use it.

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│  <AgentTuner />     components/shared/AgentTuner │
│                                                  │
│  Phase 1: SUGGEST                                │
│  ┌──────────────────────────────────────────┐    │
│  │ "warm, patient, pushes critical thinking"│    │
│  └──────────────────────────────────────────┘    │
│  [Interpret]                                     │
│                                                  │
│  Phase 2: PEEK                                   │
│  ┌────────┐ ┌─────────┐ ┌─────────────────┐     │
│  │ Warm ✕ │ │ Patient ✕│ │ Challenges ✕    │     │
│  └────────┘ └─────────┘ └─────────────────┘     │
│                                                  │
│  ▸ Show parameter effects (collapsed by default) │
│    Warmth      ████████░░  0.85                  │
│    Pacing      ███░░░░░░░  0.30                  │
│    Challenge   ████████░░  0.80                  │
│                                                  │
│  Phase 3: CONFIRM                                │
│  → Parent wizard reads pills + parameterMap      │
│    and saves to BehaviorTarget / defaults JSON    │
└──────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────┐
│  POST /api/agent-tuner/interpret                 │
│                                                  │
│  1. Load all isAdjustable Parameters from DB     │
│     (parameterId, name, interpretationHigh/Low,  │
│      domainGroup)                                │
│  2. Build grounding context for AI               │
│  3. AI maps intent → pills → parameter values    │
│  4. Sanitize: whitelist parameterIds, clamp 0-1  │
│  5. Return pills + merged parameterMap           │
└──────────────────────────────────────────────────┘
```

---

## Files to Create

### 1. `components/shared/AgentTuner.tsx` — The component

**Props:**
```typescript
interface AgentTunerProps {
  value: TunerPill[];              // current pills (controlled)
  onChange: (pills: TunerPill[]) => void;
  placeholder?: string;            // input placeholder text
  showPeek?: boolean;              // default true — show peek toggle
  compact?: boolean;               // compact mode for embedding in larger forms
  context?: {                      // optional context for smarter AI suggestions
    domainId?: string;
    personaSlug?: string;
    subjectName?: string;
  };
}

interface TunerPill {
  id: string;                      // stable UUID
  label: string;                   // "Warm", "Patient"
  intent: string;                  // original text that created this
  effects: PillEffect[];           // hidden parameter mappings
}

interface PillEffect {
  parameterId: string;             // "BEH-WARMTH"
  parameterName: string;           // "Warmth Level"
  value: number;                   // 0.85
}
```

**Behavior:**
- Text input + "Interpret" button (also fires on Enter)
- Calls `POST /api/agent-tuner/interpret` with the text + current pills + context
- Displays returned pills as removable chips (same visual style as Quick Launch tone traits)
- Collapsible "peek" section showing parameter bars (read-only visualization)
- Removing a pill recalculates the merged parameter map via `deriveParameterMap(pills)`
- Users can type additional text to add more pills (additive, not replacement)
- `onChange` fires with updated pills array — parent wizard stores & saves however it wants

**Phases in the UI:**
- **Empty state**: just the text input + placeholder
- **After interpret**: pills appear + peek toggle
- **Peek expanded**: mini bar chart of parameter effects
- No explicit "confirm" button — the pills ARE the confirmed state. The parent wizard's own Next/Save button commits them.

**Shared infra reused:**
- Pill styling: same pattern as Quick Launch tone trait chips (`var(--status-info-bg)`, accent border, ×)
- CSS: `hf-card`, `hf-input`, `hf-btn` classes
- Loading state: `Loader2` spinner (same as IntentStep)

### 2. `lib/agent-tuner/interpret.ts` — Business logic (separate from route)

**Function:**
```typescript
export async function interpretAgentIntent(options: {
  intent: string;
  currentPills: TunerPill[];
  context?: { domainId?: string; personaSlug?: string; subjectName?: string };
}): Promise<{ pills: TunerPill[]; parameterMap: Record<string, number> }>
```

**Implementation:**
1. Load all `Parameter` records where `isAdjustable = true` from DB
2. Build grounding context string:
   ```
   Available parameters:
   - BEH-WARMTH (Warmth Level): HIGH = "Friendly, warm tone" | LOW = "Neutral, matter-of-fact"
   - BEH-FORMALITY: HIGH = "Formal, professional" | LOW = "Casual, relaxed"
   ...
   ```
3. Include current pills in prompt so AI can: avoid duplicates, handle "less warm" by adjusting existing pill
4. Call `getConfiguredMeteredAICompletion({ callPoint: "agent-tuner.interpret", ... })`
5. Parse JSON response, validate parameterId whitelist, clamp values 0-1
6. Return new pills (merged with existing)

**AI prompt design:**
- System: "You translate user intent into behavior parameter adjustments. Here are the available parameters with their meanings..."
- User: "Current pills: [Warm (warmth:0.85)]. New intent: 'also be more formal and challenge students'"
- Expected output: JSON array of new pills with parameter effects
- Conflict handling: if user says "less warm", AI adjusts existing Warm pill's value down (not add a "Cold" pill)

### 3. `app/api/agent-tuner/interpret/route.ts` — API route

Standard pattern:
- `requireAuth("OPERATOR")`
- Parse JSON body: `{ intent, currentPills, context }`
- Call `interpretAgentIntent()`
- Return `{ ok: true, pills, parameterMap }`
- Graceful error handling: return `{ ok: false, error }` with user-friendly message

### 4. `lib/agent-tuner/derive.ts` — Utility to merge pill effects

```typescript
export function deriveParameterMap(pills: TunerPill[]): Record<string, number> {
  // For each parameter touched by any pill:
  // - If only one pill affects it: use that value
  // - If multiple pills affect it: weighted average (or max, TBD)
  // Returns: { "BEH-WARMTH": 0.85, "BEH-FORMALITY": 0.7, ... }
}
```

This runs client-side so removing a pill instantly recalculates without an API call.

### 5. `lib/agent-tuner/types.ts` — Shared types

Export `TunerPill`, `PillEffect`, `AgentTunerProps`, `InterpretRequest`, `InterpretResponse`.
Used by both the component and the API route.

---

## Files to Modify

### 6. `lib/ai/config-loader.ts`

Add call point:
```typescript
"agent-tuner.interpret": { provider: "claude", model: config.ai.claude.lightModel, temperature: 0.3 },
```

Light model — this is a structured mapping task, not creative generation. Low temperature for consistent parameter mapping.

### 7. `docs/ai-calls.md`

Add entry for `agent-tuner.interpret`.

---

## Integration Points (opt-in per wizard)

### Where it fits NOW:

**A. Course Setup — CourseConfigStep** (Tier 1)
```
Current:  Welcome message textarea only
Proposed: Add AgentTuner below welcome message as "Advanced: Tune agent behavior"
           (collapsed by default, expand to reveal)
```
The persona is already selected in IntentStep (Tutor/Coach/Mentor/Socratic). AgentTuner in CourseConfigStep lets users refine WITHIN that persona: "be warmer than a typical tutor", "use more humor", etc. The pills + parameterMap flow into the course creation API alongside personaSlug.

**B. Quick Launch — Step 2 Persona section** (Tier 1)
```
Current:  Persona picker + inline tone trait input/pills (~140 lines of bespoke code)
Proposed: Replace the tone traits block (lines 2377-2518) with <AgentTuner />
           Persona picker stays as-is above it
           AgentTuner.context = { personaSlug, subjectName }
```
This is a direct replacement — same UX (text → pills), but now backed by parameter mapping instead of plain strings. The `toneTraits` field in `generate-identity.ts` would accept both the legacy string format and the new parameterMap format.

**C. Content Sources — OnboardStep** (Tier 1)
```
Current:  Identity spec <select> dropdown
Proposed: Keep the dropdown for persona selection
           Add AgentTuner below it for refinement
           Pills save to domain.onboardingDefaultTargets
```

### Where it fits LATER (opt-in, not built now):

| Surface | How | When |
|---------|-----|------|
| Domains OnboardingTab | Replace raw JSON target editor | When tab is next touched |
| Quick Launch ReviewPanel | Replace 4x `EditableTagList` (toneTraits, styleGuidelines, does, doesNot) with one AgentTuner | Post-market-test |
| Playground tuning panel | Add intent input above numeric sliders | Post-market-test |
| Teach/Demonstrate pre-launch | "For this session, be more encouraging" | Future |
| Classroom setup | Per-classroom agent personality | Future |
| Learner Portal | Learner self-service tone preference | Future |

---

## Implementation Order

| # | Task | Effort | Depends On |
|---|------|--------|------------|
| 1 | Create `lib/agent-tuner/types.ts` | XS | — |
| 2 | Create `lib/agent-tuner/derive.ts` | S | #1 |
| 3 | Create `lib/agent-tuner/interpret.ts` | M | #1 |
| 4 | Create `app/api/agent-tuner/interpret/route.ts` | S | #3 |
| 5 | Register call point in `config-loader.ts` | XS | — |
| 6 | Create `components/shared/AgentTuner.tsx` | M | #1, #2 |
| 7 | Add `@ai-call` annotation + update `docs/ai-calls.md` | XS | #4 |
| 8 | Write test: `tests/api/agent-tuner-interpret.test.ts` | S | #4 |
| 9 | Write test: `tests/components/agent-tuner.test.ts` | S | #6 |
| 10 | Wire into CourseConfigStep (first integration) | S | #6 |
| 11 | Wire into Quick Launch Step 2 (replace tone traits) | M | #6 |
| 12 | Wire into Content Sources OnboardStep | S | #6 |

**Total: ~12 tasks, mostly S/M. Component + API are the core; integrations are independent and can be done one at a time.**

---

## What This Does NOT Do

- **Does not replace persona selection** — personas (Tutor/Coach/Mentor/Socratic) stay. AgentTuner refines within a persona.
- **Does not change the pipeline** — `measure-agent.ts`, `reward:compute`, ADAPT all work unchanged. AgentTuner just sets initial BehaviorTarget values more intuitively.
- **Does not require schema changes** — pills produce `onboardingDefaultTargets` JSON or `BehaviorTarget` records, both of which already exist.
- **Does not break existing wizards** — opt-in only. Wizards that don't include `<AgentTuner />` are unaffected.
- **Does not add sliders** — the peek bars are read-only visualization. For direct numeric control, users go to Playground or Domains OnboardingTab.

---

## Risk & Mitigations

| Risk | Mitigation |
|------|-----------|
| AI maps to wrong parameters | Whitelist validation: only accept known `parameterId`s. Clamp 0-1. |
| AI hallucates new parameters | Grounding prompt includes exhaustive parameter list with exact IDs. Reject any ID not in the list. |
| User confusion about pills vs persona | Clear labeling: persona picker = "Who is the agent?", AgentTuner = "How should they behave?" |
| Parameter conflicts (two pills both set warmth) | `deriveParameterMap` uses last-pill-wins or max. Peek shows the merged result so user sees the outcome. |
| Latency on interpret call | Light model + low max_tokens. Show spinner on Interpret button. Pills remain interactive without API calls (remove is instant). |
