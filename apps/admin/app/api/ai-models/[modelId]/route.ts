/**
 * API for managing individual AI models
 *
 * GET: Get a specific model
 * PUT: Update a model
 * DELETE: Delete a model
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PROVIDERS } from "../route";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ modelId: string }>;
}

/**
 * GET /api/ai-models/[modelId]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { modelId } = await params;

    const model = await prisma.aIModel.findUnique({
      where: { modelId },
    });

    if (!model) {
      return NextResponse.json(
        { ok: false, error: `Model "${modelId}" not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, model });
  } catch (error: unknown) {
    console.error("[ai-models] GET error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to fetch model" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ai-models/[modelId]
 *
 * Update a model's properties
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { modelId } = await params;
    const body = await request.json();
    const { label, tier, sortOrder, isActive } = body;

    // Check model exists
    const existing = await prisma.aIModel.findUnique({
      where: { modelId },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: `Model "${modelId}" not found` },
        { status: 404 }
      );
    }

    // Validate tier if provided
    const validTiers = ["flagship", "standard", "fast", "test"];
    if (tier && !validTiers.includes(tier)) {
      return NextResponse.json(
        { ok: false, error: `Invalid tier. Must be one of: ${validTiers.join(", ")}` },
        { status: 400 }
      );
    }

    // Build update data (only include provided fields)
    const updateData: any = {};
    if (label !== undefined) updateData.label = label;
    if (tier !== undefined) updateData.tier = tier;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isActive !== undefined) updateData.isActive = isActive;

    const model = await prisma.aIModel.update({
      where: { modelId },
      data: updateData,
    });

    return NextResponse.json({ ok: true, model });
  } catch (error: unknown) {
    console.error("[ai-models] PUT error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to update model" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai-models/[modelId]
 *
 * Delete a model. Will fail if the model is currently in use by any AIConfig.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { modelId } = await params;

    // Check model exists
    const existing = await prisma.aIModel.findUnique({
      where: { modelId },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: `Model "${modelId}" not found` },
        { status: 404 }
      );
    }

    // Check if model is in use by any AIConfig
    const inUse = await prisma.aIConfig.findFirst({
      where: { model: modelId },
    });

    if (inUse) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cannot delete model "${modelId}" - it is in use by call point "${inUse.callPoint}". Change the configuration first.`,
        },
        { status: 409 }
      );
    }

    await prisma.aIModel.delete({
      where: { modelId },
    });

    return NextResponse.json({
      ok: true,
      message: `Model "${modelId}" deleted`,
    });
  } catch (error: unknown) {
    console.error("[ai-models] DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to delete model" },
      { status: 500 }
    );
  }
}
