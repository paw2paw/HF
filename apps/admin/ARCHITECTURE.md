# HF Architecture: Complete Data Flow

## From Nothing → Expert Prompts → Learning Loop

This document describes the complete data architecture of the HF system, from raw sources through to intelligent prompt selection and continuous improvement.

---

## Executive Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HF PIPELINE OVERVIEW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   SOURCES              AGENTS              DERIVED              RUNTIME      │
│   ───────              ──────              ───────              ───────      │
│                                                                              │
│   Knowledge    ──►  Ingestor     ──►   Chunks/Vectors   ──►                 │
│   Transcripts  ──►  Processor    ──►   Calls/Users      ──►   selectSlug() │
│   Parameters   ──►  Snapshot     ──►   ParameterSets    ──►   compose()    │
│                ──►  Analyzer     ──►   Personalities    ──►   ───────────  │
│                                                              │  Prompts   │ │
│                                                              └────────────┘ │
│                                        ┌──────────────┐                      │
│                                        │ Reward Loop  │◄─── Call Outcomes   │
│                                        └──────────────┘                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation (Sources → Derived)

### 1.1 Knowledge Ingestion

```
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  sources/        │     │  knowledge_ingestor │     │  KnowledgeDoc    │
│  knowledge/      │────►│  Agent              │────►│  KnowledgeChunk  │
│  *.md, *.txt     │     │                     │     │  VectorEmbedding │
└──────────────────┘     └─────────────────────┘     └──────────────────┘
```

**Agent:** `knowledge_ingestor`
**OpID:** `knowledge:ingest`
**Input:** Markdown, text, PDF documents
**Output:**
- `KnowledgeDoc` - Document metadata, content hash
- `KnowledgeChunk` - Chunked text for retrieval
- `VectorEmbedding` - Semantic search vectors

**Purpose:** Makes the LLM "expert" in your domain by injecting relevant knowledge into prompts.

### 1.2 Transcript Processing

```
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  sources/        │     │  transcript_        │     │  Call            │
│  transcripts/    │────►│  processor Agent    │────►│  User            │
│  *.json          │     │                     │     │  TranscriptBatch │
└──────────────────┘     └─────────────────────┘     └──────────────────┘
```

**Agent:** `transcript_processor`
**OpID:** `transcripts:process`
**Input:** Raw transcript JSON files
**Output:**
- `Call` - Individual call records with transcript text
- `User` - Customer records extracted from calls
- `TranscriptBatch` - Grouped imports for tracking

**Purpose:** Structures raw call data for personality analysis and training.

### 1.3 Parameter Snapshot

```
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  Parameter       │     │  parameters_        │     │  ParameterSet    │
│  (Active tags)   │────►│  snapshot Agent     │────►│  ParameterSet-   │
│                  │     │                     │     │  Parameter       │
└──────────────────┘     └─────────────────────┘     └──────────────────┘
```

**Agent:** `parameters_snapshot`
**OpID:** `kb:parameters:snapshot`
**Input:** Parameters tagged as "Active"
**Output:**
- `ParameterSet` - Immutable snapshot identifier
- `ParameterSetParameter` - Frozen parameter definitions

**Purpose:** Creates reproducible snapshots for analysis runs and A/B testing.

---

## Phase 2: Observation (Calls → Personality)

### 2.1 Personality Analysis

```
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  Call            │     │  personality_       │     │  Personality-    │
│  ParameterSet    │────►│  analyzer Agent     │────►│  Observation     │
│                  │     │  (LLM scoring)      │     │  UserPersonality │
└──────────────────┘     └─────────────────────┘     └──────────────────┘
```

**Agent:** `personality_analyzer`
**OpID:** `personality:analyze`
**Input:** Call transcripts + ParameterSet definitions
**Output:**
- `PersonalityObservation` - Per-call trait scores with evidence
- `UserPersonality` - Aggregated profile with time decay

**LLM Prompt Pattern:**
```
Analyze this call transcript for the personality parameter: {{parameter.name}}

Parameter description: {{parameter.description}}
Scoring scale: {{parameter.scale_min}} to {{parameter.scale_max}}

TRANSCRIPT:
{{transcript}}

Return JSON with:
- score: number between scale bounds
- confidence: 0-1
- evidence: array of quote strings
- reasoning: brief explanation
```

### 2.2 Time-Decay Aggregation

```
PersonalityObservation (per call)
        │
        │  weight = e^(-λt)  where λ = ln(2) / halfLifeDays
        │
        ▼
UserPersonality (aggregated)
        │
        │  weighted average across all observations
        │
        ▼
Confidence score based on observation count + recency
```

**Half-life:** 30 days (configurable)
**Effect:** Recent calls matter more; stale observations fade.

---

## Phase 3: Prompt Selection (selectPromptSlug)

### 3.1 The Selection Algorithm

```typescript
async function selectPromptSlug(params: {
  callId?: string;
  userId?: string;
  maxRecent?: number;
}): Promise<{
  promptSlug: string;
  confidence: number;
  reasoning: string;
  personalitySnapshot: BigFiveProfile;
  recentSlugs: string[];
}> {
  // 1. Get user personality profile
  const profile = await getUserPersonality(userId || callId);

  // 2. Get recent slugs to avoid repetition
  const recentSlugs = await getRecentSlugs(userId, maxRecent);

  // 3. Get slug stats for this personality bucket
  const stats = await getSlugStats(personalityBucket(profile));

  // 4. Score each candidate slug
  const candidates = scoreCandidates(profile, recentSlugs, stats);

  // 5. Select best match
  return selectBest(candidates);
}
```

### 3.2 Prompt Slug Taxonomy

```
engage.*        - Build rapport, active listening
  engage.active_listening
  engage.encourage
  engage.validate

emotion.*       - Emotional support
  emotion.soothing
  emotion.empathize
  emotion.reassure

control.*       - Guide conversation
  control.clarify
  control.redirect
  control.summarize

solve.*         - Problem resolution
  solve.diagnose
  solve.explain
  solve.action_plan

close.*         - Wrap up
  close.confirm
  close.next_steps
  close.farewell
```

### 3.3 Personality-Based Matching

| Trait         | High Score Suggests        | Low Score Suggests         |
|---------------|----------------------------|----------------------------|
| Openness      | `engage.*`, creative solutions | Direct, structured approach |
| Conscientiousness | Detailed explanations, plans | Quick summaries, action focus |
| Extraversion  | `engage.*`, conversational | `control.*`, efficient |
| Agreeableness | `emotion.*`, collaborative | Factual, solution-focused |
| Neuroticism   | `emotion.soothing`, reassurance | Standard approach |

---

## Phase 4: Prompt Composition (PromptComposer)

### 4.1 Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      COMPOSED PROMPT                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ SYSTEM LAYER                                             │   │
│   │ Base persona, capabilities, constraints                  │   │
│   │ Source: PromptTemplate                                   │   │
│   └─────────────────────────────────────────────────────────┘   │
│                           ▼                                      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ CONTEXT LAYER                                            │   │
│   │ Retrieved knowledge chunks for domain expertise          │   │
│   │ Source: KnowledgeChunk via retrieveKnowledgeForPrompt()  │   │
│   └─────────────────────────────────────────────────────────┘   │
│                           ▼                                      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ PERSONALITY LAYER                                        │   │
│   │ Trait-based modifiers (tone, verbosity, approach)        │   │
│   │ Source: UserPersonality → personalityModifiers JSON      │   │
│   └─────────────────────────────────────────────────────────┘   │
│                           ▼                                      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ RULE LAYER                                               │   │
│   │ Guardrails, compliance, safety constraints               │   │
│   │ Source: ControlSet → ControlSetParameter                 │   │
│   └─────────────────────────────────────────────────────────┘   │
│                           ▼                                      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ OPTIMISATION LAYER                                       │   │
│   │ A/B test variants, reward-driven adjustments             │   │
│   │ Source: PromptSlugStats, experiments                     │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Knowledge Injection

```typescript
// Retrieved chunks injected as CONTEXT layer
const knowledgeContext = await retrieveKnowledgeForPrompt({
  queryText: transcriptExcerpt,
  callId,
  userId,
  parameterId,  // For parameter-specific knowledge
  limit: 5,
  minRelevance: 0.3,
});

// Rendered into prompt
`Expert Knowledge Context:

[Product Policies] Refund requests must be processed within 14 days...

[FAQ: Returns] Customers can return items in original packaging...

[Procedure: Escalation] If customer requests supervisor, first attempt...`
```

---

## Phase 5: Reward & Learning Loop

### 5.1 Reward Signal Collection

```
┌──────────────────────────────────────────────────────────────────┐
│                      REWARD SIGNALS                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   EXPLICIT                    IMPLICIT                            │
│   ────────                    ────────                            │
│   • Agent rating (1-5)        • Call duration                     │
│   • Customer CSAT             • Silence ratio                     │
│   • QA score                  • Interruption count                │
│   • Escalation flag           • Transfer occurred                 │
│                                                                   │
│   DERIVED                                                         │
│   ───────                                                         │
│   • Sentiment delta (start → end)                                 │
│   • Resolution confidence (LLM)                                   │
│   • Follow-up required (LLM)                                      │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Reward Calculation

```typescript
// PromptSlugReward calculation
const reward = calculateReward({
  csat: 0.8,           // 0-1, weight: 0.3
  duration: 0.6,       // normalized, weight: 0.2
  resolved: true,      // boolean → 1/0, weight: 0.25
  sentiment_delta: 0.4, // -1 to 1, weight: 0.15
  no_escalation: true, // boolean → 1/0, weight: 0.1
});

// Result: rewardScore in range [-1.0, +1.0]
```

### 5.3 Stats Aggregation

```
PromptSlugSelection
        │
        │  call ends → collect signals
        ▼
PromptSlugReward
        │
        │  aggregate by (slug, personality_bucket)
        ▼
PromptSlugStats
        │
        │  avgReward, successRate, confidenceAdjustment
        ▼
selectPromptSlug() uses stats to boost/penalize candidates
```

### 5.4 The Learning Loop

```
                    ┌─────────────────────┐
                    │   selectPromptSlug  │
                    │   (uses stats)      │
                    └─────────┬───────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   PromptSlug-       │
                    │   Selection         │
                    │   (recorded)        │
                    └─────────┬───────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   Call Execution    │
                    │   (prompt used)     │
                    └─────────┬───────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   Reward Signals    │
                    │   (collected)       │
                    └─────────┬───────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   PromptSlugReward  │
                    │   (calculated)      │
                    └─────────┬───────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   PromptSlugStats   │
                    │   (updated)         │
                    └─────────┬───────────┘
                              │
                              │ loop
                              └──────────────────────►
```

---

## Complete Data Model

### Entity Relationship Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA MODEL                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SOURCES                      DERIVED                    RUNTIME             │
│  ───────                      ───────                    ───────             │
│                                                                              │
│  Parameter ──────────────► ParameterSet                                      │
│      │                         │                                             │
│      │                         ▼                                             │
│      └──────────────────► ParameterSetParameter                              │
│                                │                                             │
│                                ▼                                             │
│  KnowledgeDoc ───────────► KnowledgeChunk ──────► VectorEmbedding           │
│      │                         │                                             │
│      │                         ▼                                             │
│      └──────────────────► KnowledgeArtifact                                  │
│                                │                                             │
│                                ▼                                             │
│  ProcessedFile ──────────► TranscriptBatch                                   │
│      │                         │                                             │
│      │                         ▼                                             │
│      └──────────────────► Call ◄─────────────────────────────────────────┐  │
│                               │                                           │  │
│                               ▼                                           │  │
│                           User ◄───────────────────────────────────────┐ │  │
│                               │                                        │ │  │
│                               ▼                                        │ │  │
│                    PersonalityObservation                              │ │  │
│                               │                                        │ │  │
│                               ▼                                        │ │  │
│                       UserPersonality                                  │ │  │
│                               │                                        │ │  │
│                               ▼                                        │ │  │
│                    PromptSlugSelection ────────► PromptSlugReward     │ │  │
│                               │                        │               │ │  │
│                               │                        ▼               │ │  │
│                               │                 PromptSlugStats        │ │  │
│                               │                                        │ │  │
│                               └────────────────────────────────────────┘ │  │
│                                                                          │  │
│  ControlSet ─────────────► ControlSetParameter                           │  │
│      │                                                                   │  │
│      └───────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  PromptTemplate ◄────────── ControlSet                                       │
│                                                                              │
│  AgentInstance ─────────► AgentRun                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `Parameter` | Personality traits/dimensions | parameterId, definition, scaleType |
| `ParameterSet` | Immutable snapshot | name, createdAt |
| `KnowledgeDoc` | Source documents | sourcePath, contentSha, status |
| `KnowledgeChunk` | Chunked text | content, chunkIndex, docId |
| `VectorEmbedding` | Semantic search | embeddingData, model, dimensions |
| `Call` | Individual calls | transcript, userId, controlSetId |
| `User` | Customer records | email, externalId |
| `PersonalityObservation` | Per-call traits | O, C, E, A, N scores, confidence |
| `UserPersonality` | Aggregated profile | O, C, E, A, N, decayHalfLife |
| `PromptSlugSelection` | Selection record | promptSlug, confidence, reasoning |
| `PromptSlugReward` | Reward signal | rewardScore, components |
| `PromptSlugStats` | Aggregated stats | avgReward, successRate |
| `ControlSet` | Behavioral guardrails | version, isActive, expectedTraits |
| `PromptTemplate` | System prompts | systemPrompt, personalityModifiers |
| `AgentInstance` | Published agent config | agentId, status, settings, version |
| `AgentRun` | Execution history | status, stdout, stderr, artifacts |

---

## Agent Pipeline

### Complete Agent Inventory

| Agent | OpID | Input | Output | Status |
|-------|------|-------|--------|--------|
| Knowledge Extractor | `kb:links:extract` | sources/knowledge | URL list | Enabled |
| Knowledge Ingestor | `knowledge:ingest` | sources/knowledge | KnowledgeDoc, Chunk | Disabled |
| Knowledge Embedder | `knowledge:embed` | KnowledgeChunk | VectorEmbedding | Disabled |
| Transcript Processor | `transcripts:process` | sources/transcripts | ProcessedFile, Call, User, Batch | Enabled |
| Parameters Import | `kb:parameters:import` | sources/parameters | Parameter | Enabled |
| Parameters Snapshot | `kb:parameters:snapshot` | Parameter (Active) | ParameterSet | Enabled |
| Personality Analyzer | `personality:analyze` | Call, ParameterSet | PersonalityObservation | Disabled |
| KB Build + Embed | `kb:build+embed` | sources/knowledge | VectorEmbedding | Disabled |

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

**Priority:** manifest defaults → published instance → request overrides

---

## Visual Flow (React Flow)

### Pipeline Visualization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLOW VISUALIZATION                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐                                      ┌─────────────┐      │
│   │ Knowledge   │─────┐                          ┌────►│ Knowledge   │      │
│   │ Base        │     │                          │     │ Chunks      │      │
│   │ (blue)      │     ▼                          │     │ (teal)      │      │
│   └─────────────┘  ┌─────────────┐               │     └─────────────┘      │
│                    │ Knowledge   │───────────────┘                          │
│   ┌─────────────┐  │ Ingestor    │                     ┌─────────────┐      │
│   │ Transcripts │  │ (purple)    │               ┌────►│ Calls       │      │
│   │ Raw         │  └─────────────┘               │     │ (teal)      │      │
│   │ (blue)      │                                │     └─────────────┘      │
│   └──────┬──────┘  ┌─────────────┐               │                          │
│          │         │ Transcript  │───────────────┤     ┌─────────────┐      │
│          └────────►│ Processor   │               └────►│ Users       │      │
│                    │ (purple)    │                     │ (teal)      │      │
│   ┌─────────────┐  └──────┬──────┘                     └─────────────┘      │
│   │ Parameters  │         │                                                  │
│   │ (blue)      │         │                            ┌─────────────┐      │
│   └──────┬──────┘         │                      ┌────►│ Parameter   │      │
│          │                │                      │     │ Sets        │      │
│          ▼                ▼                      │     │ (teal)      │      │
│   ┌─────────────┐  ┌─────────────┐               │     └─────────────┘      │
│   │ Parameters  │  │ Personality │───────────────┤                          │
│   │ Snapshot    │──│ Analyzer    │               │     ┌─────────────┐      │
│   │ (green=pub) │  │ (purple)    │               └────►│ User        │      │
│   └─────────────┘  └─────────────┘                     │ Profiles    │      │
│                                                        │ (teal)      │      │
│   Legend:                                              └─────────────┘      │
│   ● Blue = Source                                                           │
│   ● Purple = Draft Agent                                                    │
│   ● Green = Published Agent                                                 │
│   ● Teal = Output                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Node Types

| Type | Color | Description |
|------|-------|-------------|
| `source` | Blue (#3b82f6) | Data sources (knowledge, transcripts, parameters) |
| `agent` (draft) | Purple (#8b5cf6) | Agent not yet published |
| `agent` (published) | Green (#10b981) | Agent with published instance |
| `output` | Teal (#14b8a6) | Derived data (database tables) |

---

## Runtime Components (No Agent)

These components execute at runtime without agent involvement:

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/prompt-slug/select` | Select prompt slug for call |
| `POST /api/prompt-slug/reward` | Record reward for selection |
| `GET /api/prompt-slug/stats` | Get aggregated effectiveness stats |
| `POST /api/prompt/compose` | Compose full prompt with all layers |

### Core Functions

```typescript
// Prompt slug selection
selectPromptSlug({ callId, userId, maxRecent })
  → { promptSlug, confidence, reasoning, personalitySnapshot }

// Knowledge retrieval
retrieveKnowledgeForPrompt({ queryText, callId, userId, parameterId, limit })
  → KnowledgeChunkResult[]

// Prompt composition
composePromptRun({ user, agent, templates, memories, knowledgeContext })
  → PromptRun with SYSTEM, CONTEXT, PERSONALITY, RULE, OPTIMISATION layers

// Reward calculation
calculateReward({ csat, duration, resolved, sentiment_delta, no_escalation })
  → rewardScore: number (-1.0 to +1.0)
```

---

## Implementation Status

### Completed

- [x] Knowledge document ingestion pipeline
- [x] Transcript processing with deduplication
- [x] Parameter snapshot mechanism
- [x] Personality observation from calls
- [x] Time-decay aggregation to UserPersonality
- [x] Prompt slug selection with personality matching
- [x] Knowledge retrieval for prompt context
- [x] Prompt composition with layers
- [x] Agent instance publishing workflow
- [x] Agent run persistence (JSONL + DB)
- [x] Visual flow UI with React Flow

### In Progress

- [ ] Reward signal collection
- [ ] Stats aggregation pipeline
- [ ] Control set integration in prompts
- [ ] Vector similarity search (pgvector)

### Planned

- [ ] A/B testing framework
- [ ] Reward model training
- [ ] Auto-tuning of slug confidence
- [ ] Multi-language support

---

## Quick Reference

### Start the Pipeline

1. **Getting Started:** `/getting-started` - Step-by-step onboarding
2. **Flow View:** `/flow` - Visual pipeline with drag-and-drop
3. **Pipeline:** `/pipeline` - Sequential step runner
4. **Ops:** `/ops` - Low-level operation control

### Key Environment Variables

```bash
HF_KB_PATH=/path/to/knowledge/base  # Root for sources/derived
HF_OPS_ENABLED=true                 # Enable ops API
DATABASE_URL=postgresql://...       # Prisma database
```

### Common Operations

```bash
# Ingest knowledge
POST /api/ops/knowledge:ingest

# Process transcripts
POST /api/ops/transcripts:process

# Create parameter snapshot
POST /api/ops/kb:parameters:snapshot

# Analyze personality
POST /api/ops/personality:analyze

# Run agent
POST /api/agents/run { "agentId": "knowledge_ingestor" }
```

---

*Document generated for HF Admin System. Last updated: January 2026.*
