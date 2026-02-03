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
            storyId: true,
            name: true,
            version: true,
            uploadedAt: true,
          },
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

    // First unlink any uploads
    await prisma.bDDUpload.updateMany({
      where: { featureSetId: id },
      data: { featureSetId: null, status: "VALIDATED" },
    });

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
