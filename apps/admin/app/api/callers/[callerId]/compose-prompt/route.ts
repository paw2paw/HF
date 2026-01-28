import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAICompletion, AIEngine, getDefaultEngine } from "@/lib/ai/client";
import { renderTemplate } from "@/lib/prompt/PromptTemplateCompiler";

export const runtime = "nodejs";

/**
 * POST /api/callers/[callerId]/compose-prompt
 *
 * Compose a personalized next-call prompt for a caller using AI.
 * Gathers all available context (memories, personality, recent calls, behavior targets)
 * and sends to AI to generate a tailored agent guidance prompt.
 *
 * Request body:
 * - engine?: "mock" | "claude" | "openai" - AI engine to use (default: first available)
 * - triggerType?: string - What triggered this composition (default: "manual")
 * - triggerCallId?: string - Optional call ID that triggered this
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callerId: string }> }
) {
  try {
    const { callerId } = await params;
    const body = await request.json();
    const {
      engine = getDefaultEngine(),
      triggerType = "manual",
      triggerCallId,
    } = body;

    // Load COMPOSE spec config - specifically look for the system compose spec
    // (not the prompt-slugs which also have outputType COMPOSE)
    const composeSpec = await prisma.analysisSpec.findFirst({
      where: {
        slug: "system-compose-next-prompt",
        isActive: true,
      },
    }) || await prisma.analysisSpec.findFirst({
      where: {
        outputType: "COMPOSE",
        isActive: true,
        scope: "SYSTEM",
        domain: { not: "prompt-slugs" },
      },
    });

    // Extract config with defaults
    const config = (composeSpec?.config as any) || {};
    const thresholds = config.thresholds || { high: 0.7, low: 0.3 };
    const memoriesLimit = config.memoriesLimit || 50;
    const memoriesPerCategory = config.memoriesPerCategory || 5;
    const recentCallsLimit = config.recentCallsLimit || 5;
    const maxTokens = config.maxTokens || 1500;
    const temperature = config.temperature || 0.7;
    const includePersonality = config.includePersonality !== false;
    const includeMemories = config.includeMemories !== false;
    const includeBehaviorTargets = config.includeBehaviorTargets !== false;
    const includeRecentCalls = config.includeRecentCalls !== false;

    // Use promptTemplate from spec if available, otherwise use default
    const promptTemplate = composeSpec?.promptTemplate || null;

    // Fetch caller with all relevant context
    const [caller, memories, personality, recentCalls, behaviorTargets] = await Promise.all([
      prisma.caller.findUnique({
        where: { id: callerId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          externalId: true,
        },
      }),

      // Active memories (limit from spec config)
      prisma.callerMemory.findMany({
        where: {
          callerId,
          supersededById: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: [{ category: "asc" }, { confidence: "desc" }],
        take: memoriesLimit,
        select: {
          category: true,
          key: true,
          value: true,
          confidence: true,
          evidence: true,
        },
      }),

      // Personality profile
      prisma.callerPersonality.findUnique({
        where: { callerId },
        select: {
          openness: true,
          conscientiousness: true,
          extraversion: true,
          agreeableness: true,
          neuroticism: true,
          preferredTone: true,
          preferredLength: true,
          technicalLevel: true,
          confidenceScore: true,
        },
      }),

      // Recent calls for context (limit from spec config)
      prisma.call.findMany({
        where: { callerId },
        orderBy: { createdAt: "desc" },
        take: recentCallsLimit,
        select: {
          id: true,
          transcript: true,
          createdAt: true,
          scores: {
            select: {
              parameterId: true,
              score: true,
              parameter: { select: { name: true } },
            },
          },
        },
      }),

      // Behavior targets (system-level for now)
      prisma.behaviorTarget.findMany({
        where: {
          scope: "SYSTEM",
          effectiveUntil: null,
        },
        include: {
          parameter: {
            select: {
              name: true,
              interpretationLow: true,
              interpretationHigh: true,
              domainGroup: true, // For data-driven grouping fallback
            },
          },
        },
      }),
    ]);

    if (!caller) {
      return NextResponse.json(
        { ok: false, error: "Caller not found" },
        { status: 404 }
      );
    }

    // Helper function to convert score to level using spec thresholds
    const scoreToLevel = (score: number): string => {
      if (score >= thresholds.high) return "high";
      if (score <= thresholds.low) return "low";
      return "moderate";
    };

    // Build context for AI (respecting spec config for what to include)
    const contextParts: string[] = [];

    // Caller identification (always included)
    contextParts.push("## Caller Information");
    if (caller.name) contextParts.push(`- Name: ${caller.name}`);
    if (caller.email) contextParts.push(`- Email: ${caller.email}`);
    if (caller.phone) contextParts.push(`- Phone: ${caller.phone}`);

    // Personality profile (if enabled in spec)
    if (includePersonality && personality) {
      contextParts.push("\n## Personality Profile");
      if (personality.openness !== null) {
        contextParts.push(`- Openness: ${scoreToLevel(personality.openness)} (${(personality.openness * 100).toFixed(0)}%)`);
      }
      if (personality.conscientiousness !== null) {
        contextParts.push(`- Conscientiousness: ${scoreToLevel(personality.conscientiousness)} (${(personality.conscientiousness * 100).toFixed(0)}%)`);
      }
      if (personality.extraversion !== null) {
        contextParts.push(`- Extraversion: ${scoreToLevel(personality.extraversion)} (${(personality.extraversion * 100).toFixed(0)}%)`);
      }
      if (personality.agreeableness !== null) {
        contextParts.push(`- Agreeableness: ${scoreToLevel(personality.agreeableness)} (${(personality.agreeableness * 100).toFixed(0)}%)`);
      }
      if (personality.neuroticism !== null) {
        contextParts.push(`- Neuroticism: ${scoreToLevel(personality.neuroticism)} (${(personality.neuroticism * 100).toFixed(0)}%)`);
      }
      if (personality.preferredTone) contextParts.push(`- Preferred Tone: ${personality.preferredTone}`);
      if (personality.preferredLength) contextParts.push(`- Preferred Response Length: ${personality.preferredLength}`);
      if (personality.technicalLevel) contextParts.push(`- Technical Level: ${personality.technicalLevel}`);
    }

    // Memories (if enabled in spec)
    if (includeMemories && memories.length > 0) {
      contextParts.push("\n## Key Memories");
      const memsByCategory = memories.reduce((acc, m) => {
        if (!acc[m.category]) acc[m.category] = [];
        acc[m.category].push(m);
        return acc;
      }, {} as Record<string, typeof memories>);

      for (const [category, mems] of Object.entries(memsByCategory)) {
        contextParts.push(`\n### ${category}`);
        for (const m of mems.slice(0, memoriesPerCategory)) {
          contextParts.push(`- ${m.key}: ${m.value}`);
        }
      }
    }

    // Behavior targets (if enabled in spec)
    if (includeBehaviorTargets && behaviorTargets.length > 0) {
      contextParts.push("\n## Agent Behavior Targets");
      for (const target of behaviorTargets) {
        contextParts.push(`- ${target.parameter?.name || target.parameterId}: ${scoreToLevel(target.targetValue)} (${(target.targetValue * 100).toFixed(0)}%)`);
      }
    }

    // Recent call summaries (if enabled in spec)
    if (includeRecentCalls && recentCalls.length > 0) {
      contextParts.push("\n## Recent Interaction Summary");
      contextParts.push(`${recentCalls.length} previous calls on record.`);
      const latestCall = recentCalls[0];
      if (latestCall) {
        contextParts.push(`Most recent call: ${new Date(latestCall.createdAt).toLocaleDateString()}`);
        if (latestCall.scores.length > 0) {
          const avgScore = latestCall.scores.reduce((sum, s) => sum + s.score, 0) / latestCall.scores.length;
          contextParts.push(`Average score on last call: ${(avgScore * 100).toFixed(0)}%`);
        }
      }
    }

    const callerContext = contextParts.join("\n");

    // Build AI prompt - use spec template if available
    let systemPrompt: string;
    let userPrompt: string;

    if (promptTemplate) {
      // Build template context for Mustache-style rendering
      const scoreToLabel = (score: number | null): string => {
        if (score === null) return "unknown";
        if (score >= thresholds.high) return "high";
        if (score <= thresholds.low) return "low";
        return "moderate";
      };

      const templateContext: Record<string, any> = {
        // Caller info
        caller: {
          id: caller.id,
          name: caller.name || "Unknown",
          callCount: recentCalls.length,
          lastCallDate: recentCalls[0] ? new Date(recentCalls[0].createdAt).toLocaleDateString() : "N/A",
        },

        // Personality profile
        personality: personality ? {
          openness: personality.openness !== null ? (personality.openness * 100).toFixed(0) + "%" : null,
          opennessLabel: scoreToLabel(personality.openness),
          conscientiousness: personality.conscientiousness !== null ? (personality.conscientiousness * 100).toFixed(0) + "%" : null,
          conscientiousnessLabel: scoreToLabel(personality.conscientiousness),
          extraversion: personality.extraversion !== null ? (personality.extraversion * 100).toFixed(0) + "%" : null,
          extraversionLabel: scoreToLabel(personality.extraversion),
          agreeableness: personality.agreeableness !== null ? (personality.agreeableness * 100).toFixed(0) + "%" : null,
          agreeablenessLabel: scoreToLabel(personality.agreeableness),
          neuroticism: personality.neuroticism !== null ? (personality.neuroticism * 100).toFixed(0) + "%" : null,
          neuroticismLabel: scoreToLabel(personality.neuroticism),
        } : null,

        // Behavior targets grouped by category - uses spec config.parameterGroups if available
        // Falls back to grouping by parameter domainGroup from database
        targets: (() => {
          const parameterGroups = (composeSpec?.config as any)?.parameterGroups;

          if (parameterGroups) {
            // Use spec-defined parameter groups (data-driven)
            return {
              communicationStyle: behaviorTargets
                .filter(t => (parameterGroups.communicationStyle || []).includes(t.parameterId))
                .map(t => ({
                  name: t.parameter?.name || t.parameterId,
                  level: scoreToLabel(t.targetValue),
                  qualifier: t.parameter?.interpretationHigh || "",
                })),
              engagementApproach: behaviorTargets
                .filter(t => (parameterGroups.engagementApproach || []).includes(t.parameterId))
                .map(t => ({
                  name: t.parameter?.name || t.parameterId,
                  level: scoreToLabel(t.targetValue),
                  qualifier: t.parameter?.interpretationHigh || "",
                })),
              adaptability: behaviorTargets
                .filter(t => (parameterGroups.adaptability || []).includes(t.parameterId))
                .map(t => ({
                  name: t.parameter?.name || t.parameterId,
                  level: scoreToLabel(t.targetValue),
                  qualifier: t.parameter?.interpretationHigh || "",
                })),
            };
          } else {
            // Fallback: Group by parameter's domainGroup from database
            const groupedByDomain: Record<string, typeof behaviorTargets> = {};
            for (const t of behaviorTargets) {
              const group = (t.parameter as any)?.domainGroup || "other";
              if (!groupedByDomain[group]) groupedByDomain[group] = [];
              groupedByDomain[group].push(t);
            }

            // Map common domain groups to expected template keys
            const mapToTarget = (targets: typeof behaviorTargets) => targets.map(t => ({
              name: t.parameter?.name || t.parameterId,
              level: scoreToLabel(t.targetValue),
              qualifier: t.parameter?.interpretationHigh || "",
            }));

            return {
              communicationStyle: mapToTarget(groupedByDomain["Communication Style"] || groupedByDomain["communication"] || []),
              engagementApproach: mapToTarget(groupedByDomain["Engagement"] || groupedByDomain["engagement"] || []),
              adaptability: mapToTarget(groupedByDomain["Adaptability"] || groupedByDomain["adaptability"] || []),
              // Include all other groups as well for templates that use them
              ...Object.fromEntries(
                Object.entries(groupedByDomain)
                  .filter(([k]) => !["Communication Style", "communication", "Engagement", "engagement", "Adaptability", "adaptability"].includes(k))
                  .map(([k, v]) => [k.toLowerCase().replace(/\s+/g, ''), mapToTarget(v)])
              ),
            };
          }
        })(),

        // Memories organized by type
        memories: {
          facts: memories.filter(m => m.category === "FACT").slice(0, memoriesPerCategory),
          preferences: memories.filter(m => m.category === "PREFERENCE").slice(0, memoriesPerCategory),
          events: memories.filter(m => m.category === "EVENT").slice(0, memoriesPerCategory),
          topics: memories.filter(m => m.category === "TOPIC").slice(0, memoriesPerCategory),
          relationships: memories.filter(m => m.category === "RELATIONSHIP").slice(0, memoriesPerCategory),
          context: memories.filter(m => m.category === "CONTEXT").slice(0, memoriesPerCategory),
        },
        hasMemories: memories.length > 0,

        // Also include the plain text context as fallback
        callerContext,
      };

      // Render the template with Mustache-style syntax
      const renderedTemplate = renderTemplate(promptTemplate, templateContext);

      // Debug log the rendered template (remove in production)
      console.log("[compose-prompt] Rendered template preview (first 500 chars):", renderedTemplate.substring(0, 500));

      // Split template into system and user parts if it contains a separator
      const parts = renderedTemplate.split("---\n");
      if (parts.length >= 2) {
        systemPrompt = parts[0].trim();
        userPrompt = parts.slice(1).join("---\n").trim();
      } else {
        // If no separator, use the whole template as the user prompt
        systemPrompt = "You are an expert at creating personalized agent guidance prompts.";
        userPrompt = renderedTemplate;
      }
    } else {
      // Default prompts (fallback if no spec configured)
      systemPrompt = `You are an expert at creating personalized agent guidance prompts.
Your task is to compose a prompt that will guide a conversational AI agent on how to best communicate with a specific caller.

The prompt should:
1. Be written as direct instructions to an AI agent (e.g., "Use a warm, friendly tone...")
2. Incorporate the caller's personality traits and adapt communication style accordingly
3. Reference specific memories and facts about the caller naturally
4. Follow the behavior targets for tone, length, formality, etc.
5. Be actionable and specific, not vague
6. Be between 200-500 words

Format the output as a clean, well-structured agent guidance prompt with clear sections.`;

      userPrompt = `Based on the following caller context, compose a personalized agent guidance prompt for the next conversation with this caller.

${callerContext}

Generate a complete agent guidance prompt that will help the AI agent provide the best possible experience for this specific caller.`;
    }

    // Call AI with spec-configured parameters
    const aiResult = await getAICompletion({
      engine: engine as AIEngine,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens,
      temperature,
    });

    // Build LLM-friendly structured prompt (JSON with explicit data)
    // This format is more reliable for AI consumption than prose
    const llmPrompt = buildLlmFriendlyPrompt({
      caller,
      memories,
      personality,
      recentCalls,
      behaviorTargets,
      thresholds,
      memoriesPerCategory,
    });

    // Store the composed prompt
    const composedPrompt = await prisma.composedPrompt.create({
      data: {
        callerId,
        prompt: aiResult.content,
        llmPrompt, // LLM-friendly structured JSON version
        triggerType,
        triggerCallId: triggerCallId || null,
        model: aiResult.model,
        status: "active",
        inputs: {
          callerContext,
          memoriesCount: memories.length,
          personalityAvailable: !!personality,
          recentCallsCount: recentCalls.length,
          behaviorTargetsCount: behaviorTargets.length,
          specUsed: composeSpec?.slug || "(defaults)",
          specConfig: {
            thresholds,
            memoriesLimit,
            memoriesPerCategory,
            recentCallsLimit,
            maxTokens,
            temperature,
          },
        },
      },
    });

    // Mark previous prompts as superseded
    await prisma.composedPrompt.updateMany({
      where: {
        callerId,
        id: { not: composedPrompt.id },
        status: "active",
      },
      data: {
        status: "superseded",
      },
    });

    return NextResponse.json({
      ok: true,
      prompt: composedPrompt,
      metadata: {
        engine: aiResult.engine,
        model: aiResult.model,
        usage: aiResult.usage,
        inputContext: {
          memoriesCount: memories.length,
          personalityAvailable: !!personality,
          recentCallsCount: recentCalls.length,
          behaviorTargetsCount: behaviorTargets.length,
        },
      },
    });
  } catch (error: any) {
    console.error("Error composing prompt:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to compose prompt" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/callers/[callerId]/compose-prompt
 *
 * Get all composed prompts for a caller (history)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callerId: string }> }
) {
  try {
    const { callerId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status"); // "active" | "superseded" | "all"

    const prompts = await prisma.composedPrompt.findMany({
      where: {
        callerId,
        ...(status && status !== "all" ? { status } : {}),
      },
      orderBy: { composedAt: "desc" },
      take: limit,
      include: {
        triggerCall: {
          select: {
            id: true,
            createdAt: true,
            source: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      prompts,
      count: prompts.length,
    });
  } catch (error: any) {
    console.error("Error fetching prompts:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch prompts" },
      { status: 500 }
    );
  }
}

/**
 * Build an LLM-friendly structured prompt (JSON format)
 * This is more reliable for AI consumption than prose:
 * - Explicit data types and values
 * - Clear categorization
 * - No ambiguity in parsing
 * - Easier for models to extract and use specific data
 */
interface LlmPromptInput {
  caller: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    externalId: string | null;
  } | null;
  memories: Array<{
    category: string;
    key: string;
    value: string;
    confidence: number;
    evidence: string | null;
  }>;
  personality: {
    openness: number | null;
    conscientiousness: number | null;
    extraversion: number | null;
    agreeableness: number | null;
    neuroticism: number | null;
    preferredTone: string | null;
    preferredLength: string | null;
    technicalLevel: string | null;
    confidenceScore: number | null;
  } | null;
  recentCalls: Array<{
    id: string;
    createdAt: Date;
    scores: Array<{
      parameterId: string;
      score: number;
      parameter: { name: string } | null;
    }>;
  }>;
  behaviorTargets: Array<{
    parameterId: string;
    targetValue: number;
    parameter: {
      name: string | null;
      interpretationLow: string | null;
      interpretationHigh: string | null;
      domainGroup: string | null;
    } | null;
  }>;
  thresholds: { high: number; low: number };
  memoriesPerCategory: number;
}

function buildLlmFriendlyPrompt(input: LlmPromptInput): Record<string, any> {
  const { caller, memories, personality, recentCalls, behaviorTargets, thresholds, memoriesPerCategory } = input;

  // Helper to classify values
  const classifyValue = (value: number | null): string | null => {
    if (value === null) return null;
    if (value >= thresholds.high) return "HIGH";
    if (value <= thresholds.low) return "LOW";
    return "MODERATE";
  };

  // Group memories by category
  const memoryGroups: Record<string, Array<{ key: string; value: string; confidence: number }>> = {};
  for (const m of memories) {
    if (!memoryGroups[m.category]) memoryGroups[m.category] = [];
    if (memoryGroups[m.category].length < memoriesPerCategory) {
      memoryGroups[m.category].push({
        key: m.key,
        value: m.value,
        confidence: m.confidence,
      });
    }
  }

  // Group behavior targets by domain
  const targetGroups: Record<string, Array<{
    parameterId: string;
    name: string;
    targetValue: number;
    targetLevel: string;
    interpretationHigh: string | null;
    interpretationLow: string | null;
  }>> = {};
  for (const t of behaviorTargets) {
    const domain = t.parameter?.domainGroup || "Other";
    if (!targetGroups[domain]) targetGroups[domain] = [];
    targetGroups[domain].push({
      parameterId: t.parameterId,
      name: t.parameter?.name || t.parameterId,
      targetValue: t.targetValue,
      targetLevel: classifyValue(t.targetValue) || "MODERATE",
      interpretationHigh: t.parameter?.interpretationHigh || null,
      interpretationLow: t.parameter?.interpretationLow || null,
    });
  }

  // Build recent calls summary
  const callHistory = recentCalls.map((call) => ({
    callId: call.id,
    date: call.createdAt.toISOString().split("T")[0],
    scores: call.scores.map((s) => ({
      parameter: s.parameter?.name || s.parameterId,
      score: s.score,
      level: classifyValue(s.score),
    })),
  }));

  return {
    _version: "1.0",
    _format: "LLM_STRUCTURED",
    _description: "Structured prompt data for AI agent guidance. Use this data to personalize your conversation approach.",

    caller: {
      id: caller?.id || null,
      name: caller?.name || null,
      contactInfo: {
        email: caller?.email || null,
        phone: caller?.phone || null,
      },
      externalId: caller?.externalId || null,
    },

    personality: personality ? {
      traits: {
        openness: {
          score: personality.openness,
          level: classifyValue(personality.openness),
          description: personality.openness !== null && personality.openness >= thresholds.high
            ? "Open to new experiences, curious, creative"
            : personality.openness !== null && personality.openness <= thresholds.low
              ? "Prefers routine, practical, conventional"
              : "Balanced between tradition and novelty",
        },
        conscientiousness: {
          score: personality.conscientiousness,
          level: classifyValue(personality.conscientiousness),
          description: personality.conscientiousness !== null && personality.conscientiousness >= thresholds.high
            ? "Organized, reliable, goal-oriented"
            : personality.conscientiousness !== null && personality.conscientiousness <= thresholds.low
              ? "Flexible, spontaneous, adaptable"
              : "Balances planning with flexibility",
        },
        extraversion: {
          score: personality.extraversion,
          level: classifyValue(personality.extraversion),
          description: personality.extraversion !== null && personality.extraversion >= thresholds.high
            ? "Outgoing, energetic, talkative"
            : personality.extraversion !== null && personality.extraversion <= thresholds.low
              ? "Reserved, reflective, quiet"
              : "Comfortable in both social and solitary settings",
        },
        agreeableness: {
          score: personality.agreeableness,
          level: classifyValue(personality.agreeableness),
          description: personality.agreeableness !== null && personality.agreeableness >= thresholds.high
            ? "Cooperative, trusting, helpful"
            : personality.agreeableness !== null && personality.agreeableness <= thresholds.low
              ? "Direct, skeptical, competitive"
              : "Balanced between cooperation and assertiveness",
        },
        neuroticism: {
          score: personality.neuroticism,
          level: classifyValue(personality.neuroticism),
          description: personality.neuroticism !== null && personality.neuroticism >= thresholds.high
            ? "Emotionally sensitive, may need reassurance"
            : personality.neuroticism !== null && personality.neuroticism <= thresholds.low
              ? "Emotionally stable, calm under pressure"
              : "Generally stable with normal emotional range",
        },
      },
      preferences: {
        tone: personality.preferredTone,
        responseLength: personality.preferredLength,
        technicalLevel: personality.technicalLevel,
      },
      confidence: personality.confidenceScore,
    } : null,

    memories: {
      totalCount: memories.length,
      byCategory: memoryGroups,
      // Flattened list for easy access
      all: memories.slice(0, 20).map((m) => ({
        category: m.category,
        key: m.key,
        value: m.value,
        confidence: m.confidence,
      })),
    },

    behaviorTargets: {
      totalCount: behaviorTargets.length,
      byDomain: targetGroups,
      // Flattened list with target values
      all: behaviorTargets.map((t) => ({
        parameterId: t.parameterId,
        name: t.parameter?.name || t.parameterId,
        targetValue: t.targetValue,
        targetLevel: classifyValue(t.targetValue),
        when_high: t.parameter?.interpretationHigh,
        when_low: t.parameter?.interpretationLow,
      })),
    },

    callHistory: {
      totalCalls: recentCalls.length,
      mostRecent: callHistory[0] || null,
      recent: callHistory.slice(0, 3),
    },

    // Explicit instructions for the AI
    instructions: {
      use_memories: "Reference specific memories naturally in conversation. Key facts: " +
        (memoryGroups["FACT"]?.slice(0, 3).map((m) => `${m.key}="${m.value}"`).join(", ") || "none"),
      use_preferences: "Respect caller preferences: " +
        (memoryGroups["PREFERENCE"]?.slice(0, 3).map((m) => `${m.key}="${m.value}"`).join(", ") || "none"),
      use_topics: "Topics of interest to explore: " +
        (memoryGroups["TOPIC"]?.slice(0, 3).map((m) => m.value).join(", ") || "none"),
      personality_adaptation: personality ? [
        personality.extraversion !== null && personality.extraversion >= thresholds.high
          ? "Match their energy - be engaging and conversational"
          : personality.extraversion !== null && personality.extraversion <= thresholds.low
            ? "Give them space - be concise, allow pauses"
            : null,
        personality.openness !== null && personality.openness >= thresholds.high
          ? "Explore ideas - they enjoy intellectual discussion"
          : personality.openness !== null && personality.openness <= thresholds.low
            ? "Stay practical - focus on concrete topics"
            : null,
        personality.agreeableness !== null && personality.agreeableness <= thresholds.low
          ? "Be direct - they appreciate straightforward communication"
          : null,
      ].filter(Boolean) : [],
      behavior_targets_summary: behaviorTargets.slice(0, 5).map((t) => ({
        what: t.parameter?.name || t.parameterId,
        target: classifyValue(t.targetValue),
        meaning: t.targetValue >= thresholds.high
          ? t.parameter?.interpretationHigh
          : t.targetValue <= thresholds.low
            ? t.parameter?.interpretationLow
            : "moderate approach",
      })),
    },
  };
}
