import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/lab/features/:id
 * @visibility internal
 * @scope lab:read
 * @auth session
 * @tags lab
 * @description Get a single BDD feature set with all related data (specs, parameters, prompt slugs, anchors)
 * @pathParam id string - Feature set ID
 * @response 200 { ok: true, feature: BDDFeatureSet }
 * @response 404 { ok: false, error: "Feature set not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { id } = await params;

    const feature = await prisma.bDDFeatureSet.findUnique({
      where: { id },
      include: {
        // Created entities (provenance tracking)
        createdSpecs: {
          select: {
            id: true,
            slug: true,
            name: true,
            outputType: true,
            specType: true,
            scope: true,
            isActive: true,
          },
          orderBy: { name: "asc" },
        },
        createdParameters: {
          select: {
            parameterId: true,
            name: true,
            domainGroup: true,
          },
          orderBy: { parameterId: "asc" },
        },
        createdPromptSlugs: {
          select: {
            id: true,
            slug: true,
            name: true,
            sourceType: true,
            isActive: true,
          },
          orderBy: { name: "asc" },
        },
        createdAnchors: {
          select: {
            id: true,
            parameterId: true,
            score: true,
            example: true,
          },
          orderBy: { parameterId: "asc" },
        },
      },
    });

    if (!feature) {
      return NextResponse.json(
        { ok: false, error: "Feature set not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, feature });
  } catch (error: any) {
    console.error("Error fetching feature set:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch feature set" },
      { status: 500 }
    );
  }
}

/**
 * @api DELETE /api/lab/features/:id
 * @visibility internal
 * @scope lab:write
 * @auth session
 * @tags lab
 * @description Delete a BDD feature set by ID
 * @pathParam id string - Feature set ID
 * @response 200 { ok: true }
 * @response 500 { ok: false, error: "..." }
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { id } = await params;

    // Delete the feature set
    await prisma.bDDFeatureSet.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error deleting feature set:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete feature set" },
      { status: 500 }
    );
  }
}
