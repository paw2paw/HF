# HF Admin System - Comprehensive User Guide

**Version:** 1.1
**Last Updated:** 2026-02-11

This guide provides exhaustive documentation for operating the HF Admin system, organized from most common tasks (generating prompts) to system configuration.

---

## Table of Contents

1. [Section 1: Generating Prompts from Calls](#section-1-generating-prompts-from-calls)
   - [1.1 Understanding the Pipeline](#11-understanding-the-pipeline)
   - [1.2 Viewing Caller Data](#12-viewing-caller-data)
   - [1.3 Generating Prompts via API](#13-generating-prompts-via-api)
   - [1.4 Understanding Prompt Composition](#14-understanding-prompt-composition)
   - [1.5 Viewing Analysis Results](#15-viewing-analysis-results)
   - [1.6 Memory System](#16-memory-system)

2. [Section 2: Setting Up Base Data](#section-2-setting-up-base-data)
   - [2.1 Parameters](#21-parameters)
   - [2.2 Analysis Specs](#22-analysis-specs)
   - [2.3 Prompt Slugs](#23-prompt-slugs)
   - [2.4 Prompt Blocks](#24-prompt-blocks)
   - [2.5 Analysis Profiles](#25-analysis-profiles)
   - [2.6 Seeding Data](#26-seeding-data)

3. [Section 3: System Administration](#section-3-system-administration)
   - [3.1 Path Configuration](#31-path-configuration)
   - [3.2 Agent Management](#32-agent-management)
   - [3.3 Operations (Ops)](#33-operations-ops)
   - [3.4 Control Sets](#34-control-sets)
   - [3.5 Settings Library](#35-settings-library)
   - [3.6 Database Management](#36-database-management)
   - [3.7 Environment Variables](#37-environment-variables)

---

# Section 1: Generating Prompts from Calls

This section assumes data has already been processed through the pipeline. If you need to set up the system first, see [Section 2](#section-2-setting-up-base-data) and [Section 3](#section-3-system-administration).

## 1.1 Understanding the Pipeline

The HF system follows this data flow:

```
Raw Transcripts → Call Records → Analysis → User Profile → Prompt Composition
      │                │              │            │              │
      │                │              │            │              └── Final prompt text
      │                │              │            └── Aggregated personality + memories
      │                │              └── CallScore + PersonalityObservation + UserMemory
      │                └── Individual call with transcript text
      └── JSON files in $HF_KB_PATH/sources/transcripts/
```

### Key Models

| Model | Purpose | Location |
|-------|---------|----------|
| `Call` | Individual conversation transcript | `/calls` |
| `User` | Person being analyzed (has personality, memories) | `/callers` |
| `Caller` | Phone/contact identifier linked to User | `/callers` |
| `CallScore` | Per-call parameter scores | `/calls/scores` |
| `UserPersonality` | Aggregated Big 5 traits | `/callers/[id]` |
| `UserPersonalityProfile` | All parameter values for a user | `/callers/[id]` |
| `UserMemory` | Extracted facts from conversations | `/memories` |

## 1.2 Viewing Caller Data

### Callers List Page

**URL:** `http://localhost:3000/x/callers`

This page shows all callers (people) in the system with:
- Name / External ID
- Call count
- Last call date
- Personality summary (if analyzed)

**Actions:**
- Click a row to view caller details
- Use search to filter by name, phone, or external ID
- Sort by any column

### Caller Detail Page

**URL:** `http://localhost:3000/x/callers` (click a caller row)

Shows comprehensive information about a single caller:

**Header Section:**
- Caller name and identifiers
- Total call count
- First/last call dates
- Linked User record

**Personality Profile:**
- Big 5 traits (Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism)
- Confidence scores
- Time-decay weighted values
- Observation count

**Parameter Values:**
- All scored parameters beyond Big 5
- Current values with confidence
- Historical trend (if multiple calls)

**Memories:**
- Extracted facts (FACT category)
- Preferences (PREFERENCE category)
- Events (EVENT category)
- Topics discussed (TOPIC category)
- Relationships mentioned (RELATIONSHIP category)

**Calls List:**
- All calls for this caller
- Click to view individual call details

### Call Detail Page

**URL:** `http://localhost:3000/calls` or `/callers/[id]/calls/[callId]`

Shows:
- Full transcript text
- Call metadata (date, source, duration)
- Parameter scores for this specific call
- Memory extractions from this call
- Linked control set (if any)

## 1.3 Generating Prompts via API

### Primary Endpoint: Spec-Based Composition

The recommended approach uses AnalysisSpec templates:

```bash
POST /api/prompt/compose-from-specs
Content-Type: application/json

{
  "userId": "user-uuid-here",
  "includeMemories": true,
  "domain": "personality",
  "outputType": "MEASURE"
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | Yes* | User UUID to compose prompt for |
| `callerId` | string | Yes* | Alternative: Caller UUID |
| `parameterValues` | object | No | Override parameter values `{"B5-O": 0.8}` |
| `includeMemories` | boolean | No | Include user memories (default: true) |
| `domain` | string | No | Filter specs by domain: "personality", "memory", etc. |
| `outputType` | string | No | Filter: "MEASURE" or "LEARN" |

*One of `userId` or `callerId` required

**Response:**

```json
{
  "prompts": [
    {
      "specId": "uuid",
      "specSlug": "personality-openness",
      "specName": "Personality - Openness",
      "outputType": "MEASURE",
      "domain": "personality",
      "renderedPrompt": "The caller shows creative thinking. Use open-ended questions...",
      "templateUsed": "{{#if high}}The caller shows creative thinking...{{/if}}",
      "context": {
        "value": 0.82,
        "label": "high",
        "parameterId": "B5-O",
        "parameterName": "Openness"
      }
    }
  ],
  "totalSpecs": 15,
  "specsWithTemplates": 12,
  "memoriesIncluded": 8,
  "composedAt": "2026-01-22T10:30:00Z"
}
```

### Post-Call Prompt Generation

After a call completes, generate prompts for the next interaction:

```bash
POST /api/prompt/post-call
Content-Type: application/json

{
  "callId": "call-uuid-here",
  "userId": "user-uuid-here"
}
```

This endpoint:
1. Fetches the user's current personality profile
2. Includes any newly extracted memories
3. Renders all relevant spec templates
4. Returns the composed prompt for the next call

## 1.4 Understanding Prompt Composition

### Template Variables

AnalysisSpec templates use Mustache-style syntax:

**Basic Variables:**
```handlebars
{{value}}              - Measured value (0.0-1.0)
{{label}}              - "high", "medium", or "low"
{{param.name}}         - Parameter display name
{{param.definition}}   - Full parameter definition
{{param.highLabel}}    - What high score means
{{param.lowLabel}}     - What low score means
```

**Conditionals:**
```handlebars
{{#if high}}
  The caller scores high on this trait.
{{/if}}

{{#if medium}}
  The caller shows moderate levels.
{{/if}}

{{#if low}}
  The caller scores low on this trait.
{{/if}}

{{#if hasMemories}}
  We have context about this person.
{{/if}}

{{#unless hasMemories}}
  This is a new caller with no history.
{{/unless}}
```

**Memory Access:**
```handlebars
{{#each memories.FACT}}
  - {{this.key}}: {{this.value}}
{{/each}}

{{#each memories.PREFERENCE}}
  - Prefers: {{this.value}}
{{/each}}

{{memories.all}}       - All memories as text
```

**User Context:**
```handlebars
{{user.name}}          - User's name
{{user.callCount}}     - Number of previous calls
```

### Example Template

```handlebars
{{#if high}}
The caller demonstrates high openness to experience ({{value}}).
They appreciate creative solutions and abstract discussions.
- Use metaphors and analogies
- Explore alternative approaches
- Welcome tangential conversations
{{/if}}

{{#if low}}
The caller prefers direct, concrete communication ({{value}}).
They value practical, proven solutions.
- Be specific and factual
- Provide step-by-step guidance
- Stay focused on the immediate issue
{{/if}}

{{#if hasMemories}}
What we know about this caller:
{{#each memories.FACT}}
- {{this.key}}: {{this.value}}
{{/each}}
{{/if}}
```

## 1.5 Viewing Analysis Results

### Analysis Runs Page

**URL:** `http://localhost:3000/x/pipeline` (pipeline runs)

Shows all analysis runs with:
- Run ID and timestamp
- Analysis Profile used
- Status (QUEUED, RUNNING, SUCCEEDED, FAILED)
- Call count processed
- Scores generated

**Actions:**
- View run details
- Re-run failed runs
- Export results

### Call Scores Page

**URL:** Available via API (`/api/calls/scores`)

Lists all CallScore records:
- Call ID
- Parameter scored
- Score value (0.0-1.0)
- Confidence
- Evidence quotes
- Scoring method (mock_v1, llm_v1, manual)

**Filtering:**
- By parameter
- By user
- By date range
- By confidence threshold

### Personality Observations

View time-series personality data:

**API:** `GET /api/users/personality?userId=xxx`

Returns:
```json
{
  "userId": "uuid",
  "aggregated": {
    "openness": 0.72,
    "conscientiousness": 0.65,
    "extraversion": 0.58,
    "agreeableness": 0.81,
    "neuroticism": 0.34,
    "confidence": 0.85,
    "observationsUsed": 12
  },
  "observations": [
    {
      "callId": "uuid",
      "observedAt": "2026-01-20",
      "openness": 0.75,
      "decayFactor": 0.95
    }
  ]
}
```

## 1.6 Memory System

### Memory Categories

| Category | Description | Example |
|----------|-------------|---------|
| `FACT` | Immutable facts | "Lives in London" |
| `PREFERENCE` | User preferences | "Prefers email contact" |
| `EVENT` | Time-bound events | "Complained about X on Jan 15" |
| `TOPIC` | Topics discussed | "Interested in product X" |
| `RELATIONSHIP` | Social connections | "Has 2 children" |
| `CONTEXT` | Situational context | "Traveling next week" |

### Viewing Memories

**URL:** Managed via API (`/api/memories`)

Lists all UserMemory records with:
- User
- Category
- Key-value pair
- Confidence
- Source call
- Extraction date

### Memory API

**List memories for a user:**
```bash
GET /api/memories?userId=xxx&category=FACT
```

**Memory summary:**
```bash
GET /api/memories/summaries?userId=xxx
```

Returns:
```json
{
  "userId": "uuid",
  "factCount": 5,
  "preferenceCount": 3,
  "eventCount": 2,
  "keyFacts": [
    {"key": "location", "value": "London", "confidence": 0.95}
  ],
  "topTopics": [
    {"topic": "billing", "frequency": 3}
  ],
  "preferences": {
    "contactMethod": "email",
    "responseLength": "brief"
  }
}
```

---

# Section 2: Setting Up Base Data

This section covers configuring the measurement and adaptation system.

## 2.1 Parameters

Parameters define WHAT you measure about callers.

### Parameters Page

**URL:** `http://localhost:3000/x/admin`

### Understanding Parameters

Each parameter has:

| Field | Description |
|-------|-------------|
| `parameterId` | Unique identifier (e.g., "B5-O" for Big 5 Openness) |
| `name` | Display name |
| `definition` | Full description of what this measures |
| `scaleType` | "continuous" (0-1) or "categorical" |
| `directionality` | "positive", "negative", or "neutral" |
| `interpretationHigh` | What high scores mean |
| `interpretationLow` | What low scores mean |
| `parameterType` | TRAIT, STATE, ADAPT, GOAL, CONFIG, EXTERNAL |

### Parameter Types

| Type | Description | Example |
|------|-------------|---------|
| `TRAIT` | Stable personality traits | Big 5 (O, C, E, A, N) |
| `STATE` | Per-call state | Engagement, mood |
| `ADAPT` | Delta/change parameters | Rapport improvement |
| `GOAL` | Goal progress | Target rapport level |
| `CONFIG` | System settings | Not measured from calls |
| `EXTERNAL` | External data | Survey results |

### Creating Parameters

**Via UI:**
1. Navigate to `/x/admin`
2. Click "Add Parameter"
3. Fill in required fields
4. Set parameter type
5. Add interpretation guidance
6. Save

**Via CSV Import:**
```bash
POST /api/parameters/import
Content-Type: multipart/form-data

file: parameters.csv
```

CSV format:
```csv
parameterId,name,definition,scaleType,directionality,interpretationHigh,interpretationLow
B5-O,Openness,Openness to experience,continuous,positive,Creative and curious,Practical and conventional
```

### Tagging Parameters

Parameters use tags for organization:

| Tag | Purpose |
|-----|---------|
| `Active` | Include in analysis runs |
| `MVP` | Core parameters for MVP |
| `Big5` | Big Five personality traits |
| `Custom` | User-defined parameters |

**Add tag via API:**
```bash
POST /api/parameters/[id]/tags
{
  "tagId": "active"
}
```

### Parameter Scoring Anchors

Define calibration examples for consistent scoring:

**URL:** `http://localhost:3000/x/admin` → Parameter → "Anchors" tab

Each anchor includes:
- Example transcript excerpt
- Score value (0.0-1.0)
- Rationale explaining the score
- Positive/negative signal markers

**Create anchor:**
```bash
POST /api/parameters/[id]/anchors
{
  "example": "Welcome back! I remember we discussed...",
  "score": 0.9,
  "rationale": "Shows warmth AND memory recall",
  "positiveSignals": ["references_previous", "warm_greeting"],
  "negativeSignals": [],
  "isGold": true
}
```

## 2.2 Analysis Specs

Analysis Specs define HOW to measure parameters and WHAT prompts to generate.

### Analysis Specs Page

**URL:** `http://localhost:3000/x/specs`

### Understanding Analysis Specs

Each spec has:

| Field | Description |
|-------|-------------|
| `slug` | Unique identifier (e.g., "personality-openness") |
| `name` | Display name |
| `description` | Full description |
| `outputType` | MEASURE, LEARN, or ADAPT |
| `domain` | Category grouping |
| `priority` | Ordering (higher = more important) |
| `promptTemplate` | Template for prompt composition |

### Output Types

| Type | Purpose | Creates |
|------|---------|---------|
| `MEASURE` | Score personality traits | CallScore records |
| `LEARN` | Extract memories | UserMemory records |
| `ADAPT` | Compute deltas/goals | CallScore for ADAPT parameters |

### Creating Analysis Specs

**Via UI:**
1. Navigate to `/x/specs`
2. Click "New Spec"
3. Set slug, name, output type
4. Add triggers (Given/When/Then)
5. Add actions (what to measure/extract)
6. Write prompt template
7. Save and compile

### Spec Structure

```
AnalysisSpec
├── Triggers (AnalysisTrigger)
│   ├── Given: Context/precondition
│   ├── When: Trigger condition
│   └── Then: Expected outcome
│
└── Actions (AnalysisAction)
    ├── description: What to look for
    ├── parameterId: For MEASURE specs
    ├── learnCategory: For LEARN specs
    └── weight: For aggregation
```

### Example MEASURE Spec

```json
{
  "slug": "personality-openness",
  "name": "Personality - Openness",
  "outputType": "MEASURE",
  "domain": "personality",
  "triggers": [
    {
      "given": "A call transcript exists",
      "when": "Analyzing for openness indicators",
      "then": "Score openness on 0-1 scale",
      "actions": [
        {
          "description": "Look for creative thinking, curiosity, abstract concepts",
          "parameterId": "B5-O",
          "weight": 1.0
        }
      ]
    }
  ],
  "promptTemplate": "{{#if high}}The caller shows high openness...{{/if}}"
}
```

### Example LEARN Spec

```json
{
  "slug": "memory-personal-facts",
  "name": "Memory - Personal Facts",
  "outputType": "LEARN",
  "domain": "memory",
  "triggers": [
    {
      "given": "Caller mentions personal information",
      "when": "Personal facts are discussed",
      "then": "Extract and store facts",
      "actions": [
        {
          "description": "Extract location, job, family info",
          "learnCategory": "FACT",
          "learnKeyPrefix": ""
        }
      ]
    }
  ]
}
```

### Compiling Specs

Before use, specs must be compiled into a CompiledAnalysisSet:

**Via UI:**
1. Go to `/x/specs`
2. Click "New Compiled Set"
3. Select source Analysis Profile
4. Click "Compile"
5. Review validation results
6. Set status to READY

**Via API:**
```bash
POST /api/compiled-sets/[id]/compile
```

## 2.3 Prompt Slugs

Prompt Slugs define dynamic prompt fragments based on parameter values.

### Prompt Slugs Page

**URL:** Managed via spec system (see `/x/specs`)

### Understanding Prompt Slugs

Each slug has:

| Field | Description |
|-------|-------------|
| `slug` | Unique identifier |
| `name` | Display name |
| `sourceType` | PARAMETER, MEMORY, COMPOSITE, ADAPT |
| `parameters` | Linked parameters (many-to-many) |
| `ranges` | Value ranges with prompt text |
| `fallbackPrompt` | Default if no range matches |
| `priority` | Ordering for composition |

### Source Types

| Type | Driven By | Example |
|------|-----------|---------|
| `PARAMETER` | Single parameter value | Openness score |
| `MEMORY` | User memory data | Preferences |
| `COMPOSITE` | Multiple parameters | Overall personality |
| `ADAPT` | ADAPT parameters | Rapport change |

### Value Ranges

Define prompts for different value ranges:

```json
{
  "ranges": [
    {
      "minValue": 0.7,
      "maxValue": 1.0,
      "label": "High",
      "prompt": "The caller is highly open. Use creative approaches."
    },
    {
      "minValue": 0.3,
      "maxValue": 0.7,
      "label": "Medium",
      "prompt": "The caller shows moderate openness. Balance creativity with practicality."
    },
    {
      "minValue": 0.0,
      "maxValue": 0.3,
      "label": "Low",
      "prompt": "The caller prefers direct, concrete communication."
    }
  ]
}
```

### Memory Injection Configuration

For MEMORY-type slugs:

| Field | Description |
|-------|-------------|
| `memoryCategory` | Which category to pull (FACT, PREFERENCE, etc.) |
| `memoryMode` | "latest", "summary", "all", "count:N" |
| `memoryMaxItems` | Max memories to include |
| `memoryMinConfidence` | Minimum confidence threshold |
| `memoryDecayEnabled` | Apply time-based decay weighting |
| `memoryTrigger` | "always", "if_exists", "on_topic", "recent_only" |

### Creating Prompt Slugs

**Via UI:**
1. Navigate to `/x/specs` (prompt slugs are managed via specs)
2. Click "New Slug"
3. Set slug, name, source type
4. Link to parameter(s)
5. Define value ranges with prompts
6. Set priority
7. Save

**Via API:**
```bash
POST /api/prompt-slugs
{
  "slug": "openness-style",
  "name": "Openness Communication Style",
  "sourceType": "PARAMETER",
  "parameters": [
    {"parameterId": "B5-O", "weight": 1.0, "mode": "ABSOLUTE"}
  ],
  "ranges": [...],
  "priority": 10,
  "isActive": true
}
```

## 2.4 Prompt Blocks

Prompt Blocks are static prompt fragments (not driven by parameter values).

### Prompt Blocks Page

**URL:** Managed via API (`/api/prompt-blocks`)

### Understanding Prompt Blocks

Each block has:

| Field | Description |
|-------|-------------|
| `slug` | Unique identifier |
| `name` | Display name |
| `category` | system, safety, persona, instruction, custom |
| `content` | The static prompt text |
| `isActive` | Enable/disable |
| `version` | Version tracking |

### Block Categories

| Category | Purpose | Example |
|----------|---------|---------|
| `system` | Base system prompt | Agent persona |
| `safety` | Safety guardrails | Content restrictions |
| `persona` | Character definition | Friendly assistant |
| `instruction` | Specific instructions | Call handling |
| `custom` | Custom blocks | Domain-specific |

### Creating Prompt Blocks

**Via UI:**
1. Navigate to the prompt blocks API
2. Click "New Block"
3. Set slug, name, category
4. Write content
5. Save

**Via API:**
```bash
POST /api/prompt-blocks
{
  "slug": "system-base",
  "name": "Base System Prompt",
  "category": "system",
  "content": "You are a helpful customer service agent...",
  "isActive": true
}
```

## 2.5 Analysis Profiles

Analysis Profiles bundle parameters and specs for analysis runs.

### Analysis Profiles Page

**URL:** Managed via API (`/api/analysis-specs`)

### Understanding Analysis Profiles

Each profile has:

| Field | Description |
|-------|-------------|
| `name` | Profile name |
| `description` | Purpose description |
| `parameters` | Snapshot of included parameters |
| `usageCount` | Number of runs using this profile |
| `isLocked` | Locked when used by compiled sets |

### Profile Parameters

Each parameter in a profile can have:

| Field | Description |
|-------|-------------|
| `enabled` | Whether to include in analysis |
| `weight` | Importance multiplier (0.0-2.0) |
| `biasValue` | Optional adjustment (-1.0 to +1.0) |
| `thresholdLow` | Custom low threshold |
| `thresholdHigh` | Custom high threshold |

### Creating Analysis Profiles

**Via UI:**
1. Navigate to `/x/specs` (profiles are managed via the spec system)
2. Click "New Profile"
3. Name and describe the profile
4. Select parameters to include
5. Configure weights and thresholds
6. Save

**Via API:**
```bash
POST /api/analysis-profiles
{
  "name": "Full Personality Analysis",
  "description": "Complete Big 5 + engagement analysis",
  "parameters": [
    {"parameterId": "B5-O", "enabled": true, "weight": 1.0},
    {"parameterId": "B5-C", "enabled": true, "weight": 1.0}
  ]
}
```

### Configuring Profile Parameters

**URL:** Managed via spec system

Interactive "equalizer" UI for adjusting:
- Parameter weights (sliders)
- Enable/disable toggles
- Threshold adjustments

## 2.6 Seeding Data

### Available Seeds

| Seed Script | Purpose |
|-------------|---------|
| `seed.ts` | De-duplicate parameters, ensure Active tags |
| `seed-big-five.ts` | Big Five traits with scoring anchors |
| `seed-memory-specs.ts` | Memory extraction specs |
| `seed-prompts.ts` | Prompt slugs and templates |
| `seed-run-configs.ts` | Agent run configurations |
| `seed-adapt-system.ts` | ADAPT parameters and specs |
| `seed-analysis.ts` | Create analysis profile from Active parameters |

### Running Seeds

**All seeds:**
```bash
npm run db:seed:all
```

**Individual seeds:**
```bash
npx tsx prisma/seed-big-five.ts
npx tsx prisma/seed-memory-specs.ts
```

**With options:**
```bash
npm run db:seed:all -- --verbose
npm run db:seed:all -- --skip-dedupe
```

### Seed Order

Seeds run in dependency order:
1. Parameters (base data)
2. Parameter Types
3. Big Five traits
4. Analysis Specs
5. Memory Specs
6. Prompt Templates/Slugs
7. Run Configs
8. Adapt System

---

# Section 3: System Administration

This section covers system configuration, agent management, and maintenance.

## 3.1 Path Configuration

### Unified Path System

All paths are defined in `lib/agents.json` and resolved via `lib/data-paths.ts`.

### Environment Variable

```bash
# .env.local
HF_KB_PATH="/path/to/your/knowledge/base"
```

### KB Directory Structure

```
$HF_KB_PATH/
├── sources/
│   ├── knowledge/          # Drop MD, PDF, TXT files here
│   ├── transcripts/        # Drop JSON transcript files here
│   └── parameters/         # Parameters CSV
├── derived/
│   ├── knowledge/          # Chunked knowledge
│   ├── embeddings/         # Vector embeddings
│   ├── transcripts/        # Processed transcripts
│   └── analysis/           # Analysis outputs
└── exports/
    ├── reports/
    └── snapshots/
```

### Path API

**Validate paths:**
```bash
GET /api/paths
```

**Initialize KB structure:**
```bash
POST /api/paths
{"action": "init", "root": "/path/to/kb"}
```

**Ensure directories exist:**
```bash
POST /api/paths
{"action": "ensure"}
```

### Data Nodes

Paths are defined as data nodes in `agents.json`:

| Node ID | Path | Role |
|---------|------|------|
| `data:knowledge` | sources/knowledge | source |
| `data:transcripts` | sources/transcripts | source |
| `data:parameters_source` | sources/parameters | source |
| `data:knowledge_derived` | derived/knowledge | output |
| `data:transcripts_derived` | derived/transcripts | output |
| `data:embeddings` | derived/embeddings | output |

### Resolving Paths in Code

```typescript
import { getKbRoot, resolveDataNodePath } from "@/lib/data-paths";

const kbRoot = getKbRoot();
const transcriptsPath = resolveDataNodePath("data:transcripts");
```

## 3.2 Agent Management

### Agents Page

**URL:** Managed via pipeline system

### Understanding Agents

Agents are processing units defined in `lib/agents.json`:

| Agent | Operation | Purpose |
|-------|-----------|---------|
| `transcript_processor` | `transcripts:process` | Extract calls from JSON |
| `personality_analyzer` | `personality:analyze` | Score personality traits |
| `memory_extractor` | `memory:extract` | Extract memories from calls |
| `knowledge_ingestor` | `knowledge:ingest` | Ingest knowledge documents |
| `knowledge_embedder` | `knowledge:embed` | Generate vector embeddings |

### Agent Publishing Workflow

```
agents.json (defaults)
       ↓
  AgentInstance (DRAFT)
       ↓ [edit settings]
  AgentInstance (DRAFT, modified)
       ↓ [publish]
  AgentInstance (PUBLISHED) ← used by runs
       ↓ [new edits]
  Previous → SUPERSEDED
```

### Agent Statuses

| Status | Description |
|--------|-------------|
| `DRAFT` | Work in progress, not used by runs |
| `PUBLISHED` | Active, used when running agent |
| `SUPERSEDED` | Replaced by newer version |
| `ARCHIVED` | No longer in use |

### Creating Agent Instances

**Via UI:**
1. Go to the pipeline system
2. Click an agent card
3. Click "Create Draft"
4. Modify settings
5. Click "Publish"

**Via API:**

Create draft:
```bash
POST /api/agents
{
  "agentId": "transcript_processor",
  "settings": {
    "autoDetectType": true,
    "createUsers": true
  }
}
```

Publish:
```bash
POST /api/agents/[agentId]/publish
```

### Running Agents

**Via UI:**
1. Go to the pipeline system
2. Click "Run" on an agent card
3. View real-time output

**Via API:**
```bash
POST /api/agents/run
{
  "agentId": "transcript_processor",
  "dryRun": false
}
```

### Viewing Run History

**URL:** Managed via pipeline system → Agent card → "Runs" tab

Or via API:
```bash
GET /api/agents/runs?agentId=transcript_processor
```

## 3.3 Operations (Ops)

### Ops Page

**URL:** `http://localhost:3000/x/pipeline`

### Available Operations

| opid | Status | Description |
|------|--------|-------------|
| `transcripts:process` | Implemented | Extract calls from transcript files |
| `personality:analyze` | Implemented | Score personality traits |
| `memory:extract` | Implemented | Extract memories from calls |
| `knowledge:ingest` | Implemented | Ingest knowledge documents |
| `kb:links:extract` | Implemented | Extract links from KB |
| `knowledge:embed` | Not implemented | Generate embeddings |
| `pipeline:run` | Implemented | Full pipeline |

### Running Operations

**Via UI:**
1. Go to `/x/pipeline`
2. Select operation
3. Configure settings
4. Click "Run" or "Dry Run"
5. View real-time logs

**Via API:**
```bash
POST /api/ops
{
  "opid": "transcripts:process",
  "settings": {
    "filepath": "/specific/file.json"
  },
  "dryRun": false
}
```

### Operation Settings

Each operation has specific settings:

**transcripts:process:**
```json
{
  "autoDetectType": true,
  "createUsers": true,
  "filepath": null
}
```

**personality:analyze:**
```json
{
  "mock": true,
  "limit": 100,
  "userId": null
}
```

**memory:extract:**
```json
{
  "mock": true,
  "userId": null
}
```

**knowledge:ingest:**
```json
{
  "maxDocuments": 100,
  "force": false
}
```

### Dry Run Mode

All operations support dry run:
```bash
POST /api/ops
{
  "opid": "personality:analyze",
  "dryRun": true
}
```

Returns what would happen without making changes.

### Full Pipeline

Run the complete processing pipeline:
```bash
POST /api/ops
{
  "opid": "pipeline:run",
  "settings": {"mock": true}
}
```

Runs in order:
1. transcripts:process
2. personality:analyze
3. memory:extract

## 3.4 Control Sets

### Control Sets Page

**URL:** Managed via API (`/api/playbooks`)

### Understanding Control Sets

Control Sets define parameter bundles for A/B testing:

| Field | Description |
|-------|-------------|
| `name` | Control set name |
| `version` | Version string (v1.0, v1.1, etc.) |
| `isActive` | Currently active for new calls |
| `expectedOpenness` | Target O score |
| `expectedConscientiousness` | Target C score |
| `expectedExtraversion` | Target E score |
| `expectedAgreeableness` | Target A score |
| `expectedNeuroticism` | Target N score |
| `parameters` | Parameter value overrides |
| `promptTemplateId` | Associated prompt template |

### Creating Control Sets

**Via UI:**
1. Go to `/x/playbooks`
2. Click "New Control Set"
3. Set name and version
4. Define expected personality targets
5. Add parameter overrides
6. Link prompt template
7. Save

**Via API:**
```bash
POST /api/control-sets
{
  "name": "High Empathy Approach",
  "version": "v1.0",
  "expectedAgreeableness": 0.8,
  "expectedNeuroticism": 0.6,
  "parameters": [
    {"parameterId": "empathy_level", "value": "high"}
  ]
}
```

### Activating Control Sets

Only one control set can be active at a time:
```bash
PUT /api/control-sets/[id]
{"isActive": true}
```

## 3.5 Settings Library

### Settings Library Page

**URL:** `http://localhost:3000/x/settings`

### Understanding Settings Library

Global configuration settings stored as key-value pairs:

| Category | Examples |
|----------|----------|
| `analysis` | Default profile, mock mode |
| `memory` | Max memories, confidence threshold |
| `prompt` | Separator, include metadata |
| `system` | Debug mode, logging level |

### Viewing Settings

All settings:
```bash
GET /api/settings-library
```

By category:
```bash
GET /api/settings-library?category=analysis
```

### Updating Settings

```bash
PUT /api/settings-library
{
  "key": "analysis.mock_mode",
  "value": "true",
  "category": "analysis"
}
```

## 3.6 Database Management

### Prisma Studio

Visual database browser:
```bash
npm run prisma:studio
```

Opens at `http://localhost:5555`

### Reset Database

**Clear all data:**
```bash
npm run db:reset
```

With auto-confirmation:
```bash
npm run db:reset -- --confirm
```

### Run Migrations

```bash
npx prisma migrate deploy
```

### Generate Client

```bash
npx prisma generate
```

### Check Migration Status

```bash
npm run prisma:status
```

### Database Schema

Schema file: `prisma/schema.prisma`

Key model groups:

**Parameters:**
- Parameter, ParameterTag, Tag
- ParameterMapping, ParameterScoringAnchor

**Analysis:**
- AnalysisProfile, AnalysisProfileParameter
- AnalysisRun, CompiledAnalysisSet
- AnalysisSpec, AnalysisTrigger, AnalysisAction

**Users:**
- User, Caller, UserPersonality, UserPersonalityProfile
- UserMemory, UserMemorySummary

**Calls:**
- Call, CallScore, PersonalityObservation, RewardScore

**Knowledge:**
- KnowledgeDoc, KnowledgeChunk, VectorEmbedding
- KnowledgeArtifact, ParameterKnowledgeLink

**Prompts:**
- PromptBlock, PromptSlug, PromptSlugParameter, PromptSlugRange
- PromptCompositionConfig

**Agents:**
- AgentInstance, AgentRun

## 3.7 Environment Variables

### Required Variables

```bash
# Database connection
DATABASE_URL="file:./prisma/dev.db"  # SQLite
# DATABASE_URL="postgresql://user:pass@host:5432/db"  # PostgreSQL

# Knowledge base path
HF_KB_PATH="/path/to/knowledge/base"

# Enable operations API
HF_OPS_ENABLED="true"
```

### Optional Variables

```bash
# OpenAI for embeddings (when implemented)
OPENAI_API_KEY="sk-..."

# Logging level
LOG_LEVEL="debug"  # debug, info, warn, error

# Node environment
NODE_ENV="development"  # development, production
```

### Verifying Configuration

**Via API:**
```bash
GET /api/paths
```

Returns:
```json
{
  "ok": true,
  "resolved": {
    "root": {"path": "/path/to/kb"},
    "sources": {
      "knowledge": "/path/to/kb/sources/knowledge",
      "transcripts": "/path/to/kb/sources/transcripts"
    }
  },
  "validation": {
    "valid": true,
    "missing": []
  },
  "env": {
    "HF_KB_PATH": "/path/to/kb",
    "NODE_ENV": "development"
  }
}
```

---

## Appendix A: API Reference

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/callers` | GET | List callers |
| `/api/callers/[id]` | GET | Get caller details |
| `/api/calls` | GET | List calls |
| `/api/calls/scores` | GET | List call scores |
| `/api/parameters` | GET/POST | Parameters CRUD |
| `/api/analysis-specs` | GET/POST | Analysis specs CRUD |
| `/api/prompt-slugs` | GET/POST | Prompt slugs CRUD |
| `/api/prompt-blocks` | GET/POST | Prompt blocks CRUD |
| `/api/analysis-profiles` | GET/POST | Profiles CRUD |

### Prompt Composition

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/prompt/compose-from-specs` | POST | Primary composition |
| `/api/prompt/post-call` | POST | Post-call prompt generation |

### Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ops` | GET | List available ops |
| `/api/ops` | POST | Execute operation |
| `/api/ops/[opid]` | GET | Get operation details |

### Agents

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agents` | GET | List agents |
| `/api/agents` | POST | Create agent instance |
| `/api/agents/[id]/publish` | POST | Publish agent |
| `/api/agents/run` | POST | Run agent |
| `/api/agents/runs` | GET | List runs |

---

## Appendix B: Troubleshooting

### Common Issues

**Operations Disabled:**
```
Operations are disabled. Set HF_OPS_ENABLED=true to enable.
```
Add `HF_OPS_ENABLED=true` to `.env.local`

**No Parameters Found:**
```bash
npm run db:seed:all
```

**KB Path Not Found:**
```bash
# Check path configuration
curl http://localhost:3000/api/paths

# Initialize structure
curl -X POST http://localhost:3000/api/paths \
  -H "Content-Type: application/json" \
  -d '{"action": "init"}'
```

**Database Connection Error:**
```bash
# Check migration status
npm run prisma:status

# Reset and recreate
npm run db:reset -- --confirm
npx prisma migrate deploy
npm run db:seed:all
```

**No Calls After Processing:**
```bash
# Check ProcessedFile status
curl http://localhost:3000/api/processed-files

# View failed calls
curl http://localhost:3000/api/failed-calls
```

---

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| **AnalysisSpec** | Specification for what to measure/extract |
| **AnalysisProfile** | Bundle of parameters for analysis runs |
| **Caller** | Contact identifier (phone, email) |
| **CallScore** | Single parameter score for a call |
| **CompiledAnalysisSet** | Validated, ready-to-use spec bundle |
| **Parameter** | Dimension being measured (e.g., Openness) |
| **PersonalityObservation** | Per-call personality snapshot |
| **PromptBlock** | Static prompt fragment |
| **PromptSlug** | Dynamic prompt driven by parameter |
| **User** | Person being analyzed |
| **UserMemory** | Extracted fact about a user |
| **UserPersonality** | Aggregated personality profile |

---

*End of Admin User Guide*
