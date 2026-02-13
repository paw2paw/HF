/**
 * Page Documentation Registry
 *
 * This provides human-readable documentation about each page in the app,
 * so the AI assistant can explain what screens are for and how to use them.
 */

export interface PageDoc {
  path: string;
  title: string;
  description: string;
  features: string[];
  relatedPages?: string[];
}

export const PAGE_DOCS: PageDoc[] = [
  // Main Pages
  {
    path: "/x",
    title: "Dashboard",
    description: "The main landing page showing system overview, recent activity, and quick access to key features.",
    features: [
      "System health status",
      "Recent calls and callers",
      "Quick navigation cards",
    ],
  },
  {
    path: "/x/callers",
    title: "Callers",
    description: "Manage all callers (users who interact with the AI). View their profiles, personality traits, memories, and conversation history.",
    features: [
      "List all callers with search/filter",
      "View caller personality profiles (Big Five traits)",
      "See behavior targets and memories",
      "Access call history",
    ],
    relatedPages: ["/x/callers/[callerId]"],
  },
  {
    path: "/x/callers/[callerId]",
    title: "Caller Detail",
    description: "Deep dive into a single caller's profile. View their personality, memories, behavior targets, and composed prompts.",
    features: [
      "Personality tab: Big Five traits and how they affect agent behavior",
      "Memories tab: Facts, preferences, events learned from conversations",
      "Targets tab: Behavior targets (how the agent should adapt)",
      "Calls tab: Conversation history with transcripts and scores",
      "Prompt tab: View/build the personalized prompt for this caller",
    ],
    relatedPages: ["/x/callers", "/x/playground"],
  },
  {
    path: "/x/playbooks",
    title: "Playbooks",
    description: "Configure domain-specific behavior bundles. Playbooks define what specs, templates, and goals apply to a domain.",
    features: [
      "Create and edit playbooks",
      "Add specs (MEASURE, LEARN, ADAPT, COMPOSE, REWARD)",
      "Configure goals with behavior targets",
      "Publish playbooks to make them active",
    ],
    relatedPages: ["/x/specs", "/x/domains"],
  },
  {
    path: "/x/specs",
    title: "Analysis Specs",
    description: "BDD-style specifications that define how to analyze calls, learn from conversations, and adapt behavior.",
    features: [
      "MEASURE specs: Score parameters from 0-1 based on conversation evidence",
      "LEARN specs: Extract facts/memories from conversations",
      "ADAPT specs: Compute personalized behavior targets",
      "COMPOSE specs: Generate personalized prompt sections",
      "REWARD specs: Score how well the agent matched targets",
    ],
    relatedPages: ["/x/playbooks", "/x/dictionary"],
  },
  {
    path: "/x/specs/new",
    title: "New Spec Wizard",
    description: "Create a new analysis spec with AI assistance. Define what to measure or learn.",
    features: [
      "AI-assisted spec creation",
      "Choose spec type and role",
      "Define triggers (Given/When/Then)",
      "Preview and test before saving",
    ],
  },
  {
    path: "/x/domains",
    title: "Domains",
    description: "Organize callers and playbooks by domain (e.g., Tutor, Support, Sales). Each domain has its own behavior configuration.",
    features: [
      "Create domains for different use cases",
      "Assign playbooks to domains",
      "View callers per domain",
    ],
    relatedPages: ["/x/playbooks", "/x/callers"],
  },
  {
    path: "/x/dictionary",
    title: "Data Dictionary",
    description: "Browse all behavior parameters and their cross-references. See where parameters are used in specs and templates.",
    features: [
      "Search parameters by name, slug, or domain group",
      "View parameter details and anchors",
      "See cross-references: which specs and templates use each parameter",
    ],
    relatedPages: ["/x/specs", "/x/taxonomy-graph"],
  },
  {
    path: "/x/taxonomy-graph",
    title: "Taxonomy Graph",
    description: "Visual network graph showing parameters and their relationships. Identifies orphan parameters not used in any spec.",
    features: [
      "Interactive force-directed graph",
      "Color-coded by parameter type",
      "Orphan detection (unused parameters)",
    ],
  },
  {
    path: "/x/pipeline",
    title: "Pipeline",
    description: "The analysis pipeline that processes calls. Shows the flow from transcript to scores, memories, and prompt updates.",
    features: [
      "Blueprint view: See all pipeline stages",
      "Run Inspector: Debug specific pipeline runs",
      "View errors and timing for each stage",
    ],
  },
  {
    path: "/x/playground",
    title: "Playground",
    description: "Interactive testing area. Simulate calls, test prompts, and experiment with the system.",
    features: [
      "Simulate a call with a caller",
      "Test prompt composition",
      "Preview how the agent would respond",
    ],
    relatedPages: ["/x/callers/[callerId]"],
  },
  {
    path: "/x/import",
    title: "Import Specs",
    description: "Import BDD spec files (.spec.json) into the system. Validates and activates new specifications.",
    features: [
      "Drag-and-drop spec file upload",
      "JSON validation and preview",
      "Activate specs to create Parameters, AnalysisSpecs, Anchors",
    ],
  },
  {
    path: "/x/metering",
    title: "Metering",
    description: "Track AI API usage and costs. See how many tokens are used across different operations.",
    features: [
      "Usage summary by operation type",
      "Cost breakdown by AI provider",
      "Historical usage trends",
    ],
  },
  {
    path: "/x/ai-config",
    title: "AI Config",
    description: "Configure AI provider settings. Set API keys, choose default models, and manage AI connections.",
    features: [
      "Configure Anthropic and OpenAI API keys",
      "Set default model for each operation",
      "Test AI connections",
    ],
  },
  {
    path: "/x/goals",
    title: "Goals",
    description: "Define high-level goals for playbooks. Goals specify desired behavior target values.",
    features: [
      "Create named goals (e.g., 'Encouraging', 'Socratic')",
      "Set target values for behavior parameters",
      "Assign goals to playbooks",
    ],
  },
  {
    path: "/x/settings",
    title: "Settings",
    description: "Application settings and user preferences.",
    features: [
      "Theme settings",
      "User preferences",
      "System configuration",
    ],
  },
  {
    path: "/x/users",
    title: "Users",
    description: "Manage admin users who can access this application.",
    features: [
      "View all admin users",
      "Manage roles and permissions",
      "Invite new users",
    ],
  },
  {
    path: "/x/logs",
    title: "Logs",
    description: "View AI call logs and debugging information.",
    features: [
      "See all AI API calls",
      "View prompts and responses",
      "Debug issues with AI operations",
    ],
  },
  {
    path: "/x/debug",
    title: "Debug Console",
    description: "Developer debugging tools. Test API endpoints, view logs, and troubleshoot issues.",
    features: [
      "Test API endpoints directly",
      "View debug logs",
      "Paste error information for analysis",
    ],
  },
  {
    path: "/x/data-management",
    title: "Data Management",
    description: "Manage application data. Reset, seed, or clean up database records.",
    features: [
      "View database statistics",
      "Reset caller data",
      "Clean up orphan records",
    ],
  },
  {
    path: "/x/admin/spec-sync",
    title: "Spec Sync",
    description: "Synchronize specs between the database and source files. Export specs back to .spec.json files.",
    features: [
      "Compare database specs to source files",
      "Export modified specs to files",
      "Sync status overview",
    ],
  },
  {
    path: "/supervisor",
    title: "Supervisor",
    description: "High-level system overview for monitoring. See overall system health and key metrics.",
    features: [
      "System health dashboard",
      "Key metrics at a glance",
      "Quick access to common operations",
    ],
  },
];

/**
 * Get documentation for a specific page path
 */
export function getPageDoc(path: string): PageDoc | undefined {
  // Try exact match first
  const exact = PAGE_DOCS.find((p) => p.path === path);
  if (exact) return exact;

  // Try pattern match (for dynamic routes like /x/callers/[callerId])
  const normalized = path.replace(/\/[a-f0-9-]{36}/g, "/[id]").replace(/\/[^/]+$/, "/[callerId]");
  return PAGE_DOCS.find((p) => p.path === normalized);
}

/**
 * Get all page docs as a formatted string for AI context
 */
export function getPageDocsForAI(): string {
  const parts = ["## Available Pages\n"];

  for (const doc of PAGE_DOCS) {
    parts.push(`### ${doc.title} (${doc.path})`);
    parts.push(doc.description);
    if (doc.features.length > 0) {
      parts.push("Features:");
      for (const f of doc.features) {
        parts.push(`- ${f}`);
      }
    }
    parts.push("");
  }

  return parts.join("\n");
}

/**
 * Get a concise summary of pages for AI context (shorter version)
 */
export function getPageDocsSummary(): string {
  const parts = ["## App Pages Quick Reference\n"];

  // Group by category
  const categories: Record<string, PageDoc[]> = {
    "Core": PAGE_DOCS.filter((p) => ["/x", "/x/callers", "/x/playbooks", "/x/specs", "/x/domains"].includes(p.path)),
    "Data": PAGE_DOCS.filter((p) => ["/x/dictionary", "/x/taxonomy-graph"].includes(p.path)),
    "Tools": PAGE_DOCS.filter((p) => ["/x/pipeline", "/x/playground", "/x/import"].includes(p.path)),
    "Admin": PAGE_DOCS.filter((p) => ["/x/ai-config", "/x/settings", "/x/users", "/x/logs", "/x/debug", "/x/metering"].includes(p.path)),
  };

  for (const [cat, pages] of Object.entries(categories)) {
    if (pages.length === 0) continue;
    parts.push(`**${cat}:**`);
    for (const p of pages) {
      parts.push(`- **${p.title}** (${p.path}): ${p.description.split(".")[0]}`);
    }
    parts.push("");
  }

  return parts.join("\n");
}
