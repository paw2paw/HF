# Analysis Specifications

Behavior-Driven specifications for the HF Admin system. These document the expected behaviors of the system and serve as living documentation.

**Note:** The term "BDD" (Behavior-Driven Development) has been replaced with "AnalysisSpec" throughout the system. Database tables use `@@map` to maintain backwards compatibility with existing data.

## Overview

The system uses **AnalysisSpecs** to define both:
- **MEASURE** specs: Score personality traits on calls
- **LEARN** specs: Extract memories from conversations

Each spec has an `outputType` (what data it produces) and a `specRole` (its architectural purpose):

| SpecRole | Purpose |
|----------|---------|
| `ORCHESTRATE` | Flow/sequence control |
| `EXTRACT` | Measurement and learning |
| `SYNTHESISE` | Combine and transform data |
| `CONSTRAIN` | Bounds and guard rules |
| `IDENTITY` | Agent personas |
| `CONTENT` | Curriculum material |
| `VOICE` | Voice guidance |

---

## Feature: Transcript Processing

```gherkin
Feature: Transcript Processing
  As a system operator
  I want to process raw transcript files
  So that calls are extracted and stored for analysis

  Background:
    Given HF_OPS_ENABLED=true in environment
    And HF_KB_PATH points to the knowledge base directory

  Scenario: Process new transcript file
    Given a JSON file exists in $HF_KB_PATH/sources/transcripts/
    And the file has not been processed before (by hash)
    When I call POST /api/ops with opid "transcripts:process"
    Then the system scans for JSON files
    And extracts calls from each file
    And creates Call records in the database
    And creates User records if customer info exists
    And marks the ProcessedFile as COMPLETED

  Scenario: Handle duplicate files
    Given a file with the same content hash was already processed
    When I call POST /api/ops with opid "transcripts:process"
    Then the file is skipped
    And no duplicate calls are created

  Scenario: Handle partial failures
    Given a transcript file contains 10 calls
    And 2 calls have no transcript field
    When processing completes
    Then 8 calls are extracted
    And 2 FailedCall records are created
    And ProcessedFile status is PARTIAL

  Scenario: Handle various JSON formats
    Given transcript files may have different structures:
      | Format               | Structure                          |
      | Array                | [{transcript: "..."}, ...]         |
      | Calls wrapper        | {calls: [{transcript: "..."}]}     |
      | Single call          | {transcript: "..."}                |
      | Messages format      | {messages: [{role, content}]}      |
    When processing each format
    Then the system auto-detects and extracts correctly
```

---

## Feature: Personality Analysis

```gherkin
Feature: Personality Analysis (Spec-Driven)
  As a system operator
  I want to analyze call transcripts for personality traits
  So that user personalities can be profiled

  Background:
    Given MEASURE-type AnalysisSpecs exist and are active
    And each spec links to a Parameter

  Scenario: Score calls with active specs
    Given calls exist with transcripts and userId
    And calls have not been scored for the given spec
    When I call POST /api/ops with opid "personality:analyze"
    And settings.mock = true
    Then for each call × spec:
      | The spec's promptTemplate is rendered with transcript |
      | Mock scoring generates a 0-1 score                    |
      | A CallScore record is created                         |
    And UserPersonality is aggregated with time decay

  Scenario: Time decay weighting
    Given a user has call scores from different dates
    And halfLifeDays = 30
    When aggregating into UserPersonality
    Then recent scores have higher weight
    And a 30-day-old score has ~50% weight
    And the weighted average is stored

  Scenario: Spec-based scoring
    Given MEASURE-type AnalysisSpecs exist with promptTemplate
    When running personality analysis
    Then the system uses the spec's template
    And creates CallScore records linked to the spec

  Scenario: Plan mode (dry run)
    When I call POST /api/ops with opid "personality:analyze"
    And settings.plan = true
    Then no data is modified
    And the system outputs what would happen
```

---

## Feature: Memory Extraction

```gherkin
Feature: Memory Extraction (Spec-Driven)
  As a system operator
  I want to extract memories from call transcripts
  So that user context can be recalled in future calls

  Background:
    Given LEARN-type AnalysisSpecs exist and are active
    And each spec defines a memory domain (facts, preferences, etc.)

  Scenario: Extract memories using specs
    Given calls exist with transcripts and userId
    When I call POST /api/ops with opid "memory:extract"
    And settings.mock = true
    Then for each call × spec:
      | Pattern matching extracts key-value pairs       |
      | Keys are normalized (e.g., city → location)     |
      | Categories are mapped to MemoryCategory enum    |
      | UserMemory records are created                  |

  Scenario: Handle contradictions
    Given a user has existing memory: location = "San Francisco"
    When a new call extracts: location = "New York"
    Then the old memory is superseded
    And the new memory is stored
    And contradictionsResolved count increases

  Scenario: Pattern-based extraction examples
    Given a transcript contains text
    Then these patterns extract memories:
      | Pattern                      | Extracts                    |
      | "I live in {City}"          | location = {City}           |
      | "I work at {Company}"       | employer = {Company}        |
      | "I have {N} kids"           | children_count = {N}        |
      | "I prefer {method}"         | preferred_contact = {method}|
      | "I'm traveling next week"   | traveling (expires 14 days) |

  Scenario: Aggregate memory summaries
    Given a user has multiple memories
    When aggregation runs
    Then UserMemorySummary is updated with:
      | factCount, preferenceCount, eventCount, topicCount |
      | keyFacts array with top 10 facts                   |
      | topTopics array with top 5 topics                  |
      | preferences object keyed by normalizedKey          |
```

---

## Feature: Knowledge Ingestion

```gherkin
Feature: Knowledge Ingestion
  As a system operator
  I want to ingest knowledge documents
  So that they can be used for context in prompts

  Background:
    Given HF_KB_PATH points to knowledge base directory
    And knowledge files exist in $HF_KB_PATH/sources/knowledge/

  Scenario: Ingest markdown documents
    Given .md files exist in the knowledge directory
    When I call POST /api/ops with opid "knowledge:ingest"
    Then KnowledgeDoc records are created
    And content is extracted from markdown
    And documents are linked to relevant parameters

  Scenario: Ingest PDF documents
    Given .pdf files exist in the knowledge directory
    When knowledge ingestion runs
    Then PDF content is extracted
    And KnowledgeDoc records are created

  Scenario: Skip already ingested files
    Given a file was previously ingested (by hash)
    When running ingestion again
    Then the file is skipped unless force=true
```

---

## Feature: Agent Management

```gherkin
Feature: Agent Publishing Model
  As a system operator
  I want to manage agent configurations
  So that I can test changes before going live

  Scenario: Create draft agent instance
    Given an agent exists in agents.json manifest
    When I POST to /api/agents with custom settings
    Then an AgentInstance is created with status=DRAFT
    And settings are stored as JSON

  Scenario: Publish agent instance
    Given a DRAFT AgentInstance exists
    When I POST to /api/agents/{agentId}/publish
    Then the instance status changes to PUBLISHED
    And any previous PUBLISHED instance becomes SUPERSEDED
    And publishedAt is set to now

  Scenario: Run agent
    Given a PUBLISHED AgentInstance exists
    When I POST to /api/agents/run with agentId
    Then the published settings are used
    And an AgentRun record is created
    And the corresponding op is executed
```

---

## Feature: Prompt Composition

```gherkin
Feature: Spec-Based Prompt Composition
  As a system operator
  I want to generate prompts based on user personality
  So that conversations are personalized

  Background:
    Given AnalysisSpecs exist with promptTemplate field
    And users have UserPersonalityProfile records

  Scenario: Compose prompts from specs
    Given a user has parameter values in UserPersonalityProfile
    When I POST to /api/prompt/compose-from-specs with userId
    Then for each active spec with promptTemplate:
      | The template is rendered with user's parameter values |
      | Memories are injected if includeMemories=true         |
      | Conditionals (high/medium/low) are evaluated          |
    And the combined prompt is returned

  Scenario: Template variable resolution
    Given a spec template contains {{value}} and {{label}}
    When composing for a user with B5-O = 0.82
    Then {{value}} resolves to 0.82
    And {{label}} resolves to "high"
    And {{#if high}} blocks are rendered

  Scenario: Memory injection
    Given a user has FACT memories
    And includeMemories = true
    When composing prompts
    Then {{#each memories.FACT}} loops render
    And memory key-value pairs are included

  Scenario: Post-call prompt generation
    Given a call was just completed
    When I POST to /api/prompt/post-call with callId
    Then the user's profile is refreshed
    And prompts for the next call are composed
```

---

## Feature: Flow Visualization

```gherkin
Feature: Flow Graph Visualization
  As a system user
  I want to see the data processing pipeline
  So that I understand how data flows through the system

  Scenario: View flow graph
    When I navigate to /x/taxonomy-graph
    Then I see a React Flow diagram with:
      | Source nodes (blue)  | Knowledge, Transcripts, Parameters |
      | Agent nodes (purple) | Ingestor, Analyzer, Extractor      |
      | Output nodes (teal)  | Chunks, Profiles, Prompts          |
    And edges show data dependencies

  Scenario: View node status
    Given I am viewing the flow graph
    When I look at an agent node
    Then I see its current status (draft/published)
    And I see last run timestamp
    And I see record counts from prerequisites
```

---

## Feature: Database Management

```gherkin
Feature: Database Reset and Seeding
  As a developer or operator
  I want to reset and reseed the database
  So that I can start fresh with clean data

  Scenario: Full database reset
    When I run "npm run db:reset"
    And I confirm with "yes"
    Then all data is deleted from all tables
    And tables are cleared in FK-safe order
    And the schema is preserved

  Scenario: Run all seeds
    Given the database is empty or reset
    When I run "npm run db:seed:all"
    Then seeds run in order:
      | Parameters (from CSV)           |
      | Parameter Types                 |
      | Big Five personality model      |
      | Analysis Specs                  |
      | Memory Specs                    |
      | Prompt Templates                |
      | Prompt Slugs                    |
      | Run Configs                     |
      | Adapt System                    |
    And the database is ready for ops
```

---

## Feature: Ops API

```gherkin
Feature: Operations API
  As a system operator
  I want a unified ops endpoint
  So that I can trigger data processing operations

  Background:
    Given HF_OPS_ENABLED=true

  Scenario: List available operations
    When I GET /api/ops
    Then I receive a list of operations with status:
      | opid                | status          |
      | transcripts:process | implemented     |
      | knowledge:ingest    | implemented     |
      | kb:links:extract    | implemented     |
      | personality:analyze | implemented     |
      | memory:extract      | implemented     |
      | knowledge:embed     | not_implemented |

  Scenario: Execute operation
    When I POST to /api/ops with:
      | opid     | "transcripts:process" |
      | settings | { filepath: "..." }   |
      | dryRun   | false                 |
    Then the operation executes
    And I receive a result with:
      | success   | boolean          |
      | opid      | string           |
      | result    | operation output |
      | timestamp | ISO date string  |

  Scenario: Operations disabled
    Given HF_OPS_ENABLED is not set or false
    When I POST to /api/ops
    Then I receive 403 error
    And message indicates ops are disabled
```

---

## Test Commands

```bash
# Run all unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch

# Reset database
npm run db:reset

# Seed all data
npm run db:seed:all
```

---

## Related Documentation

- [ADMIN_USER_GUIDE.md](ADMIN_USER_GUIDE.md) - Comprehensive admin guide
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Admin architecture and data flow
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [QUICKSTART.md](QUICKSTART.md) - Getting started guide
