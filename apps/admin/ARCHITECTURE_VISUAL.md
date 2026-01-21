      # 🏗️ HF System Architecture

      ## Complete Data Flow: Nothing → Expert Prompts → Learning

      ---

      # 📊 Executive Overview

      <table>
      <tr>
      <td width="25%" align="center">
      <h3>📁 SOURCES</h3>
      <p>Raw data inputs</p>
      <ul>
      <li>Knowledge docs</li>
      <li>Transcripts</li>
      <li>Parameters</li>
      </ul>
      </td>
      <td width="25%" align="center">
      <h3>🤖 AGENTS</h3>
      <p>Processing pipelines</p>
      <ul>
      <li>Ingestors</li>
      <li>Processors</li>
      <li>Analyzers</li>
      </ul>
      </td>
      <td width="25%" align="center">
      <h3>📦 DERIVED</h3>
      <p>Structured outputs</p>
      <ul>
      <li>Chunks/Vectors</li>
      <li>Calls/Users</li>
      <li>Personalities</li>
      </ul>
      </td>
      <td width="25%" align="center">
      <h3>⚡ RUNTIME</h3>
      <p>Live inference</p>
      <ul>
      <li>selectSlug()</li>
      <li>compose()</li>
      <li>reward()</li>
      </ul>
      </td>
      </tr>
      </table>

      ---

      # 🔄 Phase 1: Foundation

      ## 1.1 Knowledge Ingestion

      ```
      ┌────────────────┐      ┌─────────────────────┐      ┌────────────────┐
      │                │      │                     │      │                │
      │   📁 sources/  │ ───► │  🤖 knowledge_      │ ───► │  📚 Knowledge  │
      │   knowledge/   │      │     ingestor        │      │     Doc/Chunk  │
      │                │      │                     │      │                │
      └────────────────┘      └─────────────────────┘      └────────────────┘
            *.md                   Agent                    + VectorEmbedding
            *.txt                  OpID: knowledge:ingest
            *.pdf
      ```

      **Purpose:** Make LLM "expert" in your domain

      ---

      ## 1.2 Transcript Processing

      ```
      ┌────────────────┐      ┌─────────────────────┐      ┌────────────────┐
      │                │      │                     │      │                │
      │   📁 sources/  │ ───► │  🤖 transcript_     │ ───► │  📞 Call       │
      │   transcripts/ │      │     processor       │      │  👤 User       │
      │                │      │                     │      │  📥 Batch      │
      └────────────────┘      └─────────────────────┘      └────────────────┘
            *.json                 Agent                    Hash-deduplicated
                              OpID: transcripts:process
      ```

      **Purpose:** Structure raw calls for analysis

      ---

      ## 1.3 Parameter Snapshot

      ```
      ┌────────────────┐      ┌─────────────────────┐      ┌────────────────┐
      │                │      │                     │      │                │
      │   🏷️ Parameter │ ───► │  🤖 parameters_     │ ───► │  📦 Parameter  │
      │   (Active)     │      │     snapshot        │      │     Set        │
      │                │      │                     │      │                │
      └────────────────┘      └─────────────────────┘      └────────────────┘
                              Agent                    Immutable version
                              OpID: kb:parameters:snapshot
      ```

      **Purpose:** Reproducible analysis snapshots

      ---

      # 🧠 Phase 2: Observation

      ## 2.1 Personality Analysis

      ```
      ┌────────────────┐      ┌─────────────────────┐      ┌────────────────┐
      │  📞 Call       │      │                     │      │  📊 Personality│
      │  +             │ ───► │  🤖 personality_    │ ───► │     Observation│
      │  📦 ParamSet   │      │     analyzer        │      │  👤 User       │
      │                │      │     (LLM)           │      │     Personality│
      └────────────────┘      └─────────────────────┘      └────────────────┘
                              Agent                    Big Five scores
                              OpID: personality:analyze   + evidence
      ```

      ## 2.2 Time-Decay Aggregation

      ```
                        PersonalityObservation (per call)
                                    │
                                    │  weight = e^(-λt)
                                    │  λ = ln(2) / 30 days
                                    ▼
                        ┌───────────────────────┐
                        │   UserPersonality     │
                        │   (aggregated)        │
                        │                       │
                        │   O: 0.72  C: 0.65    │
                        │   E: 0.48  A: 0.81    │
                        │   N: 0.33             │
                        │                       │
                        │   confidence: 0.85    │
                        └───────────────────────┘
      ```

      ---

      # 🎯 Phase 3: Prompt Selection

      ## 3.1 selectPromptSlug() Algorithm

      ```
      ┌─────────────────────────────────────────────────────────────────────┐
      │                                                                     │
      │   INPUT                      PROCESS                    OUTPUT      │
      │                                                                     │
      │   userId/callId    ───►   1. Get personality     ───►  promptSlug  │
      │                           2. Get recent slugs           confidence  │
      │                           3. Get slug stats             reasoning   │
      │                           4. Score candidates           snapshot    │
      │                           5. Select best                            │
      │                                                                     │
      └─────────────────────────────────────────────────────────────────────┘
      ```

      ## 3.2 Prompt Slug Taxonomy

      | Category | Purpose | Examples |
      |----------|---------|----------|
      | `engage.*` | Build rapport | active_listening, encourage, validate |
      | `emotion.*` | Emotional support | soothing, empathize, reassure |
      | `control.*` | Guide conversation | clarify, redirect, summarize |
      | `solve.*` | Problem resolution | diagnose, explain, action_plan |
      | `close.*` | Wrap up | confirm, next_steps, farewell |

      ## 3.3 Personality → Slug Matching

      | Trait High | Suggests |
      |------------|----------|
      | Openness | `engage.*`, creative |
      | Conscientiousness | Detailed, plans |
      | Extraversion | Conversational |
      | Agreeableness | `emotion.*` |
      | Neuroticism | `emotion.soothing` |

      ---

      # 📝 Phase 4: Prompt Composition

      ## 4.1 Layer Architecture

      ```
      ┌─────────────────────────────────────────────────────────────────────┐
      │                                                                     │
      │   ╔═══════════════════════════════════════════════════════════╗    │
      │   ║  SYSTEM LAYER                                              ║    │
      │   ║  Base persona, capabilities                                ║    │
      │   ║  Source: PromptTemplate                                    ║    │
      │   ╚═══════════════════════════════════════════════════════════╝    │
      │                              ▼                                      │
      │   ╔═══════════════════════════════════════════════════════════╗    │
      │   ║  CONTEXT LAYER                                             ║    │
      │   ║  Retrieved knowledge chunks                                ║    │
      │   ║  Source: KnowledgeChunk (vector search)                    ║    │
      │   ╚═══════════════════════════════════════════════════════════╝    │
      │                              ▼                                      │
      │   ╔═══════════════════════════════════════════════════════════╗    │
      │   ║  PERSONALITY LAYER                                         ║    │
      │   ║  Trait-based tone modifiers                                ║    │
      │   ║  Source: UserPersonality                                   ║    │
      │   ╚═══════════════════════════════════════════════════════════╝    │
      │                              ▼                                      │
      │   ╔═══════════════════════════════════════════════════════════╗    │
      │   ║  RULE LAYER                                                ║    │
      │   ║  Guardrails, compliance                                    ║    │
      │   ║  Source: ControlSet                                        ║    │
      │   ╚═══════════════════════════════════════════════════════════╝    │
      │                              ▼                                      │
      │   ╔═══════════════════════════════════════════════════════════╗    │
      │   ║  OPTIMISATION LAYER                                        ║    │
      │   ║  A/B variants, reward adjustments                          ║    │
      │   ║  Source: PromptSlugStats                                   ║    │
      │   ╚═══════════════════════════════════════════════════════════╝    │
      │                                                                     │
      └─────────────────────────────────────────────────────────────────────┘
      ```

      ---

      # 🏆 Phase 5: Reward & Learning

      ## 5.1 Reward Signals

      <table>
      <tr>
      <td width="33%">
      <h4>📋 EXPLICIT</h4>
      <ul>
      <li>Agent rating (1-5)</li>
      <li>Customer CSAT</li>
      <li>QA score</li>
      <li>Escalation flag</li>
      </ul>
      </td>
      <td width="33%">
      <h4>📊 IMPLICIT</h4>
      <ul>
      <li>Call duration</li>
      <li>Silence ratio</li>
      <li>Interruptions</li>
      <li>Transfer flag</li>
      </ul>
      </td>
      <td width="33%">
      <h4>🤖 DERIVED</h4>
      <ul>
      <li>Sentiment delta</li>
      <li>Resolution (LLM)</li>
      <li>Follow-up needed</li>
      </ul>
      </td>
      </tr>
      </table>

      ## 5.2 The Learning Loop

      ```
                              ┌──────────────────┐
                              │ selectPromptSlug │◄──────────────────┐
                              │ (uses stats)     │                   │
                              └────────┬─────────┘                   │
                                    │                             │
                                    ▼                             │
                              ┌──────────────────┐                   │
                              │ PromptSlug-      │                   │
                              │ Selection        │                   │
                              └────────┬─────────┘                   │
                                    │                             │
                                    ▼                             │
                              ┌──────────────────┐                   │
                              │ Call Execution   │                   │
                              │ (prompt used)    │                   │
                              └────────┬─────────┘                   │
                                    │                             │
                                    ▼                             │
                              ┌──────────────────┐                   │
                              │ Reward Signals   │                   │
                              │ (collected)      │                   │
                              └────────┬─────────┘                   │
                                    │                             │
                                    ▼                             │
                              ┌──────────────────┐                   │
                              │ PromptSlugStats  │───────────────────┘
                              │ (updated)        │
                              └──────────────────┘
      ```

      ---

      # 🗄️ Complete Data Model

      ## Entity Map

      ```
      ┌─────────────────────────────────────────────────────────────────────┐
      │                                                                     │
      │  SOURCES                  DERIVED                  RUNTIME          │
      │                                                                     │
      │  Parameter ──────────► ParameterSet                                 │
      │      │                     │                                        │
      │      └─────────────► ParameterSetParameter                          │
      │                                                                     │
      │  KnowledgeDoc ───────► KnowledgeChunk ─────► VectorEmbedding       │
      │                            │                                        │
      │                            └─────────► KnowledgeArtifact            │
      │                                                                     │
      │  ProcessedFile ──────► Call ◄────────────────────────────────┐     │
      │                           │                                   │     │
      │                           ▼                                   │     │
      │                        User ◄─────────────────────────────┐  │     │
      │                           │                               │  │     │
      │                           ▼                               │  │     │
      │               PersonalityObservation                      │  │     │
      │                           │                               │  │     │
      │                           ▼                               │  │     │
      │                   UserPersonality                         │  │     │
      │                           │                               │  │     │
      │                           ▼                               │  │     │
      │               PromptSlugSelection ───► PromptSlugReward   │  │     │
      │                                              │            │  │     │
      │                                              ▼            │  │     │
      │                                      PromptSlugStats      │  │     │
      │                                                           │  │     │
      │  ControlSet ─────────────────────────────────────────────┘  │     │
      │      │                                                      │     │
      │      └─► ControlSetParameter                                │     │
      │                                                             │     │
      │  PromptTemplate ◄─────── ControlSet                         │     │
      │                                                             │     │
      │  AgentInstance ─────────► AgentRun ─────────────────────────┘     │
      │                                                                     │
      └─────────────────────────────────────────────────────────────────────┘
      ```

      ---

      # 🤖 Agent Inventory

      | Agent | OpID | I/O | Status |
      |-------|------|-----|--------|
      | 📚 Knowledge Ingestor | `knowledge:ingest` | docs → chunks | Ready |
      | 🔢 Knowledge Embedder | `knowledge:embed` | chunks → vectors | Ready |
      | 📞 Transcript Processor | `transcripts:process` | json → calls, users | Active |
      | 📦 Parameters Snapshot | `kb:parameters:snapshot` | params → set | Active |
      | 🧠 Personality Analyzer | `personality:analyze` | calls → traits | Ready |

      ## Agent Publishing Flow

      ```
      ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
      │  📄         │     │  📝         │     │  ✅         │
      │  agents.    │ ──► │  Agent      │ ──► │  Agent      │
      │  json       │     │  Instance   │     │  Instance   │
      │  (defaults) │     │  (DRAFT)    │     │  (PUBLISHED)│
      └─────────────┘     └─────────────┘     └─────────────┘
                              │                    │
                        [Edit in UI]         [Used by runs]
                              │                    │
                              ▼                    ▼
                        PUT /api/agents/   POST /api/agents/run
      ```

      ---

      # 🖥️ Visual Flow UI

      ## Pipeline Nodes

      | Node | Color | Description |
      |------|-------|-------------|
      | 🔵 Source | Blue | Knowledge, transcripts, parameters |
      | 🟣 Agent (draft) | Purple | Not yet published |
      | 🟢 Agent (live) | Green | Published instance |
      | 🔷 Output | Teal | Database tables |

      ## Features

      - ✅ Click node to view details
      - ✅ Run agent from panel
      - ✅ Drag to rearrange
      - ✅ Run All button
      - ✅ Real-time status updates

      ---

      # 🚀 Quick Start

      ## URLs

      | Route | Purpose |
      |-------|---------|
      | `/getting-started` | Step-by-step onboarding |
      | `/flow` | Visual pipeline |
      | `/pipeline` | Sequential runner |
      | `/ops` | Low-level ops |
      | `/agents` | Agent settings |

      ## Environment

      ```bash
      HF_KB_PATH=/path/to/kb    # Knowledge base root
      HF_OPS_ENABLED=true       # Enable ops API
      DATABASE_URL=postgres://  # Database
      ```

      ## Common Ops

      ```bash
      # Ingest knowledge
      POST /api/ops/knowledge:ingest

      # Process transcripts
      POST /api/ops/transcripts:process

      # Snapshot parameters
      POST /api/ops/kb:parameters:snapshot

      # Run any agent
      POST /api/agents/run { "agentId": "..." }
      ```

      ---

      <div align="center">

      # 🏁

      **HF System Architecture**

      *From Raw Data to Intelligent Prompts*

      *Document Version: 2.0 | January 2026*

      </div>
