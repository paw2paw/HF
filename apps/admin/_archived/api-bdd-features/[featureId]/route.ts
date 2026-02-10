import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * GET /api/bdd-features/[featureId]
 * Get a single BDD feature with full nested data
 * Includes Parameter scoring anchors (read-only)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    const { featureId } = await params;

    const feature = await prisma.bddFeature.findFirst({
      where: {
        OR: [{ id: featureId }, { slug: featureId }],
      },
      include: {
        scenarios: {
          orderBy: { sortOrder: "asc" },
          include: {
            criteria: {
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
                    // Include scoring anchors from the Parameter (read-only)
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

    if (!feature) {
      return NextResponse.json(
        { ok: false, error: "Feature not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, feature });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch feature" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/bdd-features/[featureId]
 * Update a BDD feature (metadata only - use nested routes for scenarios)
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    const { featureId } = await params;
    const body = await req.json();
    const { name, description, category, priority, isActive, version } = body;

    const feature = await prisma.bddFeature.update({
      where: { id: featureId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(priority !== undefined && { priority }),
        ...(isActive !== undefined && { isActive }),
        ...(version !== undefined && { version }),
      },
    });

    return NextResponse.json({ ok: true, feature });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json(
        { ok: false, error: "Feature not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update feature" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bdd-features/[featureId]
 * Delete a BDD feature and all nested data (cascades)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    const { featureId } = await params;

    await prisma.bddFeature.delete({
      where: { id: featureId },
    });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json(
        { ok: false, error: "Feature not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete feature" },
      { status: 500 }
    );
  }
}
