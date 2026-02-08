/**
 * renderPromptSummary.ts
 *
 * Renders the llmPrompt JSON into a human-readable markdown summary.
 * DETERMINISTIC - no AI calls, just data formatting.
 *
 * Replaces the AI-generated placeholder-filled summary with actual data.
 */

interface LLMPrompt {
  _preamble?: {
    systemInstruction?: string;
    voiceRules?: string[];
    criticalRules?: string[];
  };
  _quickStart?: {
    this_caller?: string;
    this_session?: string;
    you_are?: string;
    key_memory?: string;
    voice_style?: string;
    learner_goals?: string;
    curriculum_progress?: string | null;
    first_line?: string;
    critical_voice?: {
      sentences_per_turn?: string;
      max_seconds?: number;
      silence_wait?: string;
    };
  };
  caller?: {
    id?: string;
    name?: string;
    phone?: string;
    domain?: { name?: string };
  };
  domain?: {
    name?: string;
    description?: string;
  };
  identity?: {
    role?: string;
    primaryGoal?: string;
    techniques?: Array<{ name: string; description?: string; when?: string }>;
    boundaries?: { does?: string[]; doesNot?: string[] };
  };
  curriculum?: {
    name?: string;
    hasData?: boolean;
    totalModules?: number;
    completedCount?: number;
    estimatedProgress?: number;
    modules?: Array<{
      id?: string;
      name?: string;
      description?: string;
      status?: string;
      content?: any;
    }>;
    nextModule?: {
      id?: string;
      name?: string;
      description?: string;
      content?: any;
    };
  };
  memories?: {
    all?: Array<{ key: string; value: string; category: string; confidence: number }>;
    byCategory?: Record<string, Array<{ key: string; value: string; confidence: number }>>;
    totalCount?: number;
  };
  personality?: {
    traits?: Record<string, { level: string; score: number; description?: string }>;
    confidence?: number;
  };
  behaviorTargets?: {
    all?: Array<{
      name: string;
      parameterId: string;
      targetValue: number;
      targetLevel: string;
      when_high?: string | null;
      when_low?: string | null;
      scope?: string;
    }>;
  };
  learnerGoals?: {
    goals?: Array<{
      name: string;
      type?: string;
      progress?: number;
      description?: string;
    }>;
  };
  instructions?: {
    voice?: any;
    session_pedagogy?: {
      sessionType?: string;
      flow?: string[];
      principles?: string[];
    };
    personality_adaptation?: string[];
    behavior_targets_summary?: Array<{
      what: string;
      target: string;
      meaning?: string;
    }>;
  };
  callHistory?: {
    totalCalls?: number;
  };
}

/**
 * Get level label for a score
 */
function getLevel(score: number): string {
  if (score >= 0.65) return "HIGH";
  if (score <= 0.35) return "LOW";
  return "MODERATE";
}

/**
 * Format a score as percentage
 */
function pct(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * Render the llmPrompt as a human-readable markdown summary.
 */
export function renderPromptSummary(llmPrompt: LLMPrompt): string {
  const parts: string[] = [];

  // Header
  parts.push("# SESSION PROMPT\n");

  // Quick Start (most important - scan first)
  const qs = llmPrompt._quickStart;
  if (qs) {
    parts.push("## Quick Start\n");
    if (qs.this_caller) parts.push(`**Caller**: ${qs.this_caller}`);
    if (qs.this_session) parts.push(`**Session**: ${qs.this_session}`);
    if (qs.voice_style) parts.push(`**Voice**: ${qs.voice_style}`);
    if (qs.learner_goals) parts.push(`**Goals**: ${qs.learner_goals}`);
    if (qs.key_memory) parts.push(`**Key Memory**: ${qs.key_memory}`);
    if (qs.first_line) parts.push(`**Opening**: "${qs.first_line}"`);
    if (qs.critical_voice) {
      const cv = qs.critical_voice;
      parts.push(`**Voice Rules**: ${cv.sentences_per_turn || "2-3"} sentences, max ${cv.max_seconds || 15}s, silence wait ${cv.silence_wait || "3s"}`);
    }
    parts.push("");
  }

  // Session Pedagogy (the roadmap)
  const pedagogy = llmPrompt.instructions?.session_pedagogy;
  if (pedagogy) {
    parts.push("## Session Flow\n");
    parts.push(`**Type**: ${pedagogy.sessionType || "UNKNOWN"}\n`);
    if (pedagogy.flow?.length) {
      parts.push("**Steps**:");
      pedagogy.flow.forEach(step => parts.push(`- ${step}`));
    }
    if (pedagogy.principles?.length) {
      parts.push("\n**Principles**:");
      pedagogy.principles.forEach(p => parts.push(`- ${p}`));
    }
    parts.push("");
  }

  // Curriculum Progress
  const curr = llmPrompt.curriculum;
  if (curr?.hasData && curr.modules?.length) {
    parts.push("## Curriculum\n");
    parts.push(`**${curr.name || "Curriculum"}**: ${curr.completedCount || 0}/${curr.totalModules || 0} modules (${pct((curr.completedCount || 0) / (curr.totalModules || 1))})\n`);

    // Current/Next module
    const inProgress = curr.modules.find(m => m.status === "in_progress");
    const next = curr.nextModule;

    if (inProgress) {
      parts.push(`**Current**: ${inProgress.name}`);
      if (inProgress.description) parts.push(`  - ${inProgress.description}`);
    }
    if (next) {
      parts.push(`**Next**: ${next.name}`);
      if (next.description) parts.push(`  - ${next.description}`);
    }

    // Module list (condensed)
    parts.push("\n**All Modules**:");
    curr.modules.slice(0, 5).forEach(m => {
      const status = m.status === "completed" ? "✓" : m.status === "in_progress" ? "→" : "○";
      parts.push(`${status} ${m.name}`);
    });
    if (curr.modules.length > 5) {
      parts.push(`  ... and ${curr.modules.length - 5} more`);
    }
    parts.push("");
  }

  // Identity (who the agent is)
  const id = llmPrompt.identity;
  if (id) {
    parts.push("## Identity\n");
    if (id.role) parts.push(`**Role**: ${id.role.substring(0, 200)}${id.role.length > 200 ? "..." : ""}`);
    if (id.primaryGoal) parts.push(`**Goal**: ${id.primaryGoal}`);

    if (id.techniques?.length) {
      parts.push("\n**Techniques**:");
      id.techniques.slice(0, 4).forEach(t => {
        parts.push(`- **${t.name}**: ${t.description || ""}${t.when ? ` (when: ${t.when})` : ""}`);
      });
    }

    if (id.boundaries?.doesNot?.length) {
      parts.push("\n**Never**:");
      id.boundaries.doesNot.slice(0, 3).forEach(d => parts.push(`- ${d}`));
    }
    parts.push("");
  }

  // Behavior Targets (how to communicate)
  const targets = llmPrompt.behaviorTargets?.all;
  if (targets?.length) {
    parts.push("## Behavior Targets\n");

    // Group by importance (HIGH first, then with guidance)
    const highTargets = targets.filter(t => t.targetLevel === "HIGH");
    const guidedTargets = targets.filter(t => t.when_high || t.when_low);

    if (highTargets.length) {
      parts.push("**HIGH priority**:");
      highTargets.slice(0, 5).forEach(t => {
        const guidance = t.targetLevel === "HIGH" && t.when_high ? ` → ${t.when_high}` : "";
        parts.push(`- ${t.name}: ${t.targetLevel} (${pct(t.targetValue)})${guidance}`);
      });
    }

    // Summary from instructions
    const summary = llmPrompt.instructions?.behavior_targets_summary;
    if (summary?.length) {
      parts.push("\n**Summary**:");
      summary.forEach(s => {
        parts.push(`- ${s.what}: ${s.target}${s.meaning ? ` - ${s.meaning}` : ""}`);
      });
    }
    parts.push("");
  }

  // Memories (personalization)
  const mem = llmPrompt.memories;
  if (mem?.totalCount) {
    parts.push("## Memories\n");
    parts.push(`**Total**: ${mem.totalCount} memories\n`);

    // Show top memories by category
    if (mem.byCategory) {
      const categories = ["FACT", "PREFERENCE", "TOPIC", "RELATIONSHIP"];
      categories.forEach(cat => {
        const items = mem.byCategory?.[cat];
        if (items?.length) {
          parts.push(`**${cat}**:`);
          items.slice(0, 3).forEach(m => {
            parts.push(`- ${m.key}: ${m.value}`);
          });
        }
      });
    }
    parts.push("");
  }

  // Personality (adaptation)
  const pers = llmPrompt.personality;
  if (pers?.traits) {
    parts.push("## Personality Adaptation\n");
    const traits = Object.entries(pers.traits);
    traits.forEach(([name, trait]) => {
      parts.push(`- **${name}**: ${trait.level} (${pct(trait.score)})${trait.description ? ` - ${trait.description}` : ""}`);
    });

    // Personality adaptation instructions
    const adapt = llmPrompt.instructions?.personality_adaptation;
    if (adapt?.length) {
      parts.push("\n**Adaptations**:");
      adapt.forEach(a => parts.push(`- ${a}`));
    }
    parts.push("");
  }

  // Learner Goals
  const goals = llmPrompt.learnerGoals?.goals;
  if (goals?.length) {
    parts.push("## Learner Goals\n");
    goals.forEach(g => {
      const progress = g.progress !== undefined ? ` (${pct(g.progress)})` : "";
      parts.push(`- **${g.name}**${progress}${g.description ? `: ${g.description}` : ""}`);
    });
    parts.push("");
  }

  // Voice Rules (critical for real-time)
  const voice = llmPrompt.instructions?.voice;
  if (voice) {
    parts.push("## Voice Rules\n");
    if (voice.response_length) {
      parts.push(`**Response**: ${voice.response_length.target}, max ${voice.response_length.max_seconds}s`);
      if (voice.response_length.rule) parts.push(`  - ${voice.response_length.rule}`);
    }
    if (voice.natural_speech?.use_fillers) {
      parts.push(`**Fillers**: ${voice.natural_speech.use_fillers.join(", ")}`);
    }
    if (voice.natural_speech?.confirmations) {
      parts.push(`**Check-ins**: ${voice.natural_speech.confirmations.join(", ")}`);
    }
    parts.push("");
  }

  // Critical Rules (from preamble)
  const critical = llmPrompt._preamble?.criticalRules;
  if (critical?.length) {
    parts.push("## Critical Rules\n");
    critical.forEach(r => parts.push(`- ${r}`));
    parts.push("");
  }

  // Call History
  const history = llmPrompt.callHistory;
  if (history) {
    parts.push(`---\n*Call #${history.totalCalls || 1} with this caller*`);
  }

  return parts.join("\n");
}
