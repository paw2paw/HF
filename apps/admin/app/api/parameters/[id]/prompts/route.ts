import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/parameters/:id/prompts
 * @visibility public
 * @scope parameters:read
 * @auth session
 * @tags parameters
 * @description Get all dynamic prompt slugs linked to this parameter, plus available slugs that could be linked
 * @pathParam id string - Parameter UUID
 * @response 200 { ok: true, links: PromptSlugParameter[], availableSlugs: PromptSlug[] }
 * @response 404 { ok: false, error: "Parameter not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

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
 * @api POST /api/parameters/:id/prompts
 * @visibility public
 * @scope parameters:write
 * @auth session
 * @tags parameters
 * @description Attach a dynamic prompt slug to this parameter
 * @pathParam id string - Parameter UUID
 * @body slugId string - The prompt slug UUID to attach (required)
 * @body weight number - Link weight (default: 1.0)
 * @body mode string - "ABSOLUTE" or "DELTA" (default: "ABSOLUTE")
 * @response 200 { ok: true, link: PromptSlugParameter }
 * @response 400 { ok: false, error: "slugId is required" }
 * @response 400 { ok: false, error: "This dynamic prompt is already attached..." }
 * @response 404 { ok: false, error: "Parameter not found" }
 * @response 404 { ok: false, error: "Dynamic prompt not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

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
 * @api DELETE /api/parameters/:id/prompts
 * @visibility public
 * @scope parameters:write
 * @auth session
 * @tags parameters
 * @description Detach a dynamic prompt slug from this parameter
 * @pathParam id string - Parameter UUID
 * @query slugId string - The prompt slug UUID to detach (required)
 * @response 200 { ok: true, deleted: true }
 * @response 400 { ok: false, error: "slugId query param is required" }
 * @response 404 { ok: false, error: "Parameter not found" }
 * @response 404 { ok: false, error: "Link not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

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
 * @api PATCH /api/parameters/:id/prompts
 * @visibility public
 * @scope parameters:write
 * @auth session
 * @tags parameters
 * @description Update a prompt-parameter link's weight or mode
 * @pathParam id string - Parameter UUID
 * @body slugId string - The prompt slug UUID to update (required)
 * @body weight number - Updated link weight
 * @body mode string - "ABSOLUTE" or "DELTA"
 * @response 200 { ok: true, link: PromptSlugParameter }
 * @response 400 { ok: false, error: "slugId is required" }
 * @response 404 { ok: false, error: "Parameter not found" }
 * @response 404 { ok: false, error: "Link not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

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
