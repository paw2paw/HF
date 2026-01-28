# HF System Architecture

**Version**: 5.1
**Last Updated**: 2026-01-24

Complete architecture documentation for the HF (Human Factors) adaptive conversational AI system.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Concepts](#core-concepts)
3. [Pipeline Architecture](#pipeline-architecture)
4. [Data Flow](#data-flow)
5. [Agent System](#agent-system)
6. [Analysis System](#analysis-system)
7. [Memory System](#memory-system)
8. [Prompt Composition](#prompt-composition)
9. [Time-Decay Aggregation](#time-decay-aggregation)
10. [Reward & Learning Loop](#reward--learning-loop)
11. [Path System](#path-system)
12. [Database Schema](#database-schema)
13. [API Reference](#api-reference)
14. [UI Pages](#ui-pages)

---

## System Overview

### What is HF?

HF is a personality-driven adaptive conversational AI system that:

1. **Processes call transcripts** to extract personality insights
2. **Builds user personality profiles** using Big Five traits with time decay
3. **Extracts structured memories** from conversations
4. **Selects appropriate conversational approaches** based on personality
5. **Continuously adapts** as more calls are observed

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HF PIPELINE OVERVIEW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   SOURCES              AGENTS              DERIVED              RUNTIME      │
│   ───────              ──────              ───────              ───────      │
│                                                                              │
│   Knowledge    ──►  Ingestor     ──►   Chunks/Vectors   ──►                 │
│   Transcripts  ──►  Processor    ──►   Calls/Users      ──►   compose()     │
│   Parameters   ──►  Analyzer     ──►   Personalities    ──►   ───────────   │
│                ──►  Extractor    ──►   Memories         ──►  │  Prompts  │  │
│                                                              └───────────┘  │
│                                        ┌──────────────┐                      │
│                                        │ Reward Loop  │◄─── Call Outcomes   │
│                                        └──────────────┘                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### The Three Pillars

| Concept | Purpose | Database Model |
|---------|---------|----------------|
| **Parameter** | WHAT to measure (personality dimensions) | `Parameter` |
| **AnalysisSpec** | HOW to measure/extract (scoring/extraction logic) | `AnalysisSpec` |
| **PromptSlug** | WHAT to say (adaptive prompts based on scores) | `PromptSlug` |

### Relationships

```
Parameter (e.g., "Openness")
    │
    ├── AnalysisSpec (MEASURE) ── "How to score openness from transcript"
    │       └── promptTemplate: "Score this caller's openness..."
    │
    └── PromptSlug ── "What to say based on openness level"
            ├── High (0.7+): "Be exploratory and suggest new ideas"
            ├── Medium (0.4-0.7): "Balance routine with exploration"
            └── Low (<0.4): "Stick to proven, familiar approaches"
```

### AnalysisSpec Types

| outputType | Purpose | Produces |
|------------|---------|----------|
| `MEASURE` | Score personality traits (0-1) | `CallScore` |
| `LEARN` | Extract memories (key-value facts) | `CallerMemory` |
| `ADAPT` | Compute deltas and goal progress | `CallScore` for ADAPT params |
| `MEASURE_AGENT` | Score agent communication behaviors | `BehaviorMeasurement` |

---

## Pipeline Architecture

### Phase 1: Foundation (Sources → Derived)

#### Knowledge Ingestion

```
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  sources/        │     │  knowledge_ingestor │     │  KnowledgeDoc    │
│  knowledge/      │────►│  Agent              │────►│  KnowledgeChunk  │
│  *.md, *.pdf     │     │                     │     │  VectorEmbedding │
└──────────────────┘     └─────────────────────┘     └──────────────────┘
```

**Agent**: `knowledge_ingestor`
**OpID**: `knowledge:ingest`
**Purpose**: Make LLM "expert" in your domain via RAG

#### Transcript Processing

```
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  sources/        │     │  transcript_        │     │  Call            │
│  transcripts/    │────►│  processor Agent    │────►│  User            │
│  *.json          │     │                     │     │  ProcessedFile   │
└──────────────────┘     └─────────────────────┘     └──────────────────┘
```

**Agent**: `transcript_processor`
**OpID**: `transcripts:process`
**Purpose**: Structure raw calls for analysis

### Phase 2: Observation (Calls → Profiles)

#### Personality Analysis

```
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  Call            │     │  personality_       │     │  CallScore       │
│  AnalysisSpec    │────►│  analyzer Agent     │────►│  CallerPersonality │
│  (MEASURE)       │     │  (LLM scoring)      │     │                  │
└──────────────────┘     └─────────────────────┘     └──────────────────┘
```

**Agent**: `personality_analyzer`
**OpID**: `personality:analyze`
**Purpose**: Score calls against personality parameters

#### Memory Extraction

```
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  Call            │     │  memory_            │     │  CallerMemory      │
│  AnalysisSpec    │────►│  extractor Agent    │────►│  CallerMemory-     │
│  (LEARN)         │     │                     │     │  Summary         │
└──────────────────┘     └─────────────────────┘     └──────────────────┘
```

**Agent**: `memory_extractor`
**OpID**: `memory:extract`
**Purpose**: Extract facts, preferences, events from conversations

### Phase 3: Composition (Profiles → Prompts)

```
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  CallerPersonality │     │  PromptTemplate-    │     │  Composed        │
│  CallerMemory      │────►│  Compiler           │────►│  Prompt          │
│  AnalysisSpec    │     │                     │     │                  │
└──────────────────┘     └─────────────────────┘     └──────────────────┘
```

**Endpoint**: `POST /api/prompt/compose-from-specs`
**Purpose**: Generate personalized prompts based on user profile

---

## Data Flow

### Complete Pipeline Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            COMPLETE DATA FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐    ┌─────────────────┐    ┌──────────────┐                    │
│  │Knowledge │───►│knowledge_ingestor│───►│KnowledgeChunk│                    │
│  │  (files) │    └─────────────────┘    │VectorEmbedding│                   │
│  └──────────┘              │            └──────────────┘                    │
│                            ↓                    ↓                            │
│                    ┌─────────────────┐         │                            │
│                    │knowledge_embedder│         │ RAG Context               │
│                    └─────────────────┘         ↓                            │
│                                                                              │
│  ┌──────────┐    ┌─────────────────┐    ┌──────────────┐    ┌────────────┐ │
│  │Transcripts│───►│transcript_proces│───►│    Call      │    │            │ │
│  │  (JSON)   │    └─────────────────┘    │    User      │    │            │ │
│  └──────────┘              │            └──────────────┘    │            │ │
│                            │                    │            │            │ │
│                            ↓                    ↓            │            │ │
│  ┌──────────┐    ┌─────────────────┐    ┌──────────────┐    │  Composed  │ │
│  │Parameters│───►│personality_analyz│───►│  CallScore   │───►│  Prompts   │ │
│  │ (CSV)    │    │      (MEASURE)   │    │CallerPersonality│   │            │ │
│  └──────────┘    └─────────────────┘    └──────────────┘    │            │ │
│                            │                    │            │            │ │
│                            ↓                    ↓            │            │ │
│                    ┌─────────────────┐    ┌──────────────┐    │            │ │
│                    │memory_extractor │───►│  CallerMemory  │───►│            │ │
│                    │    (LEARN)      │    │MemorySummary │    └────────────┘ │
│                    └─────────────────┘    └──────────────┘                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent System

### Agent Inventory

| Agent | OpID | Input | Output | Status |
|-------|------|-------|--------|--------|
| Knowledge Extractor | `kb:links:extract` | sources/knowledge | URL list | Implemented |
| Knowledge Ingestor | `knowledge:ingest` | sources/knowledge | KnowledgeDoc, Chunk | Implemented |
| Knowledge Embedder | `knowledge:embed` | KnowledgeChunk | VectorEmbedding | Not implemented |
| Transcript Processor | `transcripts:process` | sources/transcripts | Call, User | Implemented |
| Parameters Import | `kb:parameters:import` | sources/parameters | Parameter | Implemented |
| Personality Analyzer | `personality:analyze` | Call, AnalysisSpec | CallScore | Implemented |
| Memory Extractor | `memory:extract` | Call, AnalysisSpec | CallerMemory | Implemented |
| **Agent Behavior Measurer** | `behavior:measure` | Call, MEASURE_AGENT specs | BehaviorMeasurement | Implemented |
| **Reward Computer** | `reward:compute` | BehaviorMeasurement, BehaviorTarget | RewardScore | Implemented |
| **Target Updater** | `targets:update` | RewardScore | BehaviorTarget | Implemented |
| **Next Prompt Composer** | `prompt:compose-next` | BehaviorTarget, Memory, Profile | Caller.nextPrompt | Implemented |

### Agent Publishing Workflow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  agents.json    │     │  AgentInstance  │     │  AgentInstance  │
│  (defaults)     │────►│  (DRAFT)        │────►│  (PUBLISHED)    │
└─────────────────┘     └────────┬────────┘     └────────┬────────┘
                                 │                       │
                          [Edit settings]         [Used by runs]
                                 │                       │
                                 ▼                       ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │  PUT /api/      │     │  POST /api/     │
                        │  agents/{id}    │     │  agents/run     │
                        └─────────────────┘     └─────────────────┘
```

**Status Flow**: DRAFT → PUBLISHED → SUPERSEDED

**Priority**: manifest defaults → published instance → request overrides

---

## Analysis System

### Spec-Driven Analysis

AnalysisSpecs define both measurement and adaptation:

```typescript
// MEASURE spec example
{
  slug: "b5-openness",
  outputType: "MEASURE",
  isActive: true,
  parameterId: "openness",
  promptTemplate: `
    Score this caller's openness to new experiences.

    Scoring Anchors:
    {{#each anchors}}
    - Score {{score}}: "{{example}}"
    {{/each}}

    TRANSCRIPT:
    {{transcript}}

    Return JSON: { score: 0-1, confidence: 0-1, evidence: [] }
  `
}

// LEARN spec example
{
  slug: "personal-facts",
  outputType: "LEARN",
  domain: "personal",
  isActive: true,
  promptTemplate: `
    Extract personal facts from this conversation.
    Look for: location, occupation, family, preferences.

    TRANSCRIPT:
    {{transcript}}

    Return JSON: [{ key: string, value: string, confidence: 0-1 }]
  `
}
```

### ParameterScoringAnchor

Calibration examples that define what scores mean:

```
Parameter: "Openness (B5-O)"
├── Anchor: score=0.9, example="I'm always trying new restaurants..."
├── Anchor: score=0.5, example="I like my routine but I'm open to..."
└── Anchor: score=0.2, example="I prefer what I know works..."
```

---

## Memory System

### Memory Categories

| Category | Description | Example |
|----------|-------------|---------|
| `FACT` | Immutable facts | location, occupation |
| `PREFERENCE` | User preferences | contact method, response style |
| `EVENT` | Time-bound events | appointments, complaints |
| `TOPIC` | Topics discussed | interests, products mentioned |
| `RELATIONSHIP` | Relationships | family members, colleagues |
| `CONTEXT` | Temporary situational | traveling, in a meeting |

### Memory Extraction Flow

```
TRANSCRIPT: "I live in London and work at Acme Corp"
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│ Pattern Matching / LLM Extraction                        │
│                                                         │
│ 1. "I live in London" → { key: "location", value: "London" }
│ 2. "work at Acme Corp" → { key: "employer", value: "Acme Corp" }
└─────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│ Key Normalization                                        │
│                                                         │
│ • "spouse_name" → "spouse"                              │
│ • "preferred_contact" → "contact_method"                │
└─────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│ Contradiction Resolution                                 │
│                                                         │
│ Old: location = "San Francisco"                         │
│ New: location = "London"                                │
│ → Supersede old, store new                              │
└─────────────────────────────────────────────────────────┘
```

---

## Prompt Composition

### Primary Method: Spec-Based Composition

**Endpoint**: `POST /api/prompt/compose-from-specs`

```typescript
// Request
{
  userId: "user-123",
  includeMemories: true
}

// Response
{
  prompt: "...",           // Composed prompt text
  parameterValues: {...},  // User's parameter values used
  memoriesIncluded: 5,     // Number of memories injected
  specsUsed: ["b5-o", "b5-c", ...]
}
```

### Template Variables (Mustache-style)

| Variable | Description | Example |
|----------|-------------|---------|
| `{{value}}` | Parameter value (0-1) | `0.82` |
| `{{label}}` | Level label | `"high"`, `"medium"`, `"low"` |
| `{{param.name}}` | Parameter name | `"Openness"` |
| `{{param.description}}` | Parameter description | `"Willingness to..."` |
| `{{#if high}}...{{/if}}` | Conditional for high values | Renders if value >= 0.7 |
| `{{#if medium}}...{{/if}}` | Conditional for medium values | Renders if 0.4 <= value < 0.7 |
| `{{#if low}}...{{/if}}` | Conditional for low values | Renders if value < 0.4 |
| `{{#each memories.FACT}}` | Loop over memories | Iterates FACT memories |

### Prompt Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      COMPOSED PROMPT                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ SYSTEM LAYER                                             │   │
│   │ Base persona, capabilities, constraints                  │   │
│   │ Source: PromptBlock (type: system)                       │   │
│   └─────────────────────────────────────────────────────────┘   │
│                           ▼                                      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ CONTEXT LAYER                                            │   │
│   │ Retrieved knowledge chunks for domain expertise          │   │
│   │ Source: KnowledgeChunk via vector search                 │   │
│   └─────────────────────────────────────────────────────────┘   │
│                           ▼                                      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ PERSONALITY LAYER                                        │   │
│   │ Trait-based modifiers (tone, verbosity, approach)        │   │
│   │ Source: AnalysisSpec promptTemplates                     │   │
│   └─────────────────────────────────────────────────────────┘   │
│                           ▼                                      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ MEMORY LAYER                                             │   │
│   │ User facts, preferences, context                         │   │
│   │ Source: CallerMemory                                       │   │
│   └─────────────────────────────────────────────────────────┘   │
│                           ▼                                      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ BEHAVIOR LAYER                                           │   │
│   │ Agent communication targets (tone, length, etc.)         │   │
│   │ Source: BehaviorTarget                                   │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Time-Decay Aggregation

### Concept

Recent calls influence personality profiles more than old calls. We use exponential decay with a configurable half-life.

### Formula

```typescript
// Weight for an observation based on age
function calculateWeight(observedAt: Date, now: Date, halfLifeDays: number): number {
  const ageInDays = (now.getTime() - observedAt.getTime()) / (1000 * 60 * 60 * 24);
  const decayConstant = Math.log(2) / halfLifeDays;
  return Math.exp(-decayConstant * ageInDays);
}
```

### Example Timeline

```
Day 0:  Call 1 → openness: 0.8
Day 10: Call 2 → openness: 0.7
Day 20: Call 3 → openness: 0.6
Day 30: (today, halfLife=30)

Weights:
  - Call 1: 0.5  (30 days old = half-life)
  - Call 2: 0.7  (20 days old)
  - Call 3: 0.87 (10 days old)

Aggregated openness:
  (0.8 × 0.5 + 0.7 × 0.7 + 0.6 × 0.87) / (0.5 + 0.7 + 0.87) = 0.68
```

### Data Flow

```
PersonalityObservation (per call)
        │
        │  weight = e^(-λt)  where λ = ln(2) / halfLifeDays
        ▼
CallerPersonality (aggregated)
        │
        │  weighted average across all observations
        ▼
Confidence score based on observation count + recency
```

---

## Reward & Learning Loop

The reward system enables continuous learning by measuring agent behaviors, comparing them to targets, and adjusting based on outcomes.

### Core Concepts

| Concept | Description | Database Model |
|---------|-------------|----------------|
| **BehaviorParameter** | Agent-side parameters (HOW to communicate) | `Parameter` (type=BEHAVIOR) |
| **BehaviorTarget** | Target values layered: SYSTEM → SEGMENT → CALLER | `BehaviorTarget` |
| **BehaviorMeasurement** | What the agent actually did per call | `BehaviorMeasurement` |
| **RewardScore** | Computed reward comparing targets to actuals | `RewardScore` |
| **Segment** | Groupings for company/community/domain targets | `Segment` |

### Behavior Parameters

Agent communication behaviors (type=BEHAVIOR):

| Parameter | Description | Range |
|-----------|-------------|-------|
| BEH-ROLE-SWITCH | Role switching frequency | 0=stable, 1=adaptive |
| BEH-RESPONSE-LEN | Average response length | 0=brief, 1=verbose |
| BEH-FORMALITY | Formality level | 0=casual, 1=formal |
| BEH-EMPATHY-RATE | Empathy expression rate | 0=neutral, 1=empathic |
| BEH-PERSONALIZATION | Personalization level | 0=generic, 1=personal |
| BEH-WARMTH | Warmth level | 0=distant, 1=warm |
| BEH-QUESTION-RATE | Question asking rate | 0=statements, 1=questions |
| BEH-ACTIVE-LISTEN | Active listening signals | 0=passive, 1=active |
| BEH-PROACTIVE | Proactive guidance | 0=reactive, 1=proactive |
| BEH-DIRECTNESS | Response directness | 0=indirect, 1=direct |
| BEH-CLARITY | Communication clarity | 0=complex, 1=clear |
| BEH-MIRROR-STYLE | Style mirroring | 0=independent, 1=mirroring |
| BEH-PACE-MATCH | Pace matching | 0=independent, 1=matching |

### Target Layering

Targets are resolved with override precedence:

```
SYSTEM targets (defaults)
    │
    ▼
SEGMENT targets (company/community/domain overrides)
    │
    ▼
CALLER targets (individual overrides)
```

Each layer can override specific parameters while inheriting others.

### Segment Hierarchy

```
COMPANY (e.g., "Acme Corp")
    │
    ├── COMMUNITY (e.g., "Premium Customers")
    │       │
    │       └── COHORT (e.g., "High-Value 2024")
    │
    └── DOMAIN (e.g., "Technical Support")
```

### Learning Rules

| Condition | Action |
|-----------|--------|
| Good outcome + hit target | Reinforce - increase confidence |
| Good outcome + missed target | Adjust target toward actual |
| Bad outcome + hit target | Re-evaluate - decrease confidence |
| Bad outcome + missed target | Adjust target away from actual |

### Reward Loop Agents

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          POST-CALL REWARD LOOP                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Call Completed                                                             │
│        │                                                                     │
│        ▼                                                                     │
│   ┌─────────────────────┐                                                   │
│   │  measure_agent      │  Measure agent behavior from transcript           │
│   │  MEASURE_AGENT specs│  → BehaviorMeasurement records                    │
│   └─────────┬───────────┘                                                   │
│             │                                                                │
│             ▼                                                                │
│   ┌─────────────────────┐                                                   │
│   │  compute_reward     │  Compare measurements to targets                   │
│   │  + outcome signals  │  → RewardScore records                            │
│   └─────────┬───────────┘                                                   │
│             │                                                                │
│             ▼                                                                │
│   ┌─────────────────────┐                                                   │
│   │  update_targets     │  Apply learning rules                             │
│   │  (optional/batched) │  → BehaviorTarget updates                         │
│   └─────────┬───────────┘                                                   │
│             │                                                                │
│             ▼                                                                │
│   ┌─────────────────────┐                                                   │
│   │  compose_next_prompt│  Build personalized prompt for next call          │
│   │                     │  → Caller.nextPrompt                              │
│   └─────────────────────┘                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Reward Signals

| Type | Examples |
|------|----------|
| **Explicit** | Agent rating (1-5), Customer CSAT, QA score, Escalation flag |
| **Implicit** | Call duration, Silence ratio, Interruption count, Transfer occurred |
| **Derived** | Sentiment delta (start → end), Resolution confidence (LLM), Follow-up required |

### Data Flow

```
Call
  │
  ├── BehaviorMeasurement[] (per BEHAVIOR parameter)
  │       │
  │       ▼
  ├── RewardScore
  │       ├── effectiveTargets: { parameterId: { target, scope, source } }
  │       ├── actualBehavior: { parameterId: { actual, confidence } }
  │       ├── parameterDiffs: { parameterId: { diff, withinTolerance } }
  │       ├── outcomeSignals: { resolved, sentiment_delta, duration, ... }
  │       └── targetUpdatesApplied: [{ parameterId, oldTarget, newTarget }]
  │
  └── Caller
          └── nextPrompt: "# Caller-Specific Guidance\n..."
```

### Update Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Automatic** | Update targets immediately after each call | Real-time learning |
| **Batched** | Aggregate updates and apply periodically | Stability |
| **Manual Review** | Queue updates for human approval | Control |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ops { opid: "behavior:measure" }` | POST | Measure agent behaviors |
| `/api/ops { opid: "reward:compute" }` | POST | Compute rewards |
| `/api/ops { opid: "targets:update" }` | POST | Update targets |
| `/api/ops { opid: "prompt:compose-next" }` | POST | Compose next prompts |

### Seed Scripts

```bash
# 1. Seed BEHAVIOR parameters
npx ts-node prisma/seed-behavior-parameters.ts

# 2. Seed SYSTEM-level targets
npx ts-node prisma/seed-behavior-targets.ts

# 3. Seed MEASURE_AGENT specs
npx ts-node prisma/seed-agent-behavior-specs.ts
```

---

## Path System

### Single Source of Truth

All paths are defined in `lib/agents.json` data nodes and resolved via `lib/data-paths.ts`.

```typescript
import { getKbRoot, resolveDataNodePath } from "@/lib/data-paths";

const kbRoot = getKbRoot();                                    // /Volumes/.../hf_kb
const knowledgePath = resolveDataNodePath("data:knowledge");   // .../sources/knowledge
const derivedPath = resolveDataNodePath("data:knowledge_derived"); // .../derived/knowledge
```

### Data Node IDs

| Node ID | Path | Role |
|---------|------|------|
| `data:knowledge` | sources/knowledge | source |
| `data:transcripts` | sources/transcripts | source |
| `data:parameters_source` | sources/parameters | source |
| `data:knowledge_derived` | derived/knowledge | output |
| `data:transcripts_derived` | derived/transcripts | output |
| `data:embeddings` | derived/embeddings | output |
| `data:analysis_derived` | derived/analysis | output |

### Key Functions

| Function | Purpose |
|----------|---------|
| `getKbRoot()` | Get KB root from HF_KB_PATH env |
| `resolveDataNodePath(nodeId)` | Resolve node to absolute path |
| `getAgentPaths(agentId)` | Get input/output paths for agent |
| `validateKbStructure()` | Check all paths exist |
| `initializeKbStructure()` | Create missing directories |

---

## Database Schema

### Core Models

```
Parameter             Personality/conversation metrics
├── ParameterTag      Active/MVP status tags
├── ParameterScoringAnchor  Calibration examples
└── AnalysisSpec      Scoring/extraction specifications

AnalysisProfile       Bundles for analysis runs
├── AnalysisProfileParameter  Frozen parameter definitions
```

### Processing Models

```
ProcessedFile         Transcript file tracking
├── Call              Individual conversations
├── FailedCall        Failed extraction records
└── CallScore         Parameter scores per call
```

### Caller Models

```
Caller                Caller records
├── CallerPersonality   Aggregated Big 5 traits
├── CallerMemory        Extracted memories
└── CallerMemorySummary Memory aggregations
```

### Knowledge Models

```
KnowledgeDoc          Source documents
├── KnowledgeChunk    Chunked text for retrieval
├── VectorEmbedding   Semantic search embeddings
└── KnowledgeArtifact Scoring guides per parameter
```

### Prompt Models

```
PromptSlug            Dynamic prompts by parameter ranges
├── PromptSlugRange   Value→text mappings
└── PromptSlugParameter  Parameter links

PromptBlock           Static prompt blocks
PromptTemplate        Full prompt templates
```

### Agent Models

```
AgentInstance         Agent configurations (draft/published)
└── AgentRun          Agent execution history
```

### Reward & Behavior Models

```
Segment               Groupings (COMPANY/COMMUNITY/DOMAIN/COHORT)
└── children[]        Hierarchical nesting

BehaviorTarget        Target values for behavior parameters
├── scope             SYSTEM | SEGMENT | CALLER
├── source            SEED | LEARNED | MANUAL
└── effectiveUntil    Version chain (null = current)

BehaviorMeasurement   Measured agent behavior per call
├── actualValue       What agent actually did (0-1)
├── confidence        Measurement confidence
└── evidence[]        Supporting quotes

RewardScore           Computed reward signals
├── effectiveTargets  Merged targets used
├── actualBehavior    Measurements at score time
├── parameterDiffs    Target vs actual differences
├── outcomeSignals    Resolution, sentiment, duration
└── targetUpdatesApplied  Learning updates made
```

---

## API Reference

### Prompt Composition

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/prompt/compose-from-specs` | POST | Generate prompts for a user |
| `/api/prompt/post-call` | POST | Post-call prompt refresh |

### Operations

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ops` | GET | List available operations |
| `/api/ops` | POST | Execute operation |
| `/api/ops/[opid]` | GET | Get operation details |

### Agents

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agents` | GET | List agents with instances |
| `/api/agents` | POST | Create draft instance |
| `/api/agents/[agentId]` | GET | Get agent with versions |
| `/api/agents/[agentId]/publish` | POST | Publish draft |
| `/api/agents/run` | POST | Run agent |

### Data Management

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/parameters` | GET/POST | Parameter CRUD |
| `/api/analysis-specs` | GET/POST | Spec CRUD |
| `/api/prompt-slugs` | GET/POST | Slug CRUD |
| `/api/transcripts` | GET | Transcript listing |
| `/api/callers` | GET | Caller listing |
| `/api/calls` | GET | Call listing |

### System

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/system/readiness` | GET | **System readiness check** - DB, specs, parameters, run configs |
| `/api/paths` | GET | Get path configuration |
| `/api/paths` | POST | Validate/initialize paths |
| `/api/flow/graph` | GET | Get flow graph nodes/edges |
| `/api/flow/status` | GET | Get node status |
| `/api/health` | GET | System health check |

### Prompts

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/prompts/gallery` | GET | **Prompt gallery** - All callers with prompt status |

---

## UI Pages

### Primary Workflow

| Route | Purpose |
|-------|---------|
| `/analyze` | **Main workflow** - 3-step analysis (Select Caller → Configure & Select Calls → Run & View Results) |
| `/prompts` | **Prompt Gallery** - View all caller prompts, filter by status, compose prompts |

### Operations

| Route | Purpose |
|-------|---------|
| `/cockpit` | System status dashboard |
| `/flow` | Visual pipeline (React Flow) |
| `/ops` | Operations execution |
| `/guide` | Getting started guide |

### Setup (Configuration)

| Route | Purpose |
|-------|---------|
| `/admin` | Parameters management |
| `/analysis-specs` | Analysis specifications |
| `/prompt-slugs` | Adaptive prompts |
| `/prompt-blocks` | Static prompt blocks |
| `/memories` | Memory configuration |

### Sources (Input Data)

| Route | Purpose |
|-------|---------|
| `/knowledge-docs` | Knowledge documents |
| `/transcripts` | Call transcripts |

### Processing (Intermediate)

| Route | Purpose |
|-------|---------|
| `/chunks` | Knowledge chunks |
| `/vectors` | Vector embeddings |
| `/knowledge-artifacts` | Extracted artifacts |

### Data (Results)

| Route | Purpose |
|-------|---------|
| `/callers` | Caller list with profiles |
| `/callers/[id]` | **Caller detail page** - All artifacts (personality, memories, scores, prompt) |
| `/calls` | Call records |

### Analysis Config

| Route | Purpose |
|-------|---------|
| `/analysis-profiles` | Analysis profiles |
| `/analysis-runs` | Run history |
| `/analysis-test` | Test lab |

### Config (System)

| Route | Purpose |
|-------|---------|
| `/agents` | Agent management |
| `/run-configs` | Run configurations |
| `/behavior-targets` | Agent behavior targets |
| `/settings-library` | Settings library |

---

## Environment Variables

```bash
# Required
DATABASE_URL="postgresql://..."     # Prisma database connection
HF_KB_PATH="/path/to/knowledge/base"  # Root for sources/derived

# Optional
HF_OPS_ENABLED="true"              # Enable ops API (default: false)
OPENAI_API_KEY="sk-..."            # For embeddings/LLM calls
```

---

## Analyze Workflow

The `/analyze` page provides a streamlined 3-step workflow for analyzing calls and generating personalized prompts.

### Workflow Steps

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ANALYZE WORKFLOW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   STEP 1: SELECT CALLER                                                      │
│   ───────────────────────                                                    │
│   • View all callers with call counts                                        │
│   • Search by name, email, phone                                             │
│   • See existing memories and personality data                               │
│                                                                              │
│   STEP 2: CONFIGURE & SELECT CALLS                                           │
│   ──────────────────────────────────                                         │
│   • Choose Run Config (compiled MEASURE + LEARN specs)                       │
│   • Multi-select calls to analyze                                            │
│   • Toggle "Store Results" for persistence                                   │
│                                                                              │
│   STEP 3: RUN & VIEW RESULTS                                                 │
│   ─────────────────────────────                                              │
│   • Run analysis on selected calls                                           │
│   • View scores per parameter across calls                                   │
│   • See extracted memories                                                   │
│   • Navigate to full caller profile                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Prerequisites Check

The analyze page checks system readiness before allowing analysis:

| Check | Requirement |
|-------|-------------|
| Database | Must be connected |
| Analysis Specs | At least 1 active MEASURE or LEARN spec |
| Parameters | At least 1 parameter defined |
| Run Configs | At least 1 compiled run config |

### API Flow

```
/api/system/readiness    → Check prerequisites
/api/callers             → List all callers
/api/run-configs         → Get compiled analysis sets
/api/calls?callerId=X    → Get calls for selected caller
/api/analysis/run        → Execute analysis
/api/callers/[id]        → Get full caller profile
```

---

## Caller Profile Page

The `/callers/[id]` page displays all artifacts for a single caller.

### Tabs

| Tab | Content |
|-----|---------|
| **Overview** | Recent calls, memory summary, top memories |
| **Calls** | Full call list with transcripts |
| **Memories** | All memories grouped by category |
| **Scores** | Parameter scores across all calls |
| **Prompt** | Current composed prompt per identity |

### Data Displayed

- Personality profile (Big 5 traits as progress bars)
- Caller identities (phone numbers, external IDs)
- Memory summary (counts by category)
- Call history with score counts
- Full prompt text with composition metadata

---

## Prompt Gallery

The `/prompts` page provides a gallery view of all callers with their prompt status.

### Features

- **Filter Options**: All, With Prompt, Stale (>24h), No Prompt
- **Stats Bar**: Total callers, with prompt, needs update, no prompt
- **LHS List**: Caller cards with prompt preview
- **RHS Detail**: Full prompt text, metadata, caller info
- **Compose All**: Batch prompt composition for selected callers

### API

```
GET /api/prompts/gallery?limit=200&withPromptOnly=true

Response:
{
  ok: true,
  callers: [...],
  count: 150,
  stats: {
    withPrompt: 120,
    withoutPrompt: 30
  }
}
```

---

## Quick Reference

### Start Pipeline

1. Navigate to `/getting-started` for step-by-step onboarding
2. Use `/flow` for visual pipeline management
3. Use `/ops` for low-level operation control

### Common Operations

```bash
# Process transcripts
POST /api/ops { "opid": "transcripts:process" }

# Analyze personality (mock mode)
POST /api/ops { "opid": "personality:analyze", "settings": {"mock": true} }

# Extract memories (mock mode)
POST /api/ops { "opid": "memory:extract", "settings": {"mock": true} }

# Compose prompts
POST /api/prompt/compose-from-specs { "userId": "...", "includeMemories": true }
```

---

## Related Documentation

- [QUICKSTART.md](QUICKSTART.md) - Getting started guide
- [ADMIN_USER_GUIDE.md](ADMIN_USER_GUIDE.md) - Comprehensive admin guide
- [ANALYSIS_SPECS.md](ANALYSIS_SPECS.md) - Behavior specifications
- [STATUS.md](STATUS.md) - Current status and roadmap

---

*Document Version: 5.1 | Last Updated: 2026-01-24*
