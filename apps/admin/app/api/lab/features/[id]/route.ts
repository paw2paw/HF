import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/lab/features/[id]
 *
 * Get a single feature set with all its data
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const feature = await prisma.bDDFeatureSet.findUnique({
      where: { id },
      include: {
        uploads: {
          select: {
            id: true,
            filename: true,
            fileType: true,
            status: true,
            name: true,
            uploadedAt: true,
          },
          orderBy: { uploadedAt: "desc" },
        },
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
            isActive: true,
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
 * DELETE /api/lab/features/[id]
 *
 * Delete a feature set
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
