import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/parameters/:id/prompts
 * Get all dynamic prompts linked to this parameter
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // First find the parameter to get its parameterId
    const parameter = await prisma.parameter.findUnique({
      where: { id },
      select: { parameterId: true }
    });

    if (!parameter) {
      return NextResponse.json(
        { ok: false, error: "Parameter not found" },
        { status: 404 }
      );
    }

    // Get all prompt slug links for this parameter
    const links = await prisma.promptSlugParameter.findMany({
      where: { parameterId: parameter.parameterId },
      include: {
        slug: {
          select: {
            id: true,
            slug: true,
            name: true,
            sourceType: true,
            isActive: true,
            description: true
          }
        }
      },
      orderBy: { sortOrder: "asc" }
    });

    // Get all available slugs that could be linked
    const allSlugs = await prisma.promptSlug.findMany({
      where: {
        sourceType: { in: ["PARAMETER", "COMPOSITE"] },
        isActive: true
      },
      select: {
        id: true,
        slug: true,
        name: true,
        sourceType: true,
        description: true
      },
      orderBy: { name: "asc" }
    });

    return NextResponse.json({
      ok: true,
      links,
      availableSlugs: allSlugs
    });
  } catch (error: any) {
    console.error("GET /api/parameters/[id]/prompts error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to fetch prompt links" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/parameters/:id/prompts
 * Attach a dynamic prompt to this parameter
 *
 * Body: { slugId: string, weight?: number, mode?: "ABSOLUTE" | "DELTA" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { slugId, weight = 1.0, mode = "ABSOLUTE" } = body;

    if (!slugId) {
      return NextResponse.json(
        { ok: false, error: "slugId is required" },
        { status: 400 }
      );
    }

    // Find the parameter
    const parameter = await prisma.parameter.findUnique({
      where: { id },
      select: { parameterId: true }
    });

    if (!parameter) {
      return NextResponse.json(
        { ok: false, error: "Parameter not found" },
        { status: 404 }
      );
    }

    // Check if the slug exists
    const slug = await prisma.promptSlug.findUnique({
      where: { id: slugId }
    });

    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "Dynamic prompt not found" },
        { status: 404 }
      );
    }

    // Get max sortOrder for this slug
    const maxOrder = await prisma.promptSlugParameter.aggregate({
      where: { slugId },
      _max: { sortOrder: true }
    });

    // Create the link
    const link = await prisma.promptSlugParameter.create({
      data: {
        slugId,
        parameterId: parameter.parameterId,
        weight,
        mode,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1
      },
      include: {
        slug: {
          select: {
            id: true,
            slug: true,
            name: true,
            sourceType: true,
            isActive: true
          }
        }
      }
    });

    return NextResponse.json({ ok: true, link });
  } catch (error: any) {
    // Check for unique constraint violation
    if (error.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "This dynamic prompt is already attached to this parameter" },
        { status: 400 }
      );
    }
    console.error("POST /api/parameters/[id]/prompts error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to attach prompt" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/parameters/:id/prompts?slugId=xxx
 * Detach a dynamic prompt from this parameter
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const slugId = searchParams.get("slugId");

    if (!slugId) {
      return NextResponse.json(
        { ok: false, error: "slugId query param is required" },
        { status: 400 }
      );
    }

    // Find the parameter
    const parameter = await prisma.parameter.findUnique({
      where: { id },
      select: { parameterId: true }
    });

    if (!parameter) {
      return NextResponse.json(
        { ok: false, error: "Parameter not found" },
        { status: 404 }
      );
    }

    // Find and delete the link
    const link = await prisma.promptSlugParameter.findFirst({
      where: {
        slugId,
        parameterId: parameter.parameterId
      }
    });

    if (!link) {
      return NextResponse.json(
        { ok: false, error: "Link not found" },
        { status: 404 }
      );
    }

    await prisma.promptSlugParameter.delete({
      where: { id: link.id }
    });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error: any) {
    console.error("DELETE /api/parameters/[id]/prompts error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to detach prompt" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/parameters/:id/prompts
 * Update link settings (weight, mode)
 *
 * Body: { slugId: string, weight?: number, mode?: "ABSOLUTE" | "DELTA" }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { slugId, weight, mode } = body;

    if (!slugId) {
      return NextResponse.json(
        { ok: false, error: "slugId is required" },
        { status: 400 }
      );
    }

    // Find the parameter
    const parameter = await prisma.parameter.findUnique({
      where: { id },
      select: { parameterId: true }
    });

    if (!parameter) {
      return NextResponse.json(
        { ok: false, error: "Parameter not found" },
        { status: 404 }
      );
    }

    // Find the link
    const link = await prisma.promptSlugParameter.findFirst({
      where: {
        slugId,
        parameterId: parameter.parameterId
      }
    });

    if (!link) {
      return NextResponse.json(
        { ok: false, error: "Link not found" },
        { status: 404 }
      );
    }

    // Update the link
    const updatedLink = await prisma.promptSlugParameter.update({
      where: { id: link.id },
      data: {
        ...(weight !== undefined && { weight }),
        ...(mode !== undefined && { mode })
      },
      include: {
        slug: {
          select: {
            id: true,
            slug: true,
            name: true,
            sourceType: true,
            isActive: true
          }
        }
      }
    });

    return NextResponse.json({ ok: true, link: updatedLink });
  } catch (error: any) {
    console.error("PATCH /api/parameters/[id]/prompts error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to update link" },
      { status: 500 }
    );
  }
}
