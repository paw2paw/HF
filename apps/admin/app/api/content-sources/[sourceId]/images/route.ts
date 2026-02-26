import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/content-sources/:sourceId/images
 * @visibility internal
 * @scope content-sources:read
 * @auth VIEWER
 * @tags content-sources, media
 * @description List extracted images for a content source. Returns MediaAsset records
 *   with mimeType image/*, ordered by pageNumber then positionIndex.
 * @pathParam sourceId string - ContentSource UUID
 * @response 200 { ok, images: Array<{ id, fileName, mimeType, figureRef, captionText, pageNumber, positionIndex, url }> }
 * @response 404 { ok: false, error: "Source not found" }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { sourceId } = await params;

    const source = await prisma.contentSource.findUnique({
      where: { id: sourceId },
      select: { id: true },
    });
    if (!source) {
      return NextResponse.json({ ok: false, error: "Source not found" }, { status: 404 });
    }

    const images = await prisma.mediaAsset.findMany({
      where: {
        sourceId,
        mimeType: { startsWith: "image/" },
      },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        figureRef: true,
        captionText: true,
        pageNumber: true,
        positionIndex: true,
        fileSize: true,
        createdAt: true,
        _count: { select: { assertionLinks: true } },
      },
      orderBy: [{ pageNumber: "asc" }, { positionIndex: "asc" }],
    });

    return NextResponse.json({
      ok: true,
      images: images.map((m) => ({
        id: m.id,
        fileName: m.fileName,
        mimeType: m.mimeType,
        figureRef: m.figureRef,
        captionText: m.captionText,
        pageNumber: m.pageNumber,
        positionIndex: m.positionIndex,
        fileSize: m.fileSize,
        linkedAssertionCount: m._count.assertionLinks,
        url: `/api/media/${m.id}?inline=1`,
        createdAt: m.createdAt,
      })),
    });
  } catch (error: unknown) {
    console.error("[content-sources/:id/images] GET error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load images" },
      { status: 500 },
    );
  }
}
