import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * GET /api/analysis-specs/[specId]
 * Get a single analysis spec with full nested data
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const { specId } = await params;

    const spec = await prisma.analysisSpec.findFirst({
      where: {
        OR: [{ id: specId }, { slug: specId }],
      },
      include: {
        triggers: {
          orderBy: { sortOrder: "asc" },
          include: {
            actions: {
              orderBy: { sortOrder: "asc" },
              include: {
                parameter: {
                  select: {
                    parameterId: true,
                    name: true,
                    definition: true,
                    scaleType: true,
                    interpretationHigh: true,
                    interpretationLow: true,
                    scoringAnchors: {
                      orderBy: [{ score: "asc" }, { sortOrder: "asc" }],
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!spec) {
      return NextResponse.json(
        { ok: false, error: "Spec not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, spec });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch spec" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/analysis-specs/[specId]
 * Update an analysis spec (metadata only - use nested routes for triggers)
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const { specId } = await params;
    const body = await req.json();
    const { name, description, outputType, domain, priority, isActive, version, forceUnlock } = body;

    // Check if spec is locked
    const existing = await prisma.analysisSpec.findUnique({
      where: { id: specId },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Spec not found" },
        { status: 404 }
      );
    }

    // If locked and not just toggling isActive, block the edit
    if (existing.isLocked && !forceUnlock) {
      // Allow toggling isActive on locked specs (deactivating doesn't change the spec)
      if (isActive !== undefined && name === undefined && description === undefined && outputType === undefined && domain === undefined && priority === undefined && version === undefined) {
        // Just toggling active status is OK
      } else {
        return NextResponse.json(
          {
            ok: false,
            error: "Spec is locked and cannot be modified",
            locked: true,
            lockedReason: existing.lockedReason,
            usageCount: existing.usageCount,
          },
          { status: 423 }
        );
      }
    }

    // Determine if this is a content change (marks spec as dirty)
    const isContentChange = name !== undefined || description !== undefined ||
                           outputType !== undefined || domain !== undefined ||
                           priority !== undefined || version !== undefined;

    // Check if spec was previously compiled (to warn user)
    const wasCompiled = existing.compiledAt !== null && !existing.isDirty;

    const spec = await prisma.analysisSpec.update({
      where: { id: specId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(outputType !== undefined && { outputType }),
        ...(domain !== undefined && { domain }),
        ...(priority !== undefined && { priority }),
        ...(isActive !== undefined && { isActive }),
        ...(version !== undefined && { version }),
        // Mark as dirty if content changed
        ...(isContentChange && {
          isDirty: true,
          dirtyReason: "spec_metadata_modified"
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      spec,
      wasCompiled,  // Let UI know if it should show a warning
    });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json(
        { ok: false, error: "Spec not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update spec" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/analysis-specs/[specId]
 * Partial update - specifically for promptTemplate updates
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const { specId } = await params;
    const body = await req.json();
    const { promptTemplate } = body;

    // Check if spec exists and is not locked
    const existing = await prisma.analysisSpec.findUnique({
      where: { id: specId },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Spec not found" },
        { status: 404 }
      );
    }

    if (existing.isLocked) {
      return NextResponse.json(
        {
          ok: false,
          error: "Spec is locked and cannot be modified",
          locked: true,
          lockedReason: existing.lockedReason,
        },
        { status: 423 }
      );
    }

    const spec = await prisma.analysisSpec.update({
      where: { id: specId },
      data: {
        promptTemplate: promptTemplate,
        // Mark as dirty if template changed
        isDirty: true,
        dirtyReason: "prompt_template_modified",
      },
    });

    return NextResponse.json({ ok: true, spec });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update spec" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/analysis-specs/[specId]
 * Delete an analysis spec and all nested data (cascades)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const { specId } = await params;

    await prisma.analysisSpec.delete({
      where: { id: specId },
    });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json(
        { ok: false, error: "Spec not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete spec" },
      { status: 500 }
    );
  }
}
