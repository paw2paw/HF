import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AIEngine, getDefaultEngine } from "@/lib/ai/client";
import { getMeteredAICompletion } from "@/lib/metering";
import { renderTemplate } from "@/lib/prompt/PromptTemplateCompiler";
import { getMemoriesByCategory } from "@/lib/constants";
import { executeComposition, getDefaultSections } from "@/lib/prompt/composition";

export const runtime = "nodejs";

/**
 * POST /api/callers/[callerId]/compose-prompt
 *
 * Compose a personalized next-call prompt for a caller using AI.
 * Uses the declarative composition pipeline driven by COMP-001 spec sections.
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

    // Extract config from spec
    const specConfig = (composeSpec?.config as any) || {};
    const specParameters: Array<{ id: string; config?: any }> = specConfig.parameters || [];

    const getParamConfig = (paramId: string): any => {
      const param = specParameters.find(p => p.id === paramId);
      return param?.config || {};
    };

    // Extract spec-driven config values
    const personalityConfig = getParamConfig("personality_section");
    const memoryConfig = getParamConfig("memory_section");
    const sessionConfig = getParamConfig("session_context_section");
    const historyConfig = getParamConfig("recent_history_section");

    const thresholds = personalityConfig.thresholds || specConfig.thresholds || { high: 0.65, low: 0.35 };
    const memoriesLimit = memoryConfig.memoriesLimit || specConfig.memoriesLimit || 50;
    const memoriesPerCategory = memoryConfig.memoriesPerCategory || specConfig.memoriesPerCategory || 5;
    const recentCallsLimit = sessionConfig.recentCallsLimit || specConfig.recentCallsLimit || 5;
    const maxTokens = historyConfig.maxTokens || specConfig.maxTokens || 1500;
    const temperature = historyConfig.temperature || specConfig.temperature || 0.7;

    const promptTemplate = composeSpec?.promptTemplate || null;

    // Build the full config for the composition pipeline
    const fullSpecConfig = {
      ...specConfig,
      thresholds,
      memoriesLimit,
      memoriesPerCategory,
      recentCallsLimit,
      maxTokens,
      temperature,
    };

    // Get section definitions from spec (or use hardcoded defaults for backward compat)
    const sections = specConfig.sections || getDefaultSections();

    // ============================================================
    // EXECUTE COMPOSITION PIPELINE
    // All data loading, transformation, and assembly happens here.
    // Replaces ~1800 lines of inline logic.
    // ============================================================
    const composition = await executeComposition(callerId, sections, fullSpecConfig);

    const { llmPrompt, callerContext, loadedData, resolvedSpecs, metadata } = composition;

    console.log(`[compose-prompt] Composition: ${metadata.sectionsActivated.length} activated, ${metadata.sectionsSkipped.length} skipped (load: ${metadata.loadTimeMs}ms, transform: ${metadata.transformTimeMs}ms)`);
    console.log(`[compose-prompt] Identity: ${resolvedSpecs.identitySpec?.name || "NONE"}, Content: ${resolvedSpecs.contentSpec?.name || "NONE"}, Voice: ${resolvedSpecs.voiceSpec?.name || "NONE"}`);

    // ============================================================
    // BUILD AI PROMPT
    // Use spec template if available, otherwise use default prompts.
    // The AI generates a prose version; llmPrompt is the structured JSON.
    // ============================================================
    let systemPrompt: string;
    let userPrompt: string;

    if (promptTemplate) {
      // Build template context from composition result
      const scoreToLabel = (score: number | null): string => {
        if (score === null) return "unknown";
        if (score >= thresholds.high) return "high";
        if (score <= thresholds.low) return "low";
        return "moderate";
      };

      const personality = loadedData.personality;
      const templateContext: Record<string, any> = {
        caller: {
          id: loadedData.caller?.id,
          name: loadedData.caller?.name || "Unknown",
          callCount: loadedData.callCount,
          lastCallDate: loadedData.recentCalls[0]
            ? new Date(loadedData.recentCalls[0].createdAt).toLocaleDateString()
            : "N/A",
        },

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

        // Behavior targets grouped by domain (for template rendering)
        targets: (() => {
          const byDomain = composition.sections.behaviorTargets?.byDomain || {};
          const mapToTarget = (targets: any[]) => targets.map((t: any) => ({
            name: t.name || t.parameterId,
            level: scoreToLabel(t.targetValue),
            qualifier: t.interpretationHigh || "",
          }));
          return Object.fromEntries(
            Object.entries(byDomain).map(([k, v]: [string, any]) => [
              k.toLowerCase().replace(/\s+/g, ""),
              mapToTarget(v),
            ])
          );
        })(),

        learnerProfile: loadedData.learnerProfile || null,
        hasLearnerProfile: !!loadedData.learnerProfile,

        memories: getMemoriesByCategory(loadedData.memories, memoriesPerCategory),
        hasMemories: loadedData.memories.length > 0,

        callerContext,
      };

      const renderedTemplate = renderTemplate(promptTemplate, templateContext);
      console.log("[compose-prompt] Rendered template preview (first 500 chars):", renderedTemplate.substring(0, 500));

      const parts = renderedTemplate.split("---\n");
      if (parts.length >= 2) {
        systemPrompt = parts[0].trim();
        userPrompt = parts.slice(1).join("---\n").trim();
      } else {
        systemPrompt = "You are an expert at creating personalized agent guidance prompts.";
        userPrompt = renderedTemplate;
      }
    } else {
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

    // ============================================================
    // CALL AI + STORE RESULT
    // ============================================================
    const aiResult = await getMeteredAICompletion({
      engine: engine as AIEngine,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens,
      temperature,
    }, { callerId, sourceOp: "compose-prompt" });

    // Store the composed prompt
    const composedPrompt = await prisma.composedPrompt.create({
      data: {
        callerId,
        prompt: aiResult.content,
        llmPrompt,
        triggerType,
        triggerCallId: triggerCallId || null,
        model: aiResult.model,
        status: "active",
        inputs: {
          callerContext,
          memoriesCount: loadedData.memories.length,
          personalityAvailable: !!loadedData.personality,
          recentCallsCount: loadedData.recentCalls.length,
          behaviorTargetsCount: metadata.mergedTargetCount,
          playbookUsed: loadedData.playbook?.name || null,
          playbookStatus: loadedData.playbook?.status || null,
          identitySpec: resolvedSpecs.identitySpec?.name || null,
          contentSpec: resolvedSpecs.contentSpec?.name || null,
          specUsed: composeSpec?.slug || "(defaults)",
          specConfig: {
            thresholds,
            memoriesLimit,
            memoriesPerCategory,
            recentCallsLimit,
            maxTokens,
            temperature,
          },
          composition: {
            sectionsActivated: metadata.sectionsActivated,
            sectionsSkipped: metadata.sectionsSkipped,
            loadTimeMs: metadata.loadTimeMs,
            transformTimeMs: metadata.transformTimeMs,
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
          memoriesCount: loadedData.memories.length,
          personalityAvailable: !!loadedData.personality,
          recentCallsCount: loadedData.recentCalls.length,
          behaviorTargetsCount: metadata.mergedTargetCount,
          playbookName: loadedData.playbook?.name || null,
          identitySpec: resolvedSpecs.identitySpec?.name || null,
          contentSpec: resolvedSpecs.contentSpec?.name || null,
        },
        composition: {
          sectionsActivated: metadata.sectionsActivated,
          sectionsSkipped: metadata.sectionsSkipped,
          loadTimeMs: metadata.loadTimeMs,
          transformTimeMs: metadata.transformTimeMs,
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
