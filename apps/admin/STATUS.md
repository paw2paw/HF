# HF Admin System - Status & Roadmap

**Last Updated:** 2026-01-22

## System Vision

**WHY:** Build adaptive voice AI that holds meaningful conversations over time by learning from each interaction.

**HOW:**
- Track personality traits across calls (time series with decay)
- Score conversations using spec-driven analysis
- Modify prompts based on user personality profiles
- Extract facts and insights about each caller

**WHAT:** A complete RL-based conversational AI system with explainable reasoning at every level.

---

## Architecture Overview

The system uses three core concepts:

1. **Parameters** - Dimensions to measure (e.g., Big Five personality traits)
2. **AnalysisSpecs** - HOW to measure each parameter (MEASURE) or extract memories (LEARN)
3. **PromptSlugs** - WHAT to say based on measurements (adaptive prompts)

**Primary Prompt Composition:** `/api/prompt/compose-from-specs`
- Renders Mustache-style templates with user's parameter values
- Injects memories based on conversation history
- Evaluates conditionals (high/medium/low thresholds)

---

## COMPLETED (Working Features)

### 1. **Parameters System**
- Location: [/admin](http://localhost:3000/admin)
- CRUD for personality/conversation parameters
- Active/Inactive status management
- CSV import with hash-based versioning
- Stored in: `Parameter`, `ParameterTag`, `AnalysisProfile` tables

### 2. **Analysis Specs System**
- Location: [/analysis-specs](http://localhost:3000/analysis-specs)
- MEASURE specs: Score personality traits (0-1 scale)
- LEARN specs: Extract memories (key-value facts)
- Prompt templates with Mustache-style variables
- Stored in: `AnalysisSpec` table

### 3. **Prompt Slugs System**
- Location: [/prompt-slugs](http://localhost:3000/prompt-slugs)
- Adaptive prompts based on parameter thresholds
- High/Medium/Low variants per parameter
- Stored in: `PromptSlug` table

### 4. **Transcripts System**
- Location: [/transcripts](http://localhost:3000/transcripts)
- Raw transcript file display (from HF_KB_PATH/sources/transcripts/raw)
- Type detection (Batch/Single)
- Status tracking (Completed/Partial/Unprocessed)
- Hash-based deduplication
- Stored in: `ProcessedFile`, `Call`, `FailedCall` tables

### 5. **Transcript Processing**
- Agent: `transcript_processor`
- Operation: `transcripts:process`
- Extracts calls from JSON batches
- Creates User records
- Handles partial failures with FailedCall tracking

### 6. **Personality Analysis**
- Agent: `personality_analyzer`
- Operation: `personality:analyze`
- Spec-driven scoring using MEASURE-type AnalysisSpecs
- Time decay aggregation (30-day half-life)
- Stored in: `CallScore`, `UserPersonality` tables

### 7. **Memory Extraction**
- Agent: `memory_extractor`
- Operation: `memory:extract`
- Spec-driven extraction using LEARN-type AnalysisSpecs
- Pattern-based extraction with key normalization
- Handles contradictions by superseding old memories
- Stored in: `UserMemory`, `UserMemorySummary` tables

### 8. **Knowledge Ingestion**
- Agent: `knowledge_ingestor`
- Operation: `knowledge:ingest`
- Markdown and PDF document processing
- Hash-based deduplication with resume logic
- Stored in: `KnowledgeDoc`, `KnowledgeChunk` tables

### 9. **Agents Management**
- Location: [/agents](http://localhost:3000/agents)
- JSON-based agent manifest
- Draft/Publish workflow
- Settings configuration per agent
- Run history tracking
- Stored in: `AgentInstance`, `AgentRun` tables

### 10. **Ops Cockpit**
- Location: [/ops](http://localhost:3000/ops)
- Execute operations with verbose/plan/mock modes
- Real-time logs
- Operation registry with effects tracking

### 11. **Flow Visualization**
- Location: [/flow](http://localhost:3000/flow)
- React Flow pipeline visualization
- Source → Agent → Output node layout
- Agent status integration (draft/published)

### 12. **System Cockpit**
- Location: [/cockpit](http://localhost:3000/cockpit)
- System health overview
- Path configuration status
- Recent activity summary

---

## Database Schema

### Core Models
```
Parameter         - Personality/conversation metrics
ParameterTag      - Active/MVP status tags
AnalysisProfile   - Bundles for analysis runs
AnalysisSpec      - Scoring/extraction specifications
PromptSlug        - Adaptive prompt variants
PromptBlock       - Static prompt sections
PromptTemplate    - Full prompt templates
```

### Processing Models
```
ProcessedFile     - Transcript file tracking
Call              - Individual conversations
FailedCall        - Failed extraction records
CallScore         - Parameter scores per call
```

### User Models
```
User              - Caller records
UserPersonality   - Aggregated personality profiles
UserMemory        - Extracted memories
UserMemorySummary - Memory aggregations
```

### Knowledge Models
```
KnowledgeDoc      - Source documents
KnowledgeChunk    - Chunked text for retrieval
VectorEmbedding   - Semantic search embeddings
KnowledgeArtifact - Scoring guides per parameter
```

### Agent Models
```
AgentInstance     - Agent configurations (draft/published)
AgentRun          - Agent execution history
```

---

## Operations Registry

| opid | Status | Description |
|------|--------|-------------|
| `transcripts:process` | Implemented | Extract calls from transcript files |
| `personality:analyze` | Implemented | Score personality traits from calls |
| `memory:extract` | Implemented | Extract memories from calls |
| `knowledge:ingest` | Implemented | Ingest knowledge documents |
| `kb:links:extract` | Implemented | Extract links from knowledge base |
| `knowledge:embed` | Not implemented | Generate vector embeddings |

---

## API Endpoints

### Prompt Composition (Primary)
- `POST /api/prompt/compose-from-specs` - Generate prompts for a user
- `POST /api/prompt/post-call` - Post-call prompt refresh

### Operations
- `GET /api/ops` - List available operations
- `POST /api/ops` - Execute operation

### Data Management
- `/api/parameters` - Parameter CRUD
- `/api/analysis-specs` - Spec CRUD
- `/api/prompt-slugs` - Slug CRUD
- `/api/transcripts` - Transcript listing
- `/api/callers` - Caller listing
- `/api/calls` - Call listing

---

## UI Pages

### Primary
- `/cockpit` - System status dashboard
- `/flow` - Pipeline visualization
- `/ops` - Operations execution

### Setup
- `/admin` - Parameters management
- `/analysis-specs` - Analysis specifications
- `/prompt-slugs` - Adaptive prompts
- `/prompt-blocks` - Static prompt blocks
- `/memories` - Memory configuration

### Sources
- `/knowledge-docs` - Knowledge documents
- `/transcripts` - Call transcripts

### Processing
- `/chunks` - Knowledge chunks
- `/vectors` - Vector embeddings
- `/knowledge-artifacts` - Extracted artifacts

### Analysis
- `/callers` - Caller profiles
- `/calls` - Call records
- `/analysis-profiles` - Analysis profiles
- `/analysis-runs` - Run history
- `/analysis-test` - Test lab

### Config
- `/agents` - Agent management
- `/run-configs` - Run configurations
- `/control-sets` - Control sets
- `/settings-library` - Settings library

---

## Related Documentation

- [ADMIN_USER_GUIDE.md](ADMIN_USER_GUIDE.md) - Comprehensive admin guide
- [QUICKSTART.md](QUICKSTART.md) - Getting started guide
- [ANALYSIS_SPECS.md](ANALYSIS_SPECS.md) - Behavior specifications
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [DATA_FLOW_GUIDE.md](DATA_FLOW_GUIDE.md) - Data flow documentation

---

## Pending Features

### High Priority
- Vector embedding generation (`knowledge:embed`)
- Real-time analysis during calls
- A/B testing framework for control sets

### Medium Priority
- Advanced RAG-enhanced personality scoring
- Statistical significance testing
- Prompt variation experiments

---

**Version**: 0.4
**Last Updated**: 2026-01-22
