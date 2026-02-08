/**
 * AI Configuration API
 *
 * Manages per-call-point AI model settings.
 * Allows admins to configure which AI provider/model to use for each operation.
 *
 * GET    - List all configurations (with defaults for unconfigured call points)
 * POST   - Create or update a configuration
 * DELETE - Remove a configuration (reverts to default)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// =====================================================
// CALL POINT DEFINITIONS
// =====================================================

/**
 * All configurable AI call points in the system.
 * Each has a unique ID, label, description, and default settings.
 */
export const AI_CALL_POINTS = [
  {
    callPoint: "pipeline.measure",
    label: "Pipeline - MEASURE",
    description: "Scores caller parameters from transcript (Big 5 personality, engagement, etc.)",
    defaultProvider: "claude",
    defaultModel: "claude-sonnet-4-20250514",
    defaultTranscriptLimit: 4000,
  },
  {
    callPoint: "pipeline.learn",
    label: "Pipeline - LEARN",
    description: "Extracts facts and memories about the caller from transcript",
    defaultProvider: "claude",
    defaultModel: "claude-sonnet-4-20250514",
    defaultTranscriptLimit: 4000,
  },
  {
    callPoint: "pipeline.score_agent",
    label: "Pipeline - SCORE_AGENT",
    description: "Evaluates agent behavior against targets (warmth, empathy, etc.)",
    defaultProvider: "claude",
    defaultModel: "claude-sonnet-4-20250514",
    defaultTranscriptLimit: 4000,
  },
  {
    callPoint: "pipeline.adapt",
    label: "Pipeline - ADAPT",
    description: "Computes personalized behavior targets based on caller profile",
    defaultProvider: "claude",
    defaultModel: "claude-sonnet-4-20250514",
    defaultTranscriptLimit: 2500,
  },
  {
    callPoint: "compose.prompt",
    label: "Prompt Composition",
    description: "Generates personalized agent guidance prompts",
    defaultProvider: "claude",
    defaultModel: "claude-sonnet-4-20250514",
  },
  {
    callPoint: "analysis.measure",
    label: "Analysis - MEASURE",
    description: "Standalone parameter scoring (used by /api/analysis/run)",
    defaultProvider: "claude",
    defaultModel: "claude-3-haiku-20240307",
  },
  {
    callPoint: "analysis.learn",
    label: "Analysis - LEARN",
    description: "Standalone memory extraction (used by /api/analysis/run)",
    defaultProvider: "claude",
    defaultModel: "claude-3-haiku-20240307",
  },
  {
    callPoint: "parameter.enrich",
    label: "Parameter Enrichment",
    description: "Enriches parameter definitions with KB context",
    defaultProvider: "claude",
    defaultModel: "claude-3-haiku-20240307",
  },
  {
    callPoint: "bdd.parse",
    label: "BDD Parser",
    description: "Parses BDD specifications into structured data",
    defaultProvider: "claude",
    defaultModel: "claude-sonnet-4-20250514",
  },
  {
    callPoint: "chat.stream",
    label: "Chat (Streaming)",
    description: "Interactive chat completions with streaming",
    defaultProvider: "claude",
    defaultModel: "claude-sonnet-4-20250514",
  },
  {
    callPoint: "spec.assistant",
    label: "Spec Creation Assistant",
    description: "AI assistant for creating and editing BDD specifications",
    defaultProvider: "claude",
    defaultModel: "claude-sonnet-4-20250514",
  },
] as const;

// Hardcoded fallback models (used if DB is empty)
// These are seeded to the AIModel table on first access via /api/ai-models
export const AVAILABLE_MODELS = {
  claude: [
    { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", tier: "flagship" },
    { id: "claude-3-haiku-20240307", label: "Claude 3 Haiku", tier: "fast" },
    { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", tier: "standard" },
  ],
  openai: [
    { id: "gpt-4o", label: "GPT-4o", tier: "flagship" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini", tier: "fast" },
    { id: "gpt-4-turbo", label: "GPT-4 Turbo", tier: "standard" },
  ],
  mock: [
    { id: "mock-model", label: "Mock (Testing)", tier: "test" },
  ],
} as const;

/**
 * Fetch available models from database, grouped by provider.
 * Falls back to hardcoded AVAILABLE_MODELS if DB is empty.
 */
async function getAvailableModels(): Promise<Record<string, Array<{ id: string; label: string; tier: string }>>> {
  try {
    const models = await prisma.aIModel.findMany({
      where: { isActive: true },
      orderBy: [{ provider: "asc" }, { sortOrder: "asc" }],
    });

    if (models.length === 0) {
      // Return hardcoded fallback
      return AVAILABLE_MODELS as any;
    }

    // Group by provider
    const byProvider: Record<string, Array<{ id: string; label: string; tier: string }>> = {};
    for (const model of models) {
      if (!byProvider[model.provider]) {
        byProvider[model.provider] = [];
      }
      byProvider[model.provider].push({
        id: model.modelId,
        label: model.label,
        tier: model.tier,
      });
    }

    return byProvider;
  } catch (error) {
    console.error("[ai-config] Error fetching models from DB, using fallback:", error);
    return AVAILABLE_MODELS as any;
  }
}

export type CallPointId = typeof AI_CALL_POINTS[number]["callPoint"];

// =====================================================
// GET - List all configurations
// =====================================================

export async function GET() {
  try {
    // Fetch all saved configurations and available models in parallel
    const [savedConfigs, availableModels] = await Promise.all([
      prisma.aIConfig.findMany({
        orderBy: { callPoint: "asc" },
      }),
      getAvailableModels(),
    ]);

    // Check which providers have API keys configured
    const keyStatus: Record<string, boolean> = {
      claude: !!process.env.ANTHROPIC_API_KEY,
      openai: !!(process.env.OPENAI_HF_MVP_KEY || process.env.OPENAI_API_KEY),
      mock: true, // Mock always available
    };

    // Create a map for quick lookup
    const configMap = new Map(savedConfigs.map((c) => [c.callPoint, c]));

    // Merge with defaults to show all call points
    const allConfigs = AI_CALL_POINTS.map((def) => {
      const saved = configMap.get(def.callPoint);
      const provider = saved?.provider ?? def.defaultProvider;
      return {
        callPoint: def.callPoint,
        label: def.label,
        description: def.description,
        // Use saved values or defaults
        provider,
        model: saved?.model ?? def.defaultModel,
        maxTokens: saved?.maxTokens ?? null,
        temperature: saved?.temperature ?? null,
        transcriptLimit: saved?.transcriptLimit ?? null,
        isActive: saved?.isActive ?? true,
        // Metadata
        isCustomized: !!saved,
        savedId: saved?.id ?? null,
        updatedAt: saved?.updatedAt ?? null,
        // Defaults for reference
        defaultProvider: def.defaultProvider,
        defaultModel: def.defaultModel,
        defaultTranscriptLimit: (def as any).defaultTranscriptLimit ?? null,
        // Key availability for this config's provider
        hasKey: keyStatus[provider] ?? false,
      };
    });

    return NextResponse.json({
      ok: true,
      configs: allConfigs,
      availableModels,
      callPoints: AI_CALL_POINTS,
      keyStatus, // Which providers have keys configured
    });
  } catch (error) {
    console.error("[ai-config] GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch AI configurations" },
      { status: 500 }
    );
  }
}

// =====================================================
// POST - Create or update configuration
// =====================================================

interface UpdateConfigBody {
  callPoint: string;
  provider: string;
  model: string;
  maxTokens?: number | null;
  temperature?: number | null;
  transcriptLimit?: number | null;
  isActive?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: UpdateConfigBody = await request.json();

    // Validate callPoint
    const callPointDef = AI_CALL_POINTS.find((cp) => cp.callPoint === body.callPoint);
    if (!callPointDef) {
      return NextResponse.json(
        { ok: false, error: `Invalid callPoint: ${body.callPoint}` },
        { status: 400 }
      );
    }

    // Validate provider
    if (!["claude", "openai", "mock"].includes(body.provider)) {
      return NextResponse.json(
        { ok: false, error: `Invalid provider: ${body.provider}` },
        { status: 400 }
      );
    }

    // Validate model exists for provider (check DB first, fallback to hardcoded)
    const availableModels = await getAvailableModels();
    const providerModels = availableModels[body.provider];
    if (!providerModels?.some((m) => m.id === body.model)) {
      return NextResponse.json(
        { ok: false, error: `Invalid model ${body.model} for provider ${body.provider}` },
        { status: 400 }
      );
    }

    // Upsert the configuration
    const config = await prisma.aIConfig.upsert({
      where: { callPoint: body.callPoint },
      create: {
        callPoint: body.callPoint,
        label: callPointDef.label,
        provider: body.provider,
        model: body.model,
        maxTokens: body.maxTokens ?? null,
        temperature: body.temperature ?? null,
        transcriptLimit: body.transcriptLimit ?? null,
        isActive: body.isActive ?? true,
        description: callPointDef.description,
      },
      update: {
        provider: body.provider,
        model: body.model,
        maxTokens: body.maxTokens ?? null,
        temperature: body.temperature ?? null,
        transcriptLimit: body.transcriptLimit ?? null,
        isActive: body.isActive ?? true,
      },
    });

    return NextResponse.json({
      ok: true,
      config,
      message: `Updated AI config for ${callPointDef.label}`,
    });
  } catch (error) {
    console.error("[ai-config] POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update AI configuration" },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE - Remove configuration (revert to default)
// =====================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callPoint = searchParams.get("callPoint");

    if (!callPoint) {
      return NextResponse.json(
        { ok: false, error: "callPoint query parameter is required" },
        { status: 400 }
      );
    }

    // Find and delete
    const existing = await prisma.aIConfig.findUnique({
      where: { callPoint },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: `No custom config found for ${callPoint}` },
        { status: 404 }
      );
    }

    await prisma.aIConfig.delete({
      where: { callPoint },
    });

    return NextResponse.json({
      ok: true,
      message: `Reverted ${callPoint} to default settings`,
    });
  } catch (error) {
    console.error("[ai-config] DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to delete AI configuration" },
      { status: 500 }
    );
  }
}
