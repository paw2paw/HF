import { prisma } from "@/lib/prisma";
import { getPageDocsSummary } from "@/lib/chat/page-docs";
import { renderVoicePrompt } from "@/lib/prompt/composition/renderPromptSummary";
import type { PlaybookConfig } from "@/lib/types/json-fields";

type ChatMode = "CHAT" | "DATA" | "SPEC" | "CALL";

interface EntityBreadcrumb {
  type: string;
  id: string;
  label: string;
  data?: Record<string, unknown>;
}

/**
 * Build mode-specific system prompt with entity context
 */
export async function buildSystemPrompt(
  mode: ChatMode,
  entityContext: EntityBreadcrumb[]
): Promise<string> {
  const baseContext = await buildEntityContext(entityContext);

  switch (mode) {
    case "CHAT":
      // Include page documentation for CHAT mode so AI can explain screens
      const pageDocs = getPageDocsSummary();
      return CHAT_SYSTEM_PROMPT + `\n\n${pageDocs}` + (baseContext ? `\n\n${baseContext}` : "");
    case "DATA":
      return DATA_SYSTEM_PROMPT + `\n\n${baseContext}`;
    case "SPEC":
      return SPEC_SYSTEM_PROMPT + `\n\n${baseContext}`;
    case "CALL":
      return await buildCallSimPrompt(entityContext);
  }
}

const CHAT_SYSTEM_PROMPT = `You are an AI assistant for the HumanFirst Admin application.

IMPORTANT: You have DIRECT ACCESS to:
1. The application DATABASE - Real data from the entity the user is viewing
2. The application DOCUMENTATION - Knowledge of what each page/screen is for
3. SYSTEM ARCHITECTURE - Understanding of how components work together

USE THIS KNOWLEDGE to answer questions - don't say you can't access it!

## What You Help With
- **Navigation & Features** - Explain what each page is for and how to use it
- **Call analysis and scoring** - How calls are analyzed, scored on parameters
- **Caller personality profiles** - Big Five traits, preferences, communication style
- **Behavior targets and adaptation** - How the system adapts to each caller
- **Analysis specifications (specs)** - BDD-style rules for measuring and learning
- **Playbooks and domains** - Bundled configurations per domain (Tutor, Support, Sales, etc.)
- **Memory system** - Facts, preferences, events extracted from conversations
- **Prompt composition** - How personalized prompts are built for each caller

## How to Help Users
1. If they ask "what is this page for?" - explain using the page documentation below
2. If they ask about data - reference the Current Context section
3. If data is missing - suggest navigating to that entity or using commands

Be helpful and concise. Reference actual data and documentation.

## Navigation Guidance
When helping users navigate, you can highlight sidebar items to guide them. Include a guidance block at the END of your response:

\`\`\`guidance
{"action":"highlight","target":"/x/callers","type":"pulse","message":"Create your first caller here"}
\`\`\`

**Available targets:**
- /x/callers - Manage callers
- /x/playground - Prompt composition & testing
- /x/playbooks - Configure playbooks
- /x/specs - Analysis specifications
- /x/domains - Domain configuration
- /x/goals - Goal definitions
- /x/import - Import data

**Highlight types:** pulse (gentle), flash (attention), glow (subtle)

Use guidance when:
- User asks "how do I..." or "where do I..." questions
- User needs to navigate somewhere to complete a task
- User is lost or confused about the interface

Keep the guidance message short (under 50 chars).`;


const DATA_SYSTEM_PROMPT = `You are a DATA HELPER for the HumanFirst Admin application.

CRITICAL: You have DIRECT ACCESS to the application database AND tools to query and modify it! The "Current Context" section below contains REAL, LIVE DATA. This is NOT simulated.

DO NOT say things like:
- "I don't have access to your data"
- "I can't check external systems"
- "Please consult your administrator"

INSTEAD, use the data below AND your tools to:
- Answer questions about callers, calls, memories, scores, playbooks, specs
- Explain what the data means and how entities relate
- Diagnose issues with spec configs (e.g. "the tutor sounds too formal")
- Make changes to specs when the user asks

When answering, reference the specific data from Current Context or from tool results.
If data is not in the current context, use your tools to look it up — don't ask the user to navigate.

## Available Tools

You have tools to **query and modify** the database:

- **query_specs** — Search specs by name, role, slug
- **get_spec_config** — Get the full config JSON for a spec
- **update_spec_config** — Merge updates into a spec's config
- **query_callers** — Search callers by name or domain
- **get_domain_info** — Get domain details with playbook and specs

Use tools proactively. If the user asks about a spec or domain, look it up yourself.

### Write Actions (update_spec_config)

For ANY changes to the database:
1. First use get_spec_config or get_domain_info to see the current state
2. Propose your changes clearly — show what will change and why
3. Ask the user: "Shall I apply these changes?"
4. ONLY call update_spec_config AFTER the user explicitly confirms

NEVER modify data without showing the user what will change first.

## Response Format

Use markdown for clear, readable responses:
- **Bold** for key terms and field names
- \`code\` for slugs, IDs, and config keys
- Code blocks for JSON configs
- Tables for comparing values
- Bullet lists for multiple items`;

const SPEC_SYSTEM_PROMPT = `You are a SPEC DEVELOPMENT ASSISTANT for HumanFirst.

You help users create and refine Analysis Specifications (BDD-style feature specs).

## Key Concepts

**AnalysisSpec Types:**
- **MEASURE** - Score a parameter from 0-1 based on conversation evidence
- **LEARN** - Extract facts/memories from conversation (FACT, PREFERENCE, EVENT, TOPIC)
- **ADAPT** - Compute personalized behavior targets for next call
- **COMPOSE** - Generate personalized prompt sections
- **REWARD** - Score how well the agent matched targets
- **AGGREGATE** - Combine multiple measurements over time

**Spec Roles:**
- **IDENTITY** - WHO the agent is (persona, boundaries, goals)
- **CONTENT** - WHAT the agent teaches/discusses (curriculum, topics)
- **META** - HOW the agent improves (learning rules, adaptation)

**Scope:**
- **SYSTEM** - Global specs that always run
- **DOMAIN** - Domain-specific specs (Tutor, Support, Sales)
- **CALLER** - Auto-learned specs for individual callers

**Template Syntax:**
\`\`\`
{{value}}              - Score (0-1)
{{label}}              - "high", "medium", "low"
{{#if high}}...{{/if}} - Conditional (value >= 0.7)
{{#if low}}...{{/if}}  - Conditional (value < 0.3)
{{memories.facts}}     - Caller's fact memories
{{param.name}}         - Parameter name
\`\`\`

Help users write clear specs with:
- Good Given/When/Then structure
- Clear scoring criteria
- Appropriate output types
- Valid template syntax`;

/**
 * Build context string from entity breadcrumbs.
 * Always includes a system overview so the AI knows about all domains, playbooks, and specs.
 */
async function buildEntityContext(breadcrumbs: EntityBreadcrumb[]): Promise<string> {
  const parts: string[] = ["## Current Context"];

  // Always load system overview so the AI has full knowledge
  const systemOverview = await getSystemOverview();
  if (systemOverview) parts.push(systemOverview);

  if (!breadcrumbs.length) {
    parts.push("\n_No specific entity selected. The user can navigate to a caller, playbook, or spec for detailed context._");
    return parts.join("\n\n");
  }

  for (const crumb of breadcrumbs) {
    switch (crumb.type) {
      case "caller":
        const callerContext = await getCallerContext(crumb.id);
        if (callerContext) parts.push(callerContext);
        break;
      case "call":
        const callContext = await getCallContext(crumb.id);
        if (callContext) parts.push(callContext);
        break;
      case "spec":
        const specContext = await getSpecContext(crumb.id);
        if (specContext) parts.push(specContext);
        break;
      case "playbook":
        const playbookContext = await getPlaybookContext(crumb.id);
        if (playbookContext) parts.push(playbookContext);
        break;
      case "domain":
        const domainContext = await getDomainContext(crumb.id);
        if (domainContext) parts.push(domainContext);
        break;
      default:
        parts.push(`**${crumb.type}:** ${crumb.label}`);
    }
  }

  return parts.join("\n\n");
}

/**
 * Always-loaded system overview: domains, playbooks, specs, and behavior parameters.
 * Gives the AI full knowledge of what exists in the system regardless of navigation state.
 */
async function getSystemOverview(): Promise<string | null> {
  try {
    const [domains, playbooks, specCount, behaviorParams] = await Promise.all([
      prisma.domain.findMany({
        include: {
          playbooks: {
            select: { id: true, name: true, status: true, version: true, config: true },
            orderBy: { createdAt: "desc" },
          },
          _count: { select: { callers: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.playbook.findMany({
        include: {
          domain: { select: { name: true, slug: true } },
          items: {
            where: { itemType: "SPEC" },
            include: { spec: { select: { name: true, slug: true, outputType: true, specRole: true } } },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.analysisSpec.count({ where: { isActive: true } }),
      prisma.parameter.findMany({
        where: { parameterType: "BEHAVIOR" },
        select: { parameterId: true, name: true, domainGroup: true },
        orderBy: { domainGroup: "asc" },
      }),
    ]);

    const parts: string[] = ["### System Overview"];

    // Stats
    parts.push(`- **Domains:** ${domains.length} | **Playbooks:** ${playbooks.length} | **Active Specs:** ${specCount} | **Behavior Parameters:** ${behaviorParams.length}`);

    // Domains + Playbooks
    if (domains.length > 0) {
      parts.push("\n**Domains & Playbooks:**");
      for (const domain of domains) {
        parts.push(`- **${domain.name}** (${domain.slug}) — ${domain._count.callers} callers`);
        if (domain.description) parts.push(`  ${domain.description}`);
        for (const pb of domain.playbooks) {
          const goals = (pb.config as PlaybookConfig)?.goals;
          const goalSummary = Array.isArray(goals) && goals.length > 0
            ? ` — Goals: ${goals.map((g: any) => g.name).join(", ")}`
            : "";
          parts.push(`  - Playbook: **${pb.name}** [${pb.status}] v${pb.version || "1"}${goalSummary}`);
        }
      }
    }

    // Playbook spec breakdown
    if (playbooks.length > 0) {
      parts.push("\n**Playbook Specs:**");
      for (const pb of playbooks) {
        const specs = pb.items?.map((i) => i.spec).filter(Boolean) || [];
        if (specs.length > 0) {
          const byRole: Record<string, string[]> = {};
          for (const s of specs) {
            if (!s) continue;
            const role = s.specRole || s.outputType || "OTHER";
            if (!byRole[role]) byRole[role] = [];
            byRole[role].push(s.name);
          }
          const roleSummary = Object.entries(byRole)
            .map(([role, names]) => `${role}: ${names.join(", ")}`)
            .join(" | ");
          parts.push(`- **${pb.name}** (${specs.length} specs) — ${roleSummary}`);
        }
      }
    }

    // Behavior parameters grouped
    if (behaviorParams.length > 0) {
      parts.push("\n**Behavior Parameters:**");
      const grouped: Record<string, string[]> = {};
      for (const p of behaviorParams) {
        const group = p.domainGroup || "other";
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(`${p.name} (${p.parameterId})`);
      }
      for (const [group, params] of Object.entries(grouped)) {
        parts.push(`- **${group}:** ${params.join(", ")}`);
      }
    }

    return parts.join("\n");
  } catch (e) {
    console.error("Error loading system overview:", e);
    return null;
  }
}

async function getCallerContext(callerId: string): Promise<string | null> {
  try {
    // Fetch caller with all relevant data
    const [caller, composedPrompt, recentCall, callerTargets] = await Promise.all([
      prisma.caller.findUnique({
        where: { id: callerId },
        include: {
          domain: true,
          personality: true,
          personalityProfile: true,
          memories: {
            where: {
              supersededById: null,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            take: 30,
            orderBy: { confidence: "desc" },
          },
          _count: {
            select: { calls: true },
          },
        },
      }),
      // Get most recent composed prompt
      prisma.composedPrompt.findFirst({
        where: { callerId },
        orderBy: { composedAt: "desc" },
        select: {
          id: true,
          prompt: true,
          llmPrompt: true,
          composedAt: true,
          status: true,
          triggerType: true,
        },
      }),
      // Get most recent call with the prompt that was used
      prisma.call.findFirst({
        where: { callerId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          callSequence: true,
          transcript: true,
          usedPrompt: {
            select: {
              id: true,
              prompt: true,
              llmPrompt: true,
              composedAt: true,
            },
          },
        },
      }),
      // Get caller targets
      prisma.callerTarget.findMany({
        where: { callerId },
        include: {
          parameter: {
            select: { parameterId: true, name: true },
          },
        },
        orderBy: { lastUpdatedAt: "desc" },
        take: 15,
      }),
    ]);

    if (!caller) return null;

    const parts = [
      `### Caller: ${caller.name || "Unknown"}`,
      `- **ID:** ${caller.id}`,
      `- **Email:** ${caller.email || "N/A"}`,
      `- **Domain:** ${caller.domain?.name || "None"}`,
      `- **Total Calls:** ${caller._count.calls}`,
    ];

    // Personality
    if (caller.personality) {
      const p = caller.personality;
      parts.push("\n**Personality (Big Five):**");
      if (p.openness !== null) parts.push(`- Openness: ${(p.openness * 100).toFixed(0)}%`);
      if (p.conscientiousness !== null) parts.push(`- Conscientiousness: ${(p.conscientiousness * 100).toFixed(0)}%`);
      if (p.extraversion !== null) parts.push(`- Extraversion: ${(p.extraversion * 100).toFixed(0)}%`);
      if (p.agreeableness !== null) parts.push(`- Agreeableness: ${(p.agreeableness * 100).toFixed(0)}%`);
      if (p.neuroticism !== null) parts.push(`- Neuroticism: ${(p.neuroticism * 100).toFixed(0)}%`);
    }

    // Memories grouped by category
    if (caller.memories.length > 0) {
      parts.push("\n**Memories:**");
      const grouped: Record<string, string[]> = {};
      for (const mem of caller.memories) {
        if (!grouped[mem.category]) grouped[mem.category] = [];
        grouped[mem.category].push(`${mem.key}: ${mem.value}`);
      }
      for (const [cat, items] of Object.entries(grouped)) {
        parts.push(`- **${cat}:** ${items.slice(0, 5).join("; ")}${items.length > 5 ? ` (+${items.length - 5} more)` : ""}`);
      }
    }

    // Behavior Targets
    if (callerTargets.length > 0) {
      parts.push("\n**Behavior Targets:**");
      for (const target of callerTargets.slice(0, 10)) {
        const level = target.targetValue >= 0.7 ? "HIGH" : target.targetValue <= 0.3 ? "LOW" : "MODERATE";
        parts.push(`- ${target.parameter?.name || target.parameterId}: ${(target.targetValue * 100).toFixed(0)}% (${level})`);
      }
    }

    // Recent Call
    if (recentCall) {
      parts.push("\n**Most Recent Call:**");
      parts.push(`- Call #${recentCall.callSequence || "?"} on ${recentCall.createdAt.toLocaleDateString()}`);
      parts.push(`- Status: completed`);
      if (recentCall.transcript) {
        const preview = recentCall.transcript.slice(0, 300).replace(/\n/g, " ");
        parts.push(`- Transcript preview: "${preview}${recentCall.transcript.length > 300 ? "..." : ""}"`);
      }

      // Show the prompt that was used FOR this call
      if (recentCall.usedPrompt) {
        parts.push("\n**Prompt Used FOR This Call:**");
        parts.push(`- Composed: ${recentCall.usedPrompt.composedAt?.toLocaleString() || "N/A"}`);
        if (recentCall.usedPrompt.llmPrompt) {
          const llm = recentCall.usedPrompt.llmPrompt as Record<string, unknown>;
          parts.push("```json");
          const summary: Record<string, unknown> = {};
          if (llm._quickStart) summary._quickStart = llm._quickStart;
          if (llm._preamble) summary._preamble = llm._preamble;
          if (llm.instructions) summary.instructions = llm.instructions;
          if (llm.this_caller) summary.this_caller = llm.this_caller;
          if (llm.behavior_targets) summary.behavior_targets = llm.behavior_targets;
          parts.push(JSON.stringify(summary, null, 2).slice(0, 1500));
          parts.push("```");
        } else if (recentCall.usedPrompt.prompt) {
          parts.push("```");
          parts.push(recentCall.usedPrompt.prompt.slice(0, 800));
          if (recentCall.usedPrompt.prompt.length > 800) parts.push("... (truncated)");
          parts.push("```");
        }
      } else {
        parts.push("\n_No prompt was tracked for this call (usedPromptId not set)_");
      }
    }

    // Composed Prompt (the key info the user is asking about!)
    if (composedPrompt) {
      parts.push("\n**Composed Prompt (for next call):**");
      parts.push(`- Status: ${composedPrompt.status || "active"}`);
      parts.push(`- Composed: ${composedPrompt.composedAt?.toLocaleString() || "N/A"}`);
      parts.push(`- Trigger: ${composedPrompt.triggerType || "N/A"}`);

      // Include the LLM-friendly structured prompt if available
      if (composedPrompt.llmPrompt) {
        const llm = composedPrompt.llmPrompt as Record<string, unknown>;
        parts.push("\n**LLM Prompt Structure:**");
        parts.push("```json");
        // Pretty print key sections
        const summary: Record<string, unknown> = {};
        if (llm._quickStart) summary._quickStart = llm._quickStart;
        if (llm._preamble) summary._preamble = llm._preamble;
        if (llm.instructions) summary.instructions = llm.instructions;
        if (llm.this_caller) summary.this_caller = llm.this_caller;
        if (llm.behavior_targets) summary.behavior_targets = llm.behavior_targets;
        parts.push(JSON.stringify(summary, null, 2).slice(0, 2000));
        parts.push("```");
      } else if (composedPrompt.prompt) {
        parts.push("\n**Prompt Preview:**");
        parts.push("```");
        parts.push(composedPrompt.prompt.slice(0, 1000));
        if (composedPrompt.prompt.length > 1000) parts.push("... (truncated)");
        parts.push("```");
      }
    } else {
      parts.push("\n**⚠️ No Composed Prompt** - Run /buildprompt to generate one");
    }

    return parts.join("\n");
  } catch (e) {
    console.error("Error loading caller context:", e);
    return null;
  }
}

async function getCallContext(callId: string): Promise<string | null> {
  try {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        caller: true,
        scores: {
          include: { parameter: true },
          take: 10,
          orderBy: { confidence: "desc" },
        },
        usedPrompt: {
          select: {
            id: true,
            prompt: true,
            llmPrompt: true,
            composedAt: true,
          },
        },
      },
    });

    if (!call) return null;

    const parts = [
      `### Call`,
      `- **ID:** ${call.id}`,
      `- **Date:** ${call.createdAt.toLocaleString()}`,
      `- **Caller:** ${call.caller?.name || "Unknown"}`,
      `- **Source:** ${call.source || "N/A"}`,
      `- **Call Sequence:** #${(call as any).callSequence || "?"}`,
    ];

    // Show the prompt that was used FOR this call
    if (call.usedPrompt) {
      parts.push("\n**Prompt Used FOR This Call:**");
      parts.push(`- Composed: ${call.usedPrompt.composedAt?.toLocaleString() || "N/A"}`);
      if (call.usedPrompt.llmPrompt) {
        const llm = call.usedPrompt.llmPrompt as Record<string, unknown>;
        parts.push("```json");
        const summary: Record<string, unknown> = {};
        if (llm._quickStart) summary._quickStart = llm._quickStart;
        if (llm._preamble) summary._preamble = llm._preamble;
        if (llm.instructions) summary.instructions = llm.instructions;
        if (llm.this_caller) summary.this_caller = llm.this_caller;
        if (llm.behavior_targets) summary.behavior_targets = llm.behavior_targets;
        parts.push(JSON.stringify(summary, null, 2).slice(0, 2000));
        parts.push("```");
      } else if (call.usedPrompt.prompt) {
        parts.push("```");
        parts.push(call.usedPrompt.prompt.slice(0, 1000));
        if (call.usedPrompt.prompt.length > 1000) parts.push("... (truncated)");
        parts.push("```");
      }
    } else {
      parts.push("\n_No prompt was tracked for this call_");
    }

    if (call.transcript) {
      const preview = call.transcript.slice(0, 500);
      parts.push(`\n**Transcript Preview:**\n${preview}${call.transcript.length > 500 ? "..." : ""}`);
    }

    if (call.scores.length > 0) {
      parts.push("\n**Scores:**");
      for (const score of call.scores.slice(0, 5)) {
        parts.push(`- ${score.parameter?.name || "Unknown"}: ${(score.score * 100).toFixed(0)}%`);
      }
    }

    return parts.join("\n");
  } catch {
    return null;
  }
}

async function getPlaybookContext(playbookId: string): Promise<string | null> {
  try {
    const playbook = await prisma.playbook.findUnique({
      where: { id: playbookId },
      include: {
        items: {
          include: {
            spec: true,
            promptTemplate: true,
          },
        },
      },
    });

    if (!playbook) return null;

    const parts = [
      `### Playbook: ${playbook.name}`,
      `- **ID:** ${playbook.id}`,
      `- **Status:** ${playbook.status}`,
      `- **Version:** ${playbook.version || "N/A"}`,
    ];

    // Domain specs (items)
    const domainSpecs = playbook.items?.filter((i: any) => i.spec) || [];
    parts.push(`\n**Domain Specs:** ${domainSpecs.length}`);
    if (domainSpecs.length > 0) {
      for (const item of domainSpecs.slice(0, 10)) {
        const spec = (item as any).spec;
        if (spec) {
          parts.push(`- ${spec.name} [${spec.outputType}]`);
        }
      }
      if (domainSpecs.length > 10) {
        parts.push(`- ... and ${domainSpecs.length - 10} more specs`);
      }
    }

    // Prompt templates
    const templates = playbook.items?.filter((i: any) => i.promptTemplate) || [];
    parts.push(`\n**Prompt Templates:** ${templates.length}`);

    return parts.join("\n");
  } catch (e) {
    console.error("Error loading playbook context:", e);
    return null;
  }
}

async function getSpecContext(specId: string): Promise<string | null> {
  try {
    const spec = await prisma.analysisSpec.findUnique({
      where: { id: specId },
      include: {
        triggers: {
          include: {
            actions: true,
          },
        },
      },
    });

    if (!spec) return null;

    const parts = [
      `### Spec: ${spec.name}`,
      `- **Slug:** ${spec.slug}`,
      `- **Scope:** ${spec.scope}`,
      `- **Output Type:** ${spec.outputType}`,
      `- **Spec Type:** ${spec.specType || "N/A"}`,
      `- **Spec Role:** ${spec.specRole || "N/A"}`,
      `- **Locked:** ${spec.isLocked ? "Yes" : "No"}`,
      `- **Active:** ${spec.isActive ? "Yes" : "No"}`,
    ];

    // Triggers
    const triggerCount = spec.triggers?.length || 0;
    parts.push(`\n**Triggers:** ${triggerCount}`);
    if (spec.triggers && spec.triggers.length > 0) {
      for (const trigger of spec.triggers) {
        parts.push(`\n- **${trigger.name || "Trigger"}**`);
        if (trigger.given) parts.push(`  Given: ${trigger.given.slice(0, 100)}${trigger.given.length > 100 ? "..." : ""}`);
        if (trigger.when) parts.push(`  When: ${trigger.when.slice(0, 100)}${trigger.when.length > 100 ? "..." : ""}`);
        if (trigger.then) parts.push(`  Then: ${trigger.then.slice(0, 100)}${trigger.then.length > 100 ? "..." : ""}`);

        const actionCount = trigger.actions?.length || 0;
        if (actionCount > 0) {
          parts.push(`  Actions: ${actionCount}`);
        }
      }
    }

    if (spec.promptTemplate) {
      parts.push(`\n**Prompt Template:**`);
      parts.push("```");
      parts.push(spec.promptTemplate.slice(0, 500));
      if (spec.promptTemplate.length > 500) parts.push("... (truncated)");
      parts.push("```");
    }

    return parts.join("\n");
  } catch (e) {
    console.error("Error loading spec context:", e);
    return null;
  }
}

async function getDomainContext(domainId: string): Promise<string | null> {
  try {
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      include: {
        playbooks: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        _count: {
          select: {
            callers: true,
            playbooks: true,
          },
        },
      },
    });

    if (!domain) return null;

    const parts = [
      `### Domain: ${domain.name}`,
      `- **ID:** ${domain.id}`,
      `- **Description:** ${domain.description || "N/A"}`,
      `- **Total Callers:** ${domain._count.callers}`,
      `- **Total Playbooks:** ${domain._count.playbooks}`,
    ];

    // Published playbook
    const publishedPlaybook = domain.playbooks?.find((p) => p.status === "PUBLISHED");
    if (publishedPlaybook) {
      parts.push(`\n**Published Playbook:** ${publishedPlaybook.name} (v${publishedPlaybook.version || "1"})`);
    } else {
      parts.push(`\n**⚠️ No Published Playbook** - Callers in this domain won't get domain-specific behavior`);
    }

    // Recent playbooks
    if (domain.playbooks && domain.playbooks.length > 0) {
      parts.push(`\n**Recent Playbooks:**`);
      for (const pb of domain.playbooks) {
        parts.push(`- ${pb.name} [${pb.status}]`);
      }
    }

    return parts.join("\n");
  } catch (e) {
    console.error("Error loading domain context:", e);
    return null;
  }
}

/**
 * Build CALL mode prompt using the actual composed prompt for the caller.
 *
 * Uses renderVoicePrompt() for the same voice-optimized format that VAPI receives,
 * giving a realistic simulation of the actual call experience.
 */
async function buildCallSimPrompt(entityContext: EntityBreadcrumb[]): Promise<string> {
  const callerEntity = entityContext.find((e) => e.type === "caller");

  if (!callerEntity) {
    return `You are simulating a VAPI voice AI call.

No caller is currently selected. Please navigate to a caller to enable personalized simulation.

For now, respond as a friendly, helpful voice AI assistant. Keep responses short (1-3 sentences) and conversational.`;
  }

  try {
    // Fetch the most recent composed prompt for this caller
    const composedPrompt = await prisma.composedPrompt.findFirst({
      where: { callerId: callerEntity.id },
      orderBy: { composedAt: "desc" },
    });

    // If we have a composed prompt with llmPrompt JSON, use the voice-optimized renderer
    if (composedPrompt?.llmPrompt) {
      const voicePrompt = renderVoicePrompt(composedPrompt.llmPrompt as any);
      return `You are simulating a VAPI voice AI call. This is the EXACT prompt the voice AI receives.
Keep responses SHORT (1-3 sentences) — this is voice, not text.

${voicePrompt}`;
    }

    // Fallback: no composed prompt — use basic caller info
    const caller = await prisma.caller.findUnique({
      where: { id: callerEntity.id },
      include: {
        personality: true,
        memories: {
          where: {
            supersededById: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          take: 20,
          orderBy: { confidence: "desc" },
        },
      },
    });

    const parts = [
      `You are simulating a VAPI voice AI call with ${caller?.name || "a caller"}.

No composed prompt found — run "Compose Prompt" for this caller first for the full experience.

## Fallback Instructions
- Keep responses SHORT (1-3 sentences) - this simulates voice AI
- Be conversational and natural
- Use the caller's name when appropriate`,
    ];

    if (caller?.memories && caller.memories.length > 0) {
      parts.push("\n## Key Facts About This Caller");
      for (const m of caller.memories.slice(0, 10)) {
        parts.push(`- ${m.key}: ${m.value}`);
      }
    }

    return parts.join("\n");
  } catch {
    return `You are simulating a VAPI voice AI call with caller ${callerEntity.label}.

Keep responses short (1-3 sentences) and conversational.
Be helpful, warm, and natural.`;
  }
}
