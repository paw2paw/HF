import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeComposition, getDefaultSections } from "@/lib/prompt/composition";
import { renderPromptSummary } from "@/lib/prompt/composition/renderPromptSummary";

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
      triggerType = "manual",
      triggerCallId,
      targetOverrides, // Preview overrides for behavior targets (not persisted)
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

    // Build the full config for the composition pipeline
    const fullSpecConfig = {
      ...specConfig,
      thresholds,
      memoriesLimit,
      memoriesPerCategory,
      recentCallsLimit,
      maxTokens,
      temperature,
      // Include target overrides for preview (not persisted)
      targetOverrides: targetOverrides || {},
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
    // RENDER PROMPT SUMMARY (deterministic, no AI call)
    // ============================================================
    const promptSummary = renderPromptSummary(llmPrompt);
    console.log(`[compose-prompt] Rendered summary: ${promptSummary.length} chars`);

    // Store the composed prompt
    const composedPrompt = await prisma.composedPrompt.create({
      data: {
        callerId,
        prompt: promptSummary,
        llmPrompt,
        triggerType,
        triggerCallId: triggerCallId || null,
        model: "deterministic", // No AI model used
        status: "active",
        inputs: {
          callerContext,
          memoriesCount: loadedData.memories.length,
          personalityAvailable: !!loadedData.personality,
          recentCallsCount: loadedData.recentCalls.length,
          behaviorTargetsCount: metadata.mergedTargetCount,
          playbooksUsed: loadedData.playbooks.map(p => p.name),
          playbooksCount: loadedData.playbooks.length,
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
        engine: "deterministic",
        model: "renderPromptSummary",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        inputContext: {
          memoriesCount: loadedData.memories.length,
          personalityAvailable: !!loadedData.personality,
          recentCallsCount: loadedData.recentCalls.length,
          behaviorTargetsCount: metadata.mergedTargetCount,
          playbooksUsed: loadedData.playbooks.map(p => p.name),
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
