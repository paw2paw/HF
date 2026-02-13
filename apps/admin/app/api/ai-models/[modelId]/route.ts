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
import { requireAuth, isAuthError } from "@/lib/permissions";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ modelId: string }>;
}

/**
 * @api GET /api/ai-models/:modelId
 * @visibility internal
 * @scope ai-models:read
 * @auth session
 * @tags ai
 * @description Fetch a single AI model by its modelId.
 * @pathParam modelId string - The unique model identifier
 * @response 200 { ok: true, model: {...} }
 * @response 404 { ok: false, error: "Model \"...\" not found" }
 * @response 500 { ok: false, error: "Failed to fetch model" }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

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
 * @api PUT /api/ai-models/:modelId
 * @visibility internal
 * @scope ai-models:write
 * @auth bearer
 * @tags ai
 * @description Update an existing AI model's properties (label, tier, sortOrder, isActive). Only provided fields are updated.
 * @pathParam modelId string - The unique model identifier
 * @body label string - Updated display label (optional)
 * @body tier string - Updated tier ("flagship" | "standard" | "fast" | "test") (optional)
 * @body sortOrder number - Updated sort order (optional)
 * @body isActive boolean - Updated active state (optional)
 * @response 200 { ok: true, model: {...} }
 * @response 400 { ok: false, error: "Invalid tier. Must be one of: ..." }
 * @response 404 { ok: false, error: "Model \"...\" not found" }
 * @response 500 { ok: false, error: "Failed to update model" }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

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
 * @api DELETE /api/ai-models/:modelId
 * @visibility internal
 * @scope ai-models:write
 * @auth bearer
 * @tags ai
 * @description Delete an AI model. Fails with 409 if the model is currently referenced by any AIConfig call point.
 * @pathParam modelId string - The unique model identifier
 * @response 200 { ok: true, message: "Model \"...\" deleted" }
 * @response 404 { ok: false, error: "Model \"...\" not found" }
 * @response 409 { ok: false, error: "Cannot delete model \"...\" - it is in use by call point \"...\"" }
 * @response 500 { ok: false, error: "Failed to delete model" }
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

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
