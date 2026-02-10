import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/specs/[specId]
 * Get a single spec by ID with all related data
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const { specId } = await params;

    const spec = await prisma.analysisSpec.findUnique({
      where: { id: specId },
      include: {
        triggers: {
          include: {
            actions: true,
          },
          orderBy: { sortOrder: "asc" },
        },
        promptSlug: {
          include: {
            parameters: {
              include: {
                parameter: {
                  select: {
                    parameterId: true,
                    name: true,
                    definition: true,
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
    console.error("[api/specs/[specId]] Error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to fetch spec" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/specs/[specId]
 * Update a spec
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const { specId } = await params;
    const body = await req.json();

    const spec = await prisma.analysisSpec.update({
      where: { id: specId },
      data: {
        name: body.name,
        description: body.description,
        isActive: body.isActive,
        isDirty: body.isDirty,
        priority: body.priority,
        config: body.config,
        promptTemplate: body.promptTemplate,
      },
    });

    return NextResponse.json({ ok: true, spec });
  } catch (error: any) {
    console.error("[api/specs/[specId]] Update error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to update spec" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/specs/[specId]
 * Delete a spec
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const { specId } = await params;

    await prisma.analysisSpec.delete({
      where: { id: specId },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[api/specs/[specId]] Delete error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to delete spec" },
      { status: 500 }
    );
  }
}
