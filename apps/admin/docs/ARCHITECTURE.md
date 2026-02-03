# HF Admin Architecture

This document describes the core architecture of the HF Admin application, focusing on the analysis pipeline and how components connect.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Data Flow](#data-flow)
3. [BDD Lab Pipeline](#bdd-lab-pipeline)
4. [Analysis Pipeline](#analysis-pipeline)
5. [Key Models](#key-models)

---

## Core Concepts

### Domain
A **Domain** represents a category of callers (e.g., "tutor", "support", "sales"). Each domain can have its own playbook defining what analysis runs.

### Caller
A **Caller** is a person who interacts with the system. Each caller belongs to exactly one Domain.

### Playbook
A **Playbook** is a curated collection of AnalysisSpecs that defines what analysis to run for a Domain. Only one playbook per domain can be `PUBLISHED` at a time.

### AnalysisSpec
An **AnalysisSpec** defines a single analysis operation:
- **MEASURE**: Scores caller parameters (personality, engagement, etc.) → `CallScore`
- **LEARN**: Extracts memories/facts from transcripts → `CallerMemory`
- **MEASURE_AGENT**: Measures agent behavior quality → `BehaviorMeasurement`
- **AGGREGATE**: Combines scores into personality profiles → `CallerPersonality`

### Parameter
A **Parameter** is a measurable dimension (e.g., "B5-O" for Openness, "engagement", "empathy_rate").

### Spec Scope
The `scope` field (stored in `AnalysisSpec.scope`) determines **when** a spec runs in the pipeline:

| Scope | When it Runs | Examples |
|-------|--------------|----------|
| **SYSTEM** | Always enabled for all playbooks | Memory extraction, OCEAN personality, guardrails |
| **DOMAIN** | Configured per playbook via PlaybookItems | Knowledge assessments, domain-specific metrics |

**Note:** Currently, all SYSTEM specs are always enabled for all playbooks. Per-playbook toggling of SYSTEM specs is not yet implemented (see TODO.md).

### CallTarget vs CallerTarget
- **CallTarget**: Per-call computed targets (output of ADAPT specs)
- **CallerTarget**: Aggregated caller-level targets (moving average for prompt composition)

---

## Data Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              BDD LAB                                      │
│                                                                          │
│   Upload XML → Validate → Compile → BDDFeatureSet → ACTIVATE            │
│                                                         │                │
└─────────────────────────────────────────────────────────┼────────────────┘
                                                          │
                              ┌────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          PRODUCTION LAYER                                 │
│                                                                          │
│   Parameter ◄─────┐                                                      │
│                   │                                                      │
│   AnalysisSpec ◄──┼── Created by activation                             │
│       │           │                                                      │
│       ├── Triggers (when to run)                                         │
│       └── Actions (what to do)                                           │
│                   │                                                      │
│   PromptSlug ◄────┘                                                      │
│                                                                          │
└─────────────────────────────────────────────────────────┬────────────────┘
                                                          │
                              ┌────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           PLAYBOOK LAYER                                  │
│                                                                          │
│   Domain ──► Playbook (PUBLISHED) ──► PlaybookItems ──► DOMAIN Specs    │
│      │                                                                   │
│      └──► Caller                                     + SYSTEM Specs      │
│                                                       (always included)  │
└─────────────────────────────────────────────────────────┬────────────────┘
                                                          │
                              ┌────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         ANALYSIS PIPELINE                                 │
│                                                                          │
│   POST /api/calls/[callId]/pipeline                                      │
│       │                                                                  │
│       ├── 1. Get caller's domain                                         │
│       ├── 2. Find PUBLISHED playbook for domain                          │
│       ├── 3. Extract specs from PlaybookItems                            │
│       ├── 4. Run MEASURE specs → CallScore                               │
│       ├── 5. Run LEARN specs → CallerMemory                              │
│       ├── 6. Run MEASURE_AGENT specs → BehaviorMeasurement               │
│       ├── 7. Compute Reward → RewardScore                                │
│       ├── 8. Compute Adapt → Delta scores                                │
│       └── 9. Aggregate Personality → CallerPersonality                   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## BDD Lab Pipeline

The BDD Lab allows defining analysis specifications using BDD-style XML files.

### Upload → Validate → Compile → Activate

1. **Upload** (`/api/lab/uploads`)
   - Accept XML file (BDD story, parameter definitions, or hybrid)
   - Store as `BDDUpload` with raw content

2. **Validate** (`/api/lab/uploads/validate-ai`)
   - AI parses and validates XML structure
   - Checks for required fields, valid enums
   - Returns validation status and parsed content

3. **Compile** (`/api/lab/uploads/compile-ai`)
   - Transforms validated content into `BDDFeatureSet`
   - Extracts parameters, triggers, actions, learn specs
   - Stores compiled JSON in `compiledDefinitions`

4. **Activate** (`/api/lab/features/[id]/activate`)
   - Converts `BDDFeatureSet` into production records:
     - `Parameter` records (with scoring anchors)
     - `AnalysisSpec` records (MEASURE or LEARN type)
     - `AnalysisTrigger` records (with Gherkin conditions)
     - `AnalysisAction` records (what each spec does)
     - `PromptSlug` records (for personality-driven prompts)
   - Sets `isActive = true` on created specs

### File Types

| Type | Purpose | Contains |
|------|---------|----------|
| BDD Story | Define behaviors | Gherkin scenarios, acceptance criteria |
| Parameter Definition | Define measurements | Parameters, scoring anchors, interpretation |
| Hybrid | Both | Combined story + parameter definitions |

---

## Analysis Pipeline

### Endpoint
`POST /api/calls/[callId]/pipeline`

### Request Body
```json
{
  "callerId": "uuid",
  "mode": "prep" | "prompt",
  "engine": "mock" | "claude" | "openai"
}
```

### Modes

**prep**: Run all analysis steps, store results
- MEASURE caller parameters
- LEARN (extract memories)
- MEASURE_AGENT (evaluate agent)
- Compute reward score
- Compute adapt deltas
- Aggregate personality

**prompt**: Run prep + compose final prompt for next call

### Spec Selection (Playbook-Aware)

The pipeline selects specs based on the caller's domain via `getPlaybookSpecs()`:

```typescript
// In route.ts
async function getPlaybookSpecs(callerId, outputTypes, log) {
  // 1. Get caller's domain
  const caller = await prisma.caller.findUnique({ where: { id: callerId } });

  // 2. Find PUBLISHED playbook for domain
  const playbook = await prisma.playbook.findFirst({
    where: { domainId: caller.domainId, status: "PUBLISHED" },
    include: { items: { where: { itemType: "SPEC", isEnabled: true } } }
  });

  // 3. Return specs from playbook (or fallback to all active)
  if (!playbook) return { specs: allActiveSpecs, fallback: true };
  return { specs: playbook.items.map(i => i.spec), fallback: false };
}
```

**Fallback Behavior**: If no published playbook exists for the domain, the pipeline falls back to running all active specs globally (with a warning in logs).

### Pipeline by Spec Type (Target Architecture)

```
Call N arrives
     │
     ▼
┌─────────────────────────────────────┐
│  1. SYSTEM specs (always run)       │
│     - Memory extraction → CallerMemory
│     - Personality → CallScore       │
│     - Baseline targets → CallTarget │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│  2. DOMAIN specs (from playbook)    │
│     - Domain-specific → CallScore   │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│  3. ADAPT specs                     │
│     - Personalized targets          │
│     → CallTarget (overwrites)       │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│  4. SUPERVISE specs                 │
│     - Validate/refine targets       │
│     → CallTarget (final)            │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│  5. Aggregate                       │
│     CallTarget → CallerTarget       │
│     (moving average)                │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│  6. MEASURE_AGENT                   │
│     Compare agent vs CallTarget     │
│     → BehaviorMeasurement           │
└─────────────────────────────────────┘
     │
     ▼
Compose prompt for Call N+1
(using CallerTarget)
```

### Output Tables

| Analysis Type | Output Table | Key Fields |
|---------------|--------------|------------|
| MEASURE | CallScore | callId, parameterId, score, confidence |
| LEARN | CallerMemory | callerId, category, key, value, evidence |
| ADAPT | CallTarget | callId, parameterId, targetValue, reasoning |
| AGGREGATE (targets) | CallerTarget | callerId, parameterId, targetValue |
| MEASURE_AGENT | BehaviorMeasurement | callId, parameterId, actualValue |
| REWARD | RewardScore | callId, overallScore, parameterDiffs |
| AGGREGATE (personality) | CallerPersonality | callerId, openness, conscientiousness, ... |

---

## Key Models

### AnalysisSpec

```prisma
model AnalysisSpec {
  id          String            @id
  slug        String            @unique
  name        String
  outputType  AnalysisOutputType  // MEASURE, LEARN, MEASURE_AGENT, AGGREGATE
  scope       SpecificationScope  // SYSTEM, DOMAIN, SEGMENT, CALLER
  isActive    Boolean
  isDirty     Boolean           // Needs recompilation

  triggers    AnalysisTrigger[]
  playbooks   PlaybookItem[]    // Which playbooks include this spec
}
```

### Playbook

```prisma
model Playbook {
  id          String
  name        String
  domainId    String            // Which domain this playbook is for
  domain      Domain
  status      PlaybookStatus    // DRAFT, PUBLISHED, ARCHIVED
  items       PlaybookItem[]    // Specs and templates in this playbook
}
```

### PlaybookItem

```prisma
model PlaybookItem {
  id          String
  playbookId  String
  itemType    PlaybookItemType  // SPEC, PROMPT_TEMPLATE
  specId      String?           // If itemType = SPEC
  sortOrder   Int               // Execution order
  isEnabled   Boolean
}
```

---

## Configuration

### Memory Categories

| Category | Description | Example |
|----------|-------------|---------|
| FACT | Immutable facts | "lives in London" |
| PREFERENCE | Caller preferences | "prefers email" |
| EVENT | Time-bound events | "meeting on Friday" |
| TOPIC | Topics discussed | "interested in pricing" |
| RELATIONSHIP | People mentioned | "works with John" |
| CONTEXT | Situational context | "traveling next week" |

### Personality Aggregation

The `system-personality-aggregate` spec configures how personality is computed:

```json
{
  "traitMapping": {
    "B5-O": "openness",
    "B5-C": "conscientiousness",
    "B5-E": "extraversion",
    "B5-A": "agreeableness",
    "B5-N": "neuroticism"
  },
  "halfLifeDays": 30,
  "defaultConfidence": 0.7
}
```

---

## API Reference

### BDD Lab

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/lab/uploads` | POST | Upload BDD file |
| `/api/lab/uploads/validate-ai` | POST | Validate with AI |
| `/api/lab/uploads/compile-ai` | POST | Compile to FeatureSet |
| `/api/lab/features/[id]/activate` | POST | Activate/deactivate specs |

### Playbooks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/playbooks` | GET, POST | List/create playbooks |
| `/api/playbooks/[id]` | GET, PATCH | Get/update playbook |
| `/api/playbooks/[id]/publish` | POST | Publish playbook |
| `/api/playbooks/[id]/items` | GET, POST | Manage playbook items |

### Analysis

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/calls/[callId]/pipeline` | POST | Run full analysis pipeline |
| `/api/analysis/run` | POST | Run specific specs manually |
| `/api/callers/[id]/compose-prompt` | POST | Compose prompt for caller |

---

## Changelog

- **2026-01-29**: Added SpecType enum (SYSTEM/DOMAIN/ADAPT/SUPERVISE) and dynamic target system (CallTarget, CallerTarget). BehaviorTarget deprecated in favor of spec-computed targets.
- **2026-01-29**: Made pipeline playbook-aware. Specs are now selected based on caller's domain → published playbook.
