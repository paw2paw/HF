"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";

// Guide sections with navigation
const sections = [
  {
    id: "overview",
    title: "System Overview",
    icon: "🏠",
    content: `
      <h2>What is HF?</h2>
      <p>HF (Human Factors) is a personality-driven adaptive conversational AI system that:</p>
      <ul>
        <li><strong>Processes call transcripts</strong> to extract personality insights</li>
        <li><strong>Builds user profiles</strong> using Big Five traits with time decay</li>
        <li><strong>Extracts structured memories</strong> from conversations</li>
        <li><strong>Generates adaptive prompts</strong> based on personality</li>
        <li><strong>Continuously learns</strong> from call outcomes</li>
      </ul>

      <h3>Architecture Overview</h3>
      <div class="diagram">
        <pre>
SOURCES         →    AGENTS           →    DERIVED          →    RUNTIME
────────             ──────                ───────               ───────
Knowledge       →    Ingestor        →    Chunks/Vectors   →
Transcripts     →    Processor       →    Calls/Users      →    compose()
Parameters      →    Analyzer        →    Personalities    →    → Prompts
                →    Extractor       →    Memories         →
        </pre>
      </div>
    `,
    links: [
      { href: "/cockpit", label: "System Cockpit", desc: "View system status" },
      { href: "/flow", label: "Flow Visualization", desc: "Visual pipeline" },
    ],
  },
  {
    id: "core-concepts",
    title: "Core Concepts",
    icon: "💡",
    content: `
      <h2>The Three Pillars</h2>
      <table>
        <tr><th>Concept</th><th>Purpose</th><th>Manages</th></tr>
        <tr><td><strong>Parameter</strong></td><td>WHAT to measure</td><td>Personality dimensions (e.g., Openness)</td></tr>
        <tr><td><strong>AnalysisSpec</strong></td><td>HOW to measure/extract</td><td>Scoring logic, extraction patterns</td></tr>
        <tr><td><strong>PromptSlug</strong></td><td>WHAT to say</td><td>Adaptive prompts by score range</td></tr>
      </table>

      <h3>AnalysisSpec Types</h3>
      <ul>
        <li><strong>MEASURE</strong> - Score personality traits (0-1 scale) → produces <code>CallScore</code></li>
        <li><strong>LEARN</strong> - Extract memories (key-value facts) → produces <code>UserMemory</code></li>
        <li><strong>ADAPT</strong> - Compute deltas and goal progress</li>
        <li><strong>MEASURE_AGENT</strong> - Score agent communication behaviors → produces <code>BehaviorMeasurement</code></li>
      </ul>

      <h3>Relationship Flow</h3>
      <div class="diagram">
        <pre>
Parameter (e.g., "Openness")
    │
    ├── AnalysisSpec (MEASURE) ── "How to score from transcript"
    │
    └── PromptSlug ── "What to say based on score"
            ├── High (0.7+): "Be exploratory..."
            ├── Medium (0.4-0.7): "Balance routine..."
            └── Low (<0.4): "Stick to proven..."
        </pre>
      </div>
    `,
    links: [
      { href: "/admin", label: "Parameters", desc: "Manage measurement dimensions" },
      { href: "/analysis-specs", label: "Analysis Specs", desc: "Configure scoring/extraction" },
      { href: "/prompt-slugs", label: "Prompt Slugs", desc: "Define adaptive prompts" },
    ],
  },
  {
    id: "pipeline",
    title: "Pipeline Phases",
    icon: "🔄",
    content: `
      <h2>Phase 1: Foundation</h2>
      <h4>Knowledge Ingestion</h4>
      <p><strong>Agent:</strong> <code>knowledge_ingestor</code> | <strong>OpID:</strong> <code>knowledge:ingest</code></p>
      <p>Processes markdown, PDF documents into chunks for RAG context.</p>

      <h4>Transcript Processing</h4>
      <p><strong>Agent:</strong> <code>transcript_processor</code> | <strong>OpID:</strong> <code>transcripts:process</code></p>
      <p>Extracts calls from JSON files, creates User records, tracks processed files.</p>

      <h2>Phase 2: Observation</h2>
      <h4>Personality Analysis</h4>
      <p><strong>Agent:</strong> <code>personality_analyzer</code> | <strong>OpID:</strong> <code>personality:analyze</code></p>
      <p>Scores calls using MEASURE-type AnalysisSpecs, aggregates with time decay.</p>

      <h4>Memory Extraction</h4>
      <p><strong>Agent:</strong> <code>memory_extractor</code> | <strong>OpID:</strong> <code>memory:extract</code></p>
      <p>Extracts facts, preferences, events using LEARN-type AnalysisSpecs.</p>

      <h2>Phase 3: Composition</h2>
      <p><strong>Endpoint:</strong> <code>POST /api/prompt/compose-from-specs</code></p>
      <p>Generates personalized prompts based on user's personality profile and memories.</p>
    `,
    links: [
      { href: "/ops", label: "Operations", desc: "Run pipeline operations" },
      { href: "/agents", label: "Agents", desc: "Manage agent configurations" },
      { href: "/transcripts", label: "Transcripts", desc: "View transcript files" },
    ],
  },
  {
    id: "memory-system",
    title: "Memory System",
    icon: "🧠",
    content: `
      <h2>Memory Categories</h2>
      <table>
        <tr><th>Category</th><th>Description</th><th>Example</th></tr>
        <tr><td><code>FACT</code></td><td>Immutable facts</td><td>location, occupation</td></tr>
        <tr><td><code>PREFERENCE</code></td><td>User preferences</td><td>contact method, response style</td></tr>
        <tr><td><code>EVENT</code></td><td>Time-bound events</td><td>appointments, complaints</td></tr>
        <tr><td><code>TOPIC</code></td><td>Topics discussed</td><td>interests, products</td></tr>
        <tr><td><code>RELATIONSHIP</code></td><td>Relationships</td><td>family, colleagues</td></tr>
        <tr><td><code>CONTEXT</code></td><td>Temporary situational</td><td>traveling, in meeting</td></tr>
      </table>

      <h3>Extraction Flow</h3>
      <ol>
        <li><strong>Pattern Matching / LLM:</strong> "I live in London" → <code>{ key: "location", value: "London" }</code></li>
        <li><strong>Key Normalization:</strong> "spouse_name" → "spouse"</li>
        <li><strong>Contradiction Resolution:</strong> Newer memories supersede older ones</li>
      </ol>
    `,
    links: [
      { href: "/memories", label: "Memory Config", desc: "Configure memory extraction" },
      { href: "/callers", label: "Callers", desc: "View caller profiles with memories" },
    ],
  },
  {
    id: "prompt-composition",
    title: "Prompt Composition",
    icon: "✍️",
    content: `
      <h2>Primary Method: Spec-Based Composition</h2>
      <p><strong>Endpoint:</strong> <code>POST /api/prompt/compose-from-specs</code></p>

      <h3>Template Variables (Mustache-style)</h3>
      <table>
        <tr><th>Variable</th><th>Description</th></tr>
        <tr><td><code>{{value}}</code></td><td>Parameter value (0-1)</td></tr>
        <tr><td><code>{{label}}</code></td><td>Level: "high", "medium", "low"</td></tr>
        <tr><td><code>{{param.name}}</code></td><td>Parameter name</td></tr>
        <tr><td><code>{{#if high}}...{{/if}}</code></td><td>Conditional for value >= 0.7</td></tr>
        <tr><td><code>{{#if medium}}...{{/if}}</code></td><td>Conditional for 0.4 <= value < 0.7</td></tr>
        <tr><td><code>{{#if low}}...{{/if}}</code></td><td>Conditional for value < 0.4</td></tr>
        <tr><td><code>{{#each memories.FACT}}</code></td><td>Loop over FACT memories</td></tr>
      </table>

      <h3>Prompt Layers</h3>
      <ol>
        <li><strong>SYSTEM:</strong> Base persona, capabilities (PromptBlock)</li>
        <li><strong>CONTEXT:</strong> Knowledge chunks via vector search</li>
        <li><strong>PERSONALITY:</strong> Trait-based modifiers (AnalysisSpec templates)</li>
        <li><strong>MEMORY:</strong> Caller facts, preferences (CallerMemory)</li>
        <li><strong>BEHAVIOR:</strong> Agent behavior targets (BehaviorTarget)</li>
      </ol>
    `,
    links: [
      { href: "/prompt-blocks", label: "Prompt Blocks", desc: "Static prompt sections" },
      { href: "/analysis-test", label: "Test Lab", desc: "Test prompt composition" },
    ],
  },
  {
    id: "time-decay",
    title: "Time-Decay Aggregation",
    icon: "⏱️",
    content: `
      <h2>Concept</h2>
      <p>Recent calls influence personality profiles more than old calls. We use <strong>exponential decay</strong> with a configurable half-life (default: 30 days).</p>

      <h3>Formula</h3>
      <div class="code-block">
        <pre>
weight = e^(-λ × age_in_days)
where λ = ln(2) / halfLifeDays
        </pre>
      </div>

      <h3>Example Timeline (halfLife = 30 days)</h3>
      <table>
        <tr><th>Day</th><th>Call</th><th>Openness</th><th>Weight at Day 30</th></tr>
        <tr><td>0</td><td>Call 1</td><td>0.8</td><td>0.5</td></tr>
        <tr><td>10</td><td>Call 2</td><td>0.7</td><td>0.7</td></tr>
        <tr><td>20</td><td>Call 3</td><td>0.6</td><td>0.87</td></tr>
      </table>

      <p><strong>Aggregated Openness:</strong> (0.8×0.5 + 0.7×0.7 + 0.6×0.87) / (0.5+0.7+0.87) = <strong>0.68</strong></p>
    `,
    links: [
      { href: "/analysis-profiles", label: "Analysis Profiles", desc: "Configure decay settings" },
      { href: "/callers", label: "Callers", desc: "View aggregated profiles" },
    ],
  },
  {
    id: "reward-loop",
    title: "Reward & Learning Loop",
    icon: "🎯",
    content: `
      <h2>Behavior-Driven Learning</h2>
      <p>The reward system enables continuous learning by measuring behaviour, comparing them to targets, and adjusting based on outcomes.</p>

      <h3>Core Components</h3>
      <table>
        <tr><th>Component</th><th>Purpose</th></tr>
        <tr><td><strong>BehaviorParameter</strong></td><td>Agent communication behaviors (HOW to talk)</td></tr>
        <tr><td><strong>BehaviorTarget</strong></td><td>Target values layered: SYSTEM → SEGMENT → CALLER</td></tr>
        <tr><td><strong>BehaviorMeasurement</strong></td><td>What the agent actually did per call</td></tr>
        <tr><td><strong>RewardScore</strong></td><td>Comparison of targets vs actuals + outcomes</td></tr>
      </table>

      <h3>Behavior Parameters</h3>
      <p>Agent-side parameters (type=BEHAVIOR) define communication style:</p>
      <table>
        <tr><th>Parameter</th><th>Low (0)</th><th>High (1)</th></tr>
        <tr><td>BEH-FORMALITY</td><td>Casual</td><td>Formal</td></tr>
        <tr><td>BEH-WARMTH</td><td>Distant</td><td>Warm</td></tr>
        <tr><td>BEH-EMPATHY-RATE</td><td>Neutral</td><td>Empathic</td></tr>
        <tr><td>BEH-DIRECTNESS</td><td>Indirect</td><td>Direct</td></tr>
        <tr><td>BEH-QUESTION-RATE</td><td>Statements</td><td>Questions</td></tr>
        <tr><td>BEH-ACTIVE-LISTEN</td><td>Passive</td><td>Active</td></tr>
        <tr><td>BEH-PERSONALIZATION</td><td>Generic</td><td>Personal</td></tr>
      </table>

      <h3>Target Layering</h3>
      <div class="diagram">
        <pre>
SYSTEM targets (defaults for all)
    │
    ▼
SEGMENT targets (company/community overrides)
    │
    ▼
CALLER targets (individual overrides)
        </pre>
      </div>
      <p>Each layer can override specific parameters while inheriting others.</p>

      <h3>Learning Rules</h3>
      <table>
        <tr><th>Condition</th><th>Action</th></tr>
        <tr><td>Good outcome + hit target</td><td>Reinforce (increase confidence)</td></tr>
        <tr><td>Good outcome + missed target</td><td>Adjust target toward actual</td></tr>
        <tr><td>Bad outcome + hit target</td><td>Re-evaluate (decrease confidence)</td></tr>
        <tr><td>Bad outcome + missed target</td><td>Adjust target away from actual</td></tr>
      </table>

      <h3>Reward Loop Pipeline</h3>
      <div class="diagram">
        <pre>
Call Completed
      │
      ▼
┌─────────────────────┐
│  measure_agent      │  Measure behaviour
│  → BehaviorMeasure  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  compute_reward     │  Compare to targets
│  → RewardScore      │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  update_targets     │  Apply learning rules
│  → BehaviorTarget   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  compose_next_prompt│  Build next prompt
│  → Caller.nextPrompt│
└─────────────────────┘
        </pre>
      </div>
    `,
    links: [
      { href: "/admin#behavior-targets", label: "Behavior Targets", desc: "Configure target values" },
      { href: "/callers", label: "Callers", desc: "View per-caller prompts" },
      { href: "/ops", label: "Operations", desc: "Run reward loop agents" },
    ],
  },
  {
    id: "agents",
    title: "Agent System",
    icon: "🤖",
    content: `
      <h2>Agent Inventory</h2>
      <table>
        <tr><th>Agent</th><th>OpID</th><th>Status</th></tr>
        <tr><td>Knowledge Ingestor</td><td><code>knowledge:ingest</code></td><td>Implemented</td></tr>
        <tr><td>Transcript Processor</td><td><code>transcripts:process</code></td><td>Implemented</td></tr>
        <tr><td>Personality Analyzer</td><td><code>personality:analyze</code></td><td>Implemented</td></tr>
        <tr><td>Memory Extractor</td><td><code>memory:extract</code></td><td>Implemented</td></tr>
        <tr><td>Knowledge Embedder</td><td><code>knowledge:embed</code></td><td>Not implemented</td></tr>
        <tr><td><strong>Agent Behavior Measurer</strong></td><td><code>behavior:measure</code></td><td>Implemented</td></tr>
        <tr><td><strong>Reward Computer</strong></td><td><code>reward:compute</code></td><td>Implemented</td></tr>
        <tr><td><strong>Target Updater</strong></td><td><code>targets:update</code></td><td>Implemented</td></tr>
        <tr><td><strong>Next Prompt Composer</strong></td><td><code>prompt:compose-next</code></td><td>Implemented</td></tr>
      </table>

      <h3>Publishing Workflow</h3>
      <div class="diagram">
        <pre>
agents.json  →  AgentInstance  →  AgentInstance
(defaults)      (DRAFT)           (PUBLISHED)
                    │                   │
              [Edit settings]    [Used by runs]
        </pre>
      </div>

      <p><strong>Status Flow:</strong> DRAFT → PUBLISHED → SUPERSEDED</p>
    `,
    links: [
      { href: "/agents", label: "Agents", desc: "Manage agent configurations" },
      { href: "/analysis-runs", label: "Analysis Runs", desc: "View run history" },
    ],
  },
  {
    id: "path-system",
    title: "Path System",
    icon: "📁",
    content: `
      <h2>Single Source of Truth</h2>
      <p>All paths are defined in <code>lib/agents.json</code> data nodes and resolved via <code>lib/data-paths.ts</code>.</p>

      <h3>Data Node IDs</h3>
      <table>
        <tr><th>Node ID</th><th>Path</th><th>Role</th></tr>
        <tr><td><code>data:knowledge</code></td><td>sources/knowledge</td><td>source</td></tr>
        <tr><td><code>data:transcripts</code></td><td>sources/transcripts</td><td>source</td></tr>
        <tr><td><code>data:parameters_source</code></td><td>sources/parameters</td><td>source</td></tr>
        <tr><td><code>data:knowledge_derived</code></td><td>derived/knowledge</td><td>output</td></tr>
        <tr><td><code>data:embeddings</code></td><td>derived/embeddings</td><td>output</td></tr>
      </table>

      <h3>Key Functions</h3>
      <ul>
        <li><code>getKbRoot()</code> - Get KB root from HF_KB_PATH env</li>
        <li><code>resolveDataNodePath(nodeId)</code> - Resolve node to absolute path</li>
        <li><code>validateKbStructure()</code> - Check all paths exist</li>
        <li><code>initializeKbStructure()</code> - Create missing directories</li>
      </ul>
    `,
    links: [
      { href: "/cockpit", label: "Cockpit", desc: "View path configuration status" },
      { href: "/settings-library", label: "Settings", desc: "System settings" },
    ],
  },
  {
    id: "api-reference",
    title: "API Reference",
    icon: "📡",
    content: `
      <h2>Prompt Composition</h2>
      <table>
        <tr><th>Endpoint</th><th>Method</th><th>Purpose</th></tr>
        <tr><td><code>/api/prompt/compose-from-specs</code></td><td>POST</td><td>Generate prompts for a user</td></tr>
        <tr><td><code>/api/prompt/post-call</code></td><td>POST</td><td>Post-call prompt refresh</td></tr>
      </table>

      <h2>Operations</h2>
      <table>
        <tr><th>Endpoint</th><th>Method</th><th>Purpose</th></tr>
        <tr><td><code>/api/ops</code></td><td>GET</td><td>List available operations</td></tr>
        <tr><td><code>/api/ops</code></td><td>POST</td><td>Execute operation</td></tr>
      </table>

      <h2>Agents</h2>
      <table>
        <tr><th>Endpoint</th><th>Method</th><th>Purpose</th></tr>
        <tr><td><code>/api/agents</code></td><td>GET</td><td>List agents with instances</td></tr>
        <tr><td><code>/api/agents/run</code></td><td>POST</td><td>Run agent</td></tr>
        <tr><td><code>/api/agents/[agentId]/publish</code></td><td>POST</td><td>Publish draft</td></tr>
      </table>

      <h2>Data Management</h2>
      <table>
        <tr><th>Endpoint</th><th>Method</th><th>Purpose</th></tr>
        <tr><td><code>/api/parameters</code></td><td>GET/POST</td><td>Parameter CRUD</td></tr>
        <tr><td><code>/api/analysis-specs</code></td><td>GET/POST</td><td>Spec CRUD</td></tr>
        <tr><td><code>/api/prompt-slugs</code></td><td>GET/POST</td><td>Slug CRUD</td></tr>
      </table>
    `,
    links: [
      { href: "/ops", label: "Operations", desc: "Execute operations" },
    ],
  },
  {
    id: "quick-start",
    title: "Quick Start",
    icon: "🚀",
    content: `
      <h2>1. Install Dependencies</h2>
      <div class="code-block"><pre>cd apps/admin
npm install</pre></div>

      <h2>2. Initialize Database</h2>
      <div class="code-block"><pre>npx prisma migrate deploy
npx prisma generate
npm run db:seed:all</pre></div>

      <h2>3. Start the Server</h2>
      <div class="code-block"><pre>npm run dev</pre></div>

      <h2>4. Common Operations</h2>
      <div class="code-block"><pre># Process transcripts
POST /api/ops { "opid": "transcripts:process" }

# Analyze personality (mock mode)
POST /api/ops { "opid": "personality:analyze", "settings": {"mock": true} }

# Extract memories (mock mode)
POST /api/ops { "opid": "memory:extract", "settings": {"mock": true} }

# Compose prompts
POST /api/prompt/compose-from-specs { "userId": "...", "includeMemories": true }</pre></div>

      <h2>Environment Variables</h2>
      <div class="code-block"><pre>DATABASE_URL="postgresql://..."
HF_KB_PATH="/path/to/knowledge/base"
HF_OPS_ENABLED="true"</pre></div>
    `,
    links: [
      { href: "/getting-started", label: "Getting Started", desc: "Step-by-step onboarding" },
      { href: "/flow", label: "Flow", desc: "Visual pipeline" },
      { href: "/ops", label: "Ops", desc: "Run operations" },
    ],
  },
];

export default function GuidePage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");

  const currentSection = useMemo(
    () => sections.find((s) => s.id === activeSection) || sections[0],
    [activeSection]
  );

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <div className="flex h-full bg-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-neutral-200 flex flex-col">
        <div className="p-4 border-b border-neutral-200">
          <h1 className="text-lg font-bold text-neutral-900">HF Guide</h1>
          <p className="text-xs text-neutral-500 mt-1">Interactive Documentation</p>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-neutral-200">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2">
          {filteredSections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left ${
                activeSection === section.id
                  ? "bg-indigo-600 text-white"
                  : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              <span>{section.icon}</span>
              <span className="truncate">{section.title}</span>
            </button>
          ))}
        </nav>

        {/* External Docs Link */}
        <div className="p-3 border-t border-neutral-200">
          <a
            href="/ARCHITECTURE.md"
            target="_blank"
            className="text-xs text-indigo-600 hover:underline"
          >
            View full ARCHITECTURE.md →
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          {/* Breadcrumb */}
          <div className="text-sm text-neutral-500 mb-4">
            Guide / {currentSection.title}
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-neutral-900 mb-6 flex items-center gap-3">
            <span className="text-4xl">{currentSection.icon}</span>
            {currentSection.title}
          </h1>

          {/* Content */}
          <div
            className="prose prose-neutral max-w-none guide-content"
            dangerouslySetInnerHTML={{ __html: currentSection.content }}
          />

          {/* Related Links */}
          {currentSection.links && currentSection.links.length > 0 && (
            <div className="mt-8 pt-6 border-t border-neutral-200">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Related Pages
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentSection.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-start gap-3 p-4 rounded-lg border border-neutral-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-indigo-600">
                        {link.label}
                      </div>
                      <div className="text-sm text-neutral-500">{link.desc}</div>
                    </div>
                    <span className="text-neutral-400">→</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 pt-6 border-t border-neutral-200 flex justify-between">
            {sections.findIndex((s) => s.id === activeSection) > 0 && (
              <button
                onClick={() => {
                  const idx = sections.findIndex((s) => s.id === activeSection);
                  if (idx > 0) setActiveSection(sections[idx - 1].id);
                }}
                className="text-sm text-indigo-600 hover:underline"
              >
                ← Previous: {sections[sections.findIndex((s) => s.id === activeSection) - 1]?.title}
              </button>
            )}
            <div className="flex-1" />
            {sections.findIndex((s) => s.id === activeSection) < sections.length - 1 && (
              <button
                onClick={() => {
                  const idx = sections.findIndex((s) => s.id === activeSection);
                  if (idx < sections.length - 1) setActiveSection(sections[idx + 1].id);
                }}
                className="text-sm text-indigo-600 hover:underline"
              >
                Next: {sections[sections.findIndex((s) => s.id === activeSection) + 1]?.title} →
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Styles */}
      <style jsx global>{`
        .guide-content h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 2rem;
          margin-bottom: 1rem;
          color: #171717;
        }
        .guide-content h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: #262626;
        }
        .guide-content h4 {
          font-size: 1rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: #404040;
        }
        .guide-content p {
          margin-bottom: 1rem;
          line-height: 1.7;
        }
        .guide-content ul, .guide-content ol {
          margin-bottom: 1rem;
          padding-left: 1.5rem;
        }
        .guide-content li {
          margin-bottom: 0.5rem;
          line-height: 1.6;
        }
        .guide-content table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1.5rem;
          font-size: 0.875rem;
        }
        .guide-content th, .guide-content td {
          border: 1px solid #e5e5e5;
          padding: 0.75rem 1rem;
          text-align: left;
        }
        .guide-content th {
          background: #f5f5f5;
          font-weight: 600;
        }
        .guide-content code {
          background: #f5f5f5;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
          font-family: ui-monospace, monospace;
        }
        .guide-content .diagram {
          background: #fafafa;
          border: 1px solid #e5e5e5;
          border-radius: 0.5rem;
          padding: 1rem;
          margin-bottom: 1.5rem;
          overflow-x: auto;
        }
        .guide-content .diagram pre {
          margin: 0;
          font-family: ui-monospace, monospace;
          font-size: 0.8125rem;
          line-height: 1.5;
          white-space: pre;
        }
        .guide-content .code-block {
          background: #1e1e1e;
          border-radius: 0.5rem;
          padding: 1rem;
          margin-bottom: 1.5rem;
          overflow-x: auto;
        }
        .guide-content .code-block pre {
          margin: 0;
          font-family: ui-monospace, monospace;
          font-size: 0.8125rem;
          line-height: 1.5;
          color: #d4d4d4;
          white-space: pre;
        }
      `}</style>
    </div>
  );
}
