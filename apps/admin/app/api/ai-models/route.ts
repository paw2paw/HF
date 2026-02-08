/**
 * API for managing AI models
 *
 * GET: List all available models (optionally filter by provider)
 * POST: Create a new model
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Default models to seed if table is empty
const DEFAULT_MODELS = [
  // Claude models
  { modelId: "claude-sonnet-4-20250514", provider: "claude", label: "Claude Sonnet 4", tier: "flagship", sortOrder: 1 },
  { modelId: "claude-3-5-sonnet-20241022", provider: "claude", label: "Claude 3.5 Sonnet", tier: "standard", sortOrder: 2 },
  { modelId: "claude-3-haiku-20240307", provider: "claude", label: "Claude 3 Haiku", tier: "fast", sortOrder: 3 },
  // OpenAI models
  { modelId: "gpt-4o", provider: "openai", label: "GPT-4o", tier: "flagship", sortOrder: 1 },
  { modelId: "gpt-4o-mini", provider: "openai", label: "GPT-4o Mini", tier: "fast", sortOrder: 2 },
  { modelId: "gpt-4-turbo", provider: "openai", label: "GPT-4 Turbo", tier: "standard", sortOrder: 3 },
  { modelId: "gpt-3.5-turbo", provider: "openai", label: "GPT-3.5 Turbo", tier: "fast", sortOrder: 4 },
  // Mock models
  { modelId: "mock-model", provider: "mock", label: "Mock Model", tier: "test", sortOrder: 1 },
];

// Available providers
export const PROVIDERS = [
  { id: "claude", label: "Anthropic Claude", color: "#D97706" },
  { id: "openai", label: "OpenAI", color: "#10B981" },
  { id: "mock", label: "Mock (Testing)", color: "#6B7280" },
];

/**
 * GET /api/ai-models
 *
 * Query params:
 * - provider: Filter by provider (optional)
 * - includeInactive: Include inactive models (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");
    const includeInactive = searchParams.get("includeInactive") === "true";

    // Check if we have any models, seed if not
    const count = await prisma.aIModel.count();
    if (count === 0) {
      await seedDefaultModels();
    }

    // Build query
    const where: any = {};
    if (provider) {
      where.provider = provider;
    }
    if (!includeInactive) {
      where.isActive = true;
    }

    const models = await prisma.aIModel.findMany({
      where,
      orderBy: [{ provider: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    });

    // Group by provider for easier UI consumption
    const byProvider: Record<string, typeof models> = {};
    for (const model of models) {
      if (!byProvider[model.provider]) {
        byProvider[model.provider] = [];
      }
      byProvider[model.provider].push(model);
    }

    return NextResponse.json({
      ok: true,
      models,
      byProvider,
      providers: PROVIDERS,
    });
  } catch (error: unknown) {
    console.error("[ai-models] GET error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to fetch models" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai-models
 *
 * Create a new AI model
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId, provider, label, tier, sortOrder, isActive } = body;

    // Validate required fields
    if (!modelId || !provider || !label) {
      return NextResponse.json(
        { ok: false, error: "modelId, provider, and label are required" },
        { status: 400 }
      );
    }

    // Validate provider
    const validProviders = PROVIDERS.map((p) => p.id);
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { ok: false, error: `Invalid provider. Must be one of: ${validProviders.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate tier
    const validTiers = ["flagship", "standard", "fast", "test"];
    if (tier && !validTiers.includes(tier)) {
      return NextResponse.json(
        { ok: false, error: `Invalid tier. Must be one of: ${validTiers.join(", ")}` },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await prisma.aIModel.findUnique({
      where: { modelId },
    });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: `Model with ID "${modelId}" already exists` },
        { status: 409 }
      );
    }

    // Create model
    const model = await prisma.aIModel.create({
      data: {
        modelId,
        provider,
        label,
        tier: tier || "standard",
        sortOrder: sortOrder ?? 99,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json({ ok: true, model });
  } catch (error: unknown) {
    console.error("[ai-models] POST error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to create model" },
      { status: 500 }
    );
  }
}

/**
 * Seed default models into the database
 */
async function seedDefaultModels() {
  console.log("[ai-models] Seeding default models...");

  for (const model of DEFAULT_MODELS) {
    await prisma.aIModel.upsert({
      where: { modelId: model.modelId },
      update: {},
      create: {
        ...model,
        isActive: true,
      },
    });
  }

  console.log(`[ai-models] Seeded ${DEFAULT_MODELS.length} default models`);
}
