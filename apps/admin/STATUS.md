# HF Admin System - Status & Roadmap

**Last Updated:** 2026-02-12

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

Specs are further classified by **SpecRole** (what they contribute architecturally):
- `ORCHESTRATE` - Flow/sequence control (PIPELINE-001, INIT-001)
- `EXTRACT` - Measurement and learning (PERS-001, VARK-001, MEM-001)
- `SYNTHESISE` - Combine/transform data (COMP-001, REW-001, ADAPT-*)
- `CONSTRAIN` - Bounds and guards (GUARD-001)
- `IDENTITY` - Agent personas (TUT-001, COACH-001)
- `CONTENT` - Curriculum material (WNF-CONTENT-001)
- `VOICE` - Voice guidance (VOICE-001)

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
- Location: [/x/specs](http://localhost:3000/x/specs)
- MEASURE specs: Score personality traits (0-1 scale)
- LEARN specs: Extract memories (key-value facts)
- Prompt templates with Mustache-style variables
- Stored in: `AnalysisSpec` table

### 3. **Prompt Slugs System**
- Location: Managed via spec system
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
- Location: Managed via pipeline system
- JSON-based agent manifest
- Draft/Publish workflow
- Settings configuration per agent
- Run history tracking
- Stored in: `AgentInstance`, `AgentRun` tables

### 10. **Pipeline System**
- Location: [/x/pipeline](http://localhost:3000/x/pipeline)
- Pipeline execution and monitoring
- Spec-driven analysis stages
- Real-time run tracking

### 11. **Taxonomy Visualization**
- Location: [/x/taxonomy-graph](http://localhost:3000/x/taxonomy-graph)
- Interactive taxonomy tree (Domain → Playbook → Spec → Parameter)
- Orphan detection for unlinked specs and parameters

### 12. **Supervisor Dashboard**
- Location: [/x/supervisor](http://localhost:3000/x/supervisor)
- Agent behavior monitoring
- Quality scoring and compliance

### 14. **Pipeline Hardening (Feb 2026)**
- Transform chain support: `CompositionExecutor` processes `string[]` transforms as sequential pipelines
- Memory processing split into 3 chainable transforms: `deduplicateMemories` → `scoreMemoryRelevance` → `groupMemoriesByCategory`
- Memory relevance scoring: keyword overlap + spec-driven category weights, alpha-blended with confidence (`relevanceAlpha`)
- Narrative memory framing: spec-driven templates from COMP-001 produce natural-language sentences (not `key="value"` pairs)
- LLM memory extraction: actual AI call via `getMeteredAICompletion` with fallback to pattern matching
- Flex condition operators for ADAPT specs: 7 operators (`eq`, `gt`, `gte`, `lt`, `lte`, `between`, `in`) with `dataSource` support (`learnerProfile` or `parameterValues`)
- JSON recovery utility: `recoverBrokenJson()` for malformed LLM output
- Dynamic memory categories: `renderPromptSummary` uses `Object.keys(byCategory)` instead of hardcoded list
- 89 tests across 5 test files, all passing

### 15. **RBAC & Authentication (Feb 2026)**
- 176/184 API routes protected via `requireAuth()` from `lib/permissions.ts`
- 8 routes intentionally public (auth, health, invite)
- 3-role hierarchy: ADMIN > OPERATOR > VIEWER with inheritance
- Discriminated union type guard: `isAuthError()` for type-safe route handlers
- Coverage test (`tests/lib/route-auth-coverage.test.ts`) — scans all routes, fails CI if any missing auth
- 17 unit tests for permissions helper

### 16. **Sim Auth & Invite System (Feb 2026)**
- Access code system removed (middleware bypass, `/x/sim/login`, `/api/sim/auth` deleted)
- All sim access goes through invite → user → session flow
- Sim routes use `requireAuth("VIEWER")`, OPERATOR sees only their own callers
- Flow: Admin creates invite → tester accepts → User created → JWT session (30 days) → sim setup
- Domain-locked invites: tester auto-assigned to specific domain

### 17. **Domain System & Readiness (Feb 2026)**
- Domain lifecycle: Create → Active → Deactivated
- Spec-driven readiness checks (8 query types: playbook, content_sources, onboarding, etc.)
- ReadinessBadge component on domain cards (ready/almost/incomplete)
- Delete protections: can't delete default domain, can't delete with callers

### 18. **Curriculum Progression (Feb 2026)**
- Module-by-module teaching with mastery assessment and automatic advancement
- Teaching content filtered by learning outcomes (LO refs)
- Progress stored via CallerAttribute keys (CURRICULUM_PROGRESS_V1 contract)

### 13. **Content Trust & Source Authority**
- Location: [/x/content-sources](http://localhost:3000/x/content-sources)
- 6-level trust taxonomy (L5 REGULATORY_STANDARD → L0 UNVERIFIED) with weights
- Source authority registry (ContentSource model) with validity tracking
- Atomic trusted facts with provenance (ContentAssertion model)
- Prompt composition integration: trust context, reference cards, freshness warnings injected into LLM system prompt
- Trust-weighted progress: dual-track bars on caller page (Certification Readiness vs General Understanding) with module breakdown
- Freshness dashboard widget on `/x/specs` page (expired/expiring source alerts)
- `source_citation_score` supervision parameter (SUPV-001)
- TRUST-001 BDD spec with acceptance criteria
- CONTENT_TRUST_V1 contract defining storage conventions and weights
- Reference implementation: Food Safety L2 (CURR-FS-L2-001) with Highfield qualification spec + Sprenger handbook
- Document import: PDF/text/markdown upload with AI-assisted assertion extraction, preview, and bulk import

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

### User & Auth Models
```
User              - Admin/operator/viewer accounts (NextAuth)
Caller            - End-user profiles (linked to User via userId)
Invite            - Controlled signup tokens (email, role, domain)
CallerPersonalityProfile - Dynamic parameter values (JSON)
CallerMemory      - Extracted memories
CallerMemorySummary - Memory aggregations
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

### Content Trust Models
```
ContentSource     - Authoritative source registry (books, syllabi, handbooks)
ContentAssertion  - Atomic trusted facts with full provenance
ContentTrustLevel - Enum: REGULATORY_STANDARD → UNVERIFIED (6 levels)
Curriculum        - Extended with trustLevel, primarySourceId, qualification fields
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

All admin pages are served under the `/x/` prefix.

### Core
- `/x/callers` - Caller profiles and personality data
- `/x/domains` - Domain management
- `/x/playbooks` - Playbook configuration
- `/x/specs` - Spec browser and editor
- `/x/pipeline` - Pipeline execution and monitoring

### Data & Analysis
- `/x/dictionary` - Data dictionary (all parameters)
- `/x/taxonomy` - Taxonomy explorer
- `/x/taxonomy-graph` - Visual taxonomy graph
- `/x/caller-graph` - Caller relationship graph

### Tools
- `/x/playground` - AI playground / testing
- `/x/lab` - BDD lab (spec upload and compilation)
- `/x/import` - Spec import wizard
- `/x/studio` - Prompt studio
- `/x/sim` - WhatsApp-style simulator

### Content Trust
- `/x/content-sources` - Source authority registry (trust levels, freshness, provenance)
- `/x/content-review` - Content verification queue (review, promote/demote trust with audit trail)

### Admin
- `/x/admin` - System administration
- `/x/users` - User management
- `/x/settings` - System settings
- `/x/ai-config` - AI provider configuration
- `/x/ai-knowledge` - AI knowledge dashboard
- `/x/logs` - System logs
- `/x/metering` - Usage metering
- `/x/supervisor` - Supervisor dashboard
- `/x/data-management` - Data management tools
- `/x/tickets` - Support tickets

---

## Related Documentation

- [ADMIN_USER_GUIDE.md](ADMIN_USER_GUIDE.md) - Comprehensive admin guide
- [QUICKSTART.md](QUICKSTART.md) - Getting started guide
- [ANALYSIS_SPECS.md](ANALYSIS_SPECS.md) - Behavior specifications
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Admin architecture details

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

**Version**: 0.6
**Last Updated**: 2026-02-12
