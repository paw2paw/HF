# HF System Data Flow Guide

> **ARCHIVED DOCUMENTATION**
> Some portions of this document reference the deprecated `ControlSet` model which has been removed.
> Agent behavior targeting is now handled by `BehaviorTarget` (layered: SYSTEM → SEGMENT → CALLER).
> See [ARCHITECTURE.md](../ARCHITECTURE.md) for current documentation.

Complete guide to the HF analysis pipeline, from raw data sources to composed prompts.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Pipeline Architecture](#pipeline-architecture)
3. [Data Sources](#data-sources)
4. [Agent Pipeline](#agent-pipeline)
5. [Analysis System](#analysis-system)
6. [Prompt Composition](#prompt-composition)
7. [Database Schema Reference](#database-schema-reference)
8. [Setup & Running](#setup--running)
9. [CLI Commands](#cli-commands)
10. [Known Issues & TODOs](#known-issues--todos)

---

## System Overview

The HF system is a personality analysis and adaptive prompt generation pipeline:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HF ANALYSIS PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SOURCES              AGENTS                OUTPUTS            COMPOSITION   │
│  ───────              ──────                ───────            ───────────   │
│                                                                              │
│  ┌──────────┐    ┌─────────────────┐    ┌──────────────┐                    │
│  │Knowledge │───→│knowledge_ingestor│───→│KnowledgeChunk│                    │
│  │  (files) │    └─────────────────┘    │VectorEmbedding│                   │
│  └──────────┘              │            └──────────────┘                    │
│                            ↓                    ↓                            │
│                    ┌─────────────────┐         │                            │
│                    │knowledge_embedder│         │ RAG Context               │
│                    └─────────────────┘         ↓                            │
│                                                                              │
│  ┌──────────┐    ┌─────────────────┐    ┌──────────────┐    ┌────────────┐ │
│  │Transcripts│───→│transcript_proces│───→│    Call      │    │            │ │
│  │  (JSON)   │    └─────────────────┘    │    User      │    │            │ │
│  └──────────┘              │            └──────────────┘    │            │ │
│                            │                    │            │            │ │
│                            ↓                    ↓            │            │ │
│  ┌──────────┐    ┌─────────────────┐    ┌──────────────┐    │  Composed  │ │
│  │Parameters│───→│personality_analyz│───→│  CallScore   │───→│  Prompts   │ │
│  │ (CSV)    │    │      (MEASURE)   │    │UserPersonality│   │            │ │
│  └──────────┘    └─────────────────┘    └──────────────┘    │            │ │
│                            │                    │            │            │ │
│                            ↓                    ↓            │            │ │
│                    ┌─────────────────┐    ┌──────────────┐    │            │ │
│                    │memory_extractor │───→│  UserMemory  │───→│            │ │
│                    │    (LEARN)      │    │MemorySummary │    └────────────┘ │
│                    └─────────────────┘    └──────────────┘                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Concepts

- **AnalysisSpec**: Defines HOW to analyze calls (MEASURE scores parameters, LEARN extracts memories)
- **PromptSlug**: Defines WHAT to say based on parameter values (maps ranges to prompt text)
- **Parameter**: The bridge between measurement and adaptation (scoring anchors calibrate)
- **Memory Injection**: Pulls user memories into prompts based on policies

---

## Pipeline Architecture

### Flow Graph (agents.json)

The pipeline is defined in `/lib/agents.json` (version 6). Key sections:

| Section | Purpose |
|---------|---------|
| `groups` | Visual groupings for UI (Knowledge, Transcripts, Parameters, Analysis, System) |
| `data` | Data nodes (sources, intermediate tables, outputs) |
| `agents` | Processing agents with inputs/outputs/settings |
| `layout` | Default positions for Flow UI |

### Data Node Types

| Role | Description | Example |
|------|-------------|---------|
| `source` | Raw input data | `data:knowledge`, `data:transcripts` |
| `both` | Intermediate storage | `data:calls`, `data:parameters` |
| `output` | Final derived data | `data:profiles`, `data:memories`, `data:composed_prompts` |

---

## Data Sources

### 1. Knowledge Base (`data:knowledge`)
- **Path**: `sources/knowledge/**/*`
- **Format**: PDF, Markdown, text files
- **Purpose**: Domain knowledge for RAG context in scoring
- **Agent**: `knowledge_extractor` → `knowledge_ingestor` → `knowledge_embedder`

### 2. Transcripts (`data:transcripts`)
- **Path**: `sources/transcripts/*.json`
- **Format**: JSON batch exports or single call files
- **Purpose**: Call recordings to analyze
- **Agent**: `transcript_processor`

### 3. Parameters (`data:parameters_source`)
- **Path**: `sources/parameters/*.csv`
- **Format**: CSV with columns: parameterId, name, definition, etc.
- **Purpose**: Define personality traits and behaviors to measure
- **Agent**: `parameters_import`

---

## Agent Pipeline

### Execution Order

```
1. parameters_import    (required first - defines what to measure)
2. knowledge_extractor  (optional - extracts links for scraping)
3. knowledge_ingestor   (chunks documents)
4. knowledge_embedder   (creates vector embeddings)
5. transcript_processor (imports calls + creates users)
6. personality_analyzer (scores calls using MEASURE specs)
7. memory_extractor     (extracts memories using LEARN specs)
```

### Agent Details

#### `parameters_import`
- **opid**: `kb:parameters:import`
- **Input**: CSV file at `sources/parameters/`
- **Output**: `Parameter` records in database
- **Key Feature**: Hash-based deduplication

#### `transcript_processor`
- **opid**: `transcripts:process`
- **Input**: JSON files at `sources/transcripts/`
- **Output**: `Call`, `User` records
- **Key Feature**: Auto-detects batch vs single call format

#### `personality_analyzer` (Spec-Driven)
- **opid**: `personality:analyze`
- **Input**: Calls, AnalysisSpecs (MEASURE type)
- **Output**: `CallScore`, aggregated `UserPersonality`
- **Key Feature**: Uses `ParameterScoringAnchor` for calibration

#### `memory_extractor` (Spec-Driven)
- **opid**: `memory:extract`
- **Input**: Calls, AnalysisSpecs (LEARN type)
- **Output**: `UserMemory`, `UserMemorySummary`
- **Key Feature**: Key normalization, contradiction resolution

---

## Analysis System

### AnalysisSpec Types

| outputType | Purpose | Produces |
|------------|---------|----------|
| `MEASURE` | Score behaviors against parameter anchors | `CallScore` |
| `LEARN` | Extract structured facts about caller | `UserMemory` |
| `ADAPT` | Compute deltas and goal progress | `CallScore` for ADAPT params |

### Spec-Driven Analysis Flow

```
┌─────────────┐
│AnalysisSpec │
│ MEASURE     │
│ slug: "b5-o"│
│ promptTempl │
└──────┬──────┘
       │
       ↓
┌─────────────────────────────────────────────────────────┐
│ personality-analyze.ts                                  │
│                                                         │
│ 1. Query AnalysisSpecs (outputType=MEASURE, isActive)   │
│ 2. For each call:                                       │
│    - Load linked PromptSlug → Parameter                 │
│    - Get ParameterScoringAnchors for calibration       │
│    - Render promptTemplate with transcript + anchors    │
│    - Score via LLM (or mock)                            │
│    - Store CallScore with analysisSpecId               │
│ 3. Aggregate into UserPersonality with time decay       │
└─────────────────────────────────────────────────────────┘
       │
       ↓
┌─────────────┐
│  CallScore  │
│ score: 0.72 │
│ confidence  │
│ evidence[]  │
│ reasoning   │
└─────────────┘
```

### ParameterScoringAnchor

Calibration examples that define what scores mean:

```
Parameter: "Openness (B5-O)"
├── Anchor: score=0.9, example="I'm always trying new restaurants..."
├── Anchor: score=0.5, example="I like my routine but I'm open to..."
└── Anchor: score=0.2, example="I prefer what I know works..."
```

### Memory Extraction Flow

```
┌─────────────┐
│AnalysisSpec │
│ LEARN       │
│ domain:     │
│ "personal"  │
└──────┬──────┘
       │
       ↓
┌─────────────────────────────────────────────────────────┐
│ memory-extract.ts                                       │
│                                                         │
│ 1. Query AnalysisSpecs (outputType=LEARN, isActive)     │
│ 2. Map spec.domain → MemoryCategory                     │
│ 3. For each call:                                       │
│    - Render promptTemplate with transcript              │
│    - Extract via LLM (or pattern matching if mock)      │
│    - Normalize keys (spouse_name → spouse)             │
│    - Detect contradictions → supersede old memories     │
│    - Store UserMemory                                   │
│ 4. Aggregate UserMemorySummary                          │
└─────────────────────────────────────────────────────────┘
       │
       ↓
┌─────────────┐
│ UserMemory  │
│ category:   │
│  FACT       │
│ key:        │
│  "location" │
│ value:      │
│  "London"   │
└─────────────┘
```

### MemoryCategory Types

| Category | Description | Example |
|----------|-------------|---------|
| `FACT` | Immutable facts | location, occupation |
| `PREFERENCE` | User preferences | contact method, response style |
| `EVENT` | Time-bound events | appointments, complaints |
| `TOPIC` | Topics discussed | interests, products mentioned |
| `RELATIONSHIP` | Relationships | family members, colleagues |
| `CONTEXT` | Temporary situational | traveling, in a meeting |

---

## Prompt Composition

### PromptSlugComposer Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                     PROMPT COMPOSITION                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  INPUTS                    COMPOSER                    OUTPUT     │
│  ──────                    ────────                    ──────     │
│                                                                   │
│  ┌───────────────┐    ┌───────────────────────┐    ┌───────────┐ │
│  │UserPersonality│───→│                       │    │           │ │
│  │ openness: 0.8 │    │  PromptSlugComposer   │    │ Composed  │ │
│  │ extrav: 0.3   │    │                       │    │  Prompt   │ │
│  └───────────────┘    │  1. Load memory config│    │           │ │
│         +             │  2. Get param values  │───→│ "Be warm  │ │
│  ┌───────────────┐    │  3. Find active slugs │    │  and open.│ │
│  │  UserMemory   │───→│  4. Apply mem policy  │    │  User     │ │
│  │ location:     │    │  5. Match ranges      │    │  lives in │ │
│  │  "London"     │    │  6. Render templates  │    │  London"  │ │
│  │ prefers:      │    │  7. Combine output    │    │           │ │
│  │  "brief"      │    │                       │    │           │ │
│  └───────────────┘    └───────────────────────┘    └───────────┘ │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### PromptSlug Source Types

| sourceType | Driven By | Example |
|------------|-----------|---------|
| `PARAMETER` | Parameter value (e.g., openness score) | "Be open to new ideas" |
| `MEMORY` | User memory category | "Remember: user prefers email" |
| `COMPOSITE` | Multiple parameters weighted | Communication style |
| `ADAPT` | ADAPT parameters (deltas, goals) | "User is more engaged today" |

### PromptSlugRange Example

```
PromptSlug: "openness-style"
├── Range: minValue=0.7, maxValue=null
│   prompt: "Be exploratory and embrace novel ideas."
│   label: "High openness"
├── Range: minValue=0.4, maxValue=0.7
│   prompt: "Balance tradition with openness to new approaches."
│   label: "Moderate openness"
└── Range: minValue=null, maxValue=0.4
    prompt: "Focus on proven, familiar approaches."
    label: "Low openness"
```

### Memory Injection Policy

Global defaults in `PromptCompositionConfig`:
- `memoryMaxCount`: 20 (max memories to inject)
- `memoryMinConfidence`: 0.5 (threshold)
- `memoryDecayEnabled`: true (apply time decay)
- `memoryCategories`: [] (empty = all)

Per-slug overrides on MEMORY-sourced PromptSlugs:
- `memoryMaxItems`
- `memoryMinConfidence`
- `memoryKeyPattern` (glob filter, e.g., "spouse_*")
- `memoryDecayEnabled`
- `memoryTrigger`: "always" | "if_exists" | "recent_only"

---

## Database Schema Reference

### Core Tables

| Table | Purpose |
|-------|---------|
| `Parameter` | Personality traits and behaviors to measure |
| `ParameterScoringAnchor` | Calibration examples for scoring |
| `AnalysisSpec` | Defines analysis (MEASURE/LEARN/ADAPT) |
| `AnalysisTrigger` | When to apply analysis (Given/When/Then) |
| `AnalysisAction` | What to do when triggered |

### Analysis Results

| Table | Purpose |
|-------|---------|
| `CallScore` | Spec-driven scores per call per parameter |
| `UserPersonality` | Aggregated Big 5 traits |
| `PersonalityObservation` | Per-call observation (legacy) |
| `UserMemory` | Extracted memories |
| `UserMemorySummary` | Aggregated memory stats |

### Prompt System

| Table | Purpose |
|-------|---------|
| `PromptSlug` | Dynamic prompt driven by parameters/memories |
| `PromptSlugRange` | Value ranges mapping to prompt text |
| `PromptSlugParameter` | Links slugs to parameters (many-to-many) |
| `PromptBlock` | Static prompt blocks (system, safety, persona) |
| `PromptStack` | Ordered collection of blocks + slugs |
| `PromptCompositionConfig` | Global memory injection settings |
| `Caller` | User with composed prompt state |

---

## Setup & Running

### Prerequisites

1. Node.js 18+
2. PostgreSQL database
3. Environment variables:
   ```
   DATABASE_URL="postgresql://..."
   OPENAI_API_KEY="sk-..."  # For embeddings/LLM
   ```

### Initial Setup

```bash
# Install dependencies
cd apps/admin
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed data (optional)
npx prisma db seed
```

### Running the Admin UI

```bash
npm run dev
```

Navigate to:
- `/flow` - Pipeline visualization
- `/ops` - Agent operations
- `/analysis-specs` - Configure analysis
- `/prompt-slugs` - Configure prompts
- `/prompt-preview` - Test composition

### Running Agents Manually

```bash
# Parameters import
npx ts-node lib/ops/parameters-import.ts --verbose

# Transcript processing
npx ts-node lib/ops/transcript-process.ts --verbose

# Personality analysis (spec-driven)
npx ts-node lib/ops/personality-analyze.ts --verbose --mock

# Memory extraction (spec-driven)
npx ts-node lib/ops/memory-extract.ts --verbose --mock
```

---

## CLI Commands

### personality-analyze.ts

```bash
# Plan mode (dry run)
npx ts-node lib/ops/personality-analyze.ts --plan

# Analyze all unscored calls (mock mode)
npx ts-node lib/ops/personality-analyze.ts --mock --verbose

# Analyze specific call
npx ts-node lib/ops/personality-analyze.ts --call=abc123 --mock

# Analyze specific user's calls
npx ts-node lib/ops/personality-analyze.ts --user=xyz789 --mock

# Run specific spec only
npx ts-node lib/ops/personality-analyze.ts --spec=personality-openness --mock

# With real LLM (when implemented)
npx ts-node lib/ops/personality-analyze.ts --no-mock

# Custom aggregation settings
npx ts-node lib/ops/personality-analyze.ts --half-life=60 --limit=100
```

### memory-extract.ts

```bash
# Plan mode (dry run)
npx ts-node lib/ops/memory-extract.ts --plan

# Extract from all unprocessed calls (mock mode)
npx ts-node lib/ops/memory-extract.ts --mock --verbose

# Extract from specific call
npx ts-node lib/ops/memory-extract.ts --call=abc123 --mock

# Extract from specific user's calls
npx ts-node lib/ops/memory-extract.ts --user=xyz789 --mock

# Run specific spec only
npx ts-node lib/ops/memory-extract.ts --spec=memory-personal-facts --mock

# Custom confidence threshold
npx ts-node lib/ops/memory-extract.ts --confidence=0.7 --limit=50
```

---

## Known Issues & TODOs

### Schema Inconsistencies (FIXED)

1. ~~**UserPersonalityProfile** referenced in code but not in schema~~ ✅ FIXED
   - Added `UserPersonalityProfile` model to schema
   - Stores all parameter values as JSON, not just Big 5

2. ~~**TranscriptBatch** referenced but model removed~~ ✅ FIXED
   - Removed all references to `TranscriptBatch` from code and manifest

3. ~~**Parameter FK references using wrong field**~~ ✅ FIXED
   - `KnowledgeArtifact`, `ParameterKnowledgeLink`, `ControlSetParameter`
   - Changed from `references: [id]` to `references: [parameterId]`

4. ~~**Duplicate "VersionChain" relation name**~~ ✅ FIXED
   - `AgentInstance` now uses `"AgentVersionChain"`

### Legacy API Naming ✅ FIXED

The deprecated `bddFeature`/`bddScenario` API routes have been archived:
- `/api/bdd-features/*` → Archived
- `/api/bdd-analysis/*` → Archived
- `/app/bdd-features/` → Archived

The schema now uses `AnalysisSpec` and `AnalysisTrigger` models. All active code uses the new model names.

### Missing Implementations

1. **LLM Integration**
   - `personality-analyze.ts` has `TODO: Replace with actual LLM call`
   - `memory-extract.ts` has `TODO: Replace with actual LLM call`
   - Currently uses mock scoring and pattern matching

2. **ADAPT Parameters**
   - Schema supports ADAPT type but not fully implemented
   - Delta calculations and goal tracking need wiring

### Future Enhancements

1. **Real-time Composition**
   - Currently composition is on-demand
   - Could cache composed prompts per caller

2. **Reward Feedback Loop**
   - `PromptSlugReward` table exists but not wired
   - Should feed back to slug selection

3. **RAG Context in Scoring**
   - `knowledge_embedder` creates vectors
   - Not yet used in personality scoring prompts

---

## Quick Reference

### File Locations

| File | Purpose |
|------|---------|
| `lib/agents.json` | Agent manifest and flow graph |
| `lib/ops/personality-analyze.ts` | Spec-driven personality scoring |
| `lib/ops/memory-extract.ts` | Spec-driven memory extraction |
| `lib/prompt/PromptSlugComposer.ts` | Prompt composition logic |
| `prisma/schema.prisma` | Database schema |
| `app/flow/page.tsx` | Flow visualization UI |
| `app/api/flow/graph/route.ts` | Flow graph API |

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/flow/graph` | Get flow nodes and edges |
| `GET /api/flow/status` | Get node status/stats |
| `POST /api/agents/run` | Run an agent |
| `GET /api/agents` | List agents with status |
| `POST /api/prompt/compose-from-slugs` | Compose prompt for user |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-21 | Initial spec-driven architecture |
