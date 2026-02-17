import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * @api GET /api/subjects/:subjectId/media
 * @visibility internal
 * @scope subjects:media:list
 * @auth session (VIEWER+)
 * @tags media, subjects
 * @description List all media assets linked to a subject's content library. Supports pagination and type filtering.
 * @query type string - Filter by MIME type prefix (e.g. "image", "audio", "application/pdf")
 * @query limit number - Max results (default: 50)
 * @query offset number - Pagination offset (default: 0)
 * @response 200 { ok: true, media: MediaAsset[], total: number }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subjectId: string }> }
) {
  const auth = await requireAuth("VIEWER");
  if (isAuthError(auth)) return auth.error;

  const { subjectId } = await params;
  const { searchParams } = request.nextUrl;
  const typeFilter = searchParams.get("type");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");

  // Verify subject exists
  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true } });
  if (!subject) {
    return NextResponse.json({ ok: false, error: "Subject not found" }, { status: 404 });
  }

  const where: any = { subjectId };
  if (typeFilter) {
    where.media = { mimeType: { startsWith: typeFilter } };
  }

  const [items, total] = await Promise.all([
    prisma.subjectMedia.findMany({
      where,
      include: {
        media: {
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            title: true,
            description: true,
            tags: true,
            trustLevel: true,
            createdAt: true,
          },
        },
      },
      orderBy: { sortOrder: "asc" },
      skip: offset,
      take: limit,
    }),
    prisma.subjectMedia.count({ where: { subjectId } }),
  ]);

  const media = items.map((item) => ({
    ...item.media,
    subjectMediaId: item.id,
    sortOrder: item.sortOrder,
    url: `/api/media/${item.media.id}`,
  }));

  return NextResponse.json({ ok: true, media, total });
}

/**
 * @api POST /api/subjects/:subjectId/media
 * @visibility internal
 * @scope subjects:media:link
 * @auth session (OPERATOR+)
 * @tags media, subjects
 * @description Link an existing media asset to a subject, or update sort order.
 * @body mediaId string - ID of the MediaAsset to link
 * @body sortOrder number - Optional sort order (default: 0)
 * @response 200 { ok: true, link: SubjectMedia }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subjectId: string }> }
) {
  const auth = await requireAuth("OPERATOR");
  if (isAuthError(auth)) return auth.error;

  const { subjectId } = await params;
  const body = await request.json();
  const { mediaId, sortOrder = 0 } = body;

  if (!mediaId) {
    return NextResponse.json({ ok: false, error: "mediaId is required" }, { status: 400 });
  }

  // Verify both exist
  const [subject, media] = await Promise.all([
    prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true } }),
    prisma.mediaAsset.findUnique({ where: { id: mediaId }, select: { id: true } }),
  ]);

  if (!subject) {
    return NextResponse.json({ ok: false, error: "Subject not found" }, { status: 404 });
  }
  if (!media) {
    return NextResponse.json({ ok: false, error: "Media asset not found" }, { status: 404 });
  }

  const link = await prisma.subjectMedia.upsert({
    where: { subjectId_mediaId: { subjectId, mediaId } },
    update: { sortOrder },
    create: { subjectId, mediaId, sortOrder },
  });

  return NextResponse.json({ ok: true, link });
}

/**
 * @api DELETE /api/subjects/:subjectId/media
 * @visibility internal
 * @scope subjects:media:unlink
 * @auth session (OPERATOR+)
 * @tags media, subjects
 * @description Unlink a media asset from a subject's content library.
 * @body mediaId string - ID of the MediaAsset to unlink
 * @response 200 { ok: true }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ subjectId: string }> }
) {
  const auth = await requireAuth("OPERATOR");
  if (isAuthError(auth)) return auth.error;

  const { subjectId } = await params;
  const body = await request.json();
  const { mediaId } = body;

  if (!mediaId) {
    return NextResponse.json({ ok: false, error: "mediaId is required" }, { status: 400 });
  }

  await prisma.subjectMedia.deleteMany({
    where: { subjectId, mediaId },
  });

  return NextResponse.json({ ok: true });
}
