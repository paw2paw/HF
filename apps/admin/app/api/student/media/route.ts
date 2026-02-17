/**
 * @api GET /api/student/media
 * @auth STUDENT | OPERATOR+ (with callerId param)
 * @desc Returns all media shared with the student across their calls. Supports sort, order, and type filter.
 * @query sort - Sort field: date (default), name, type
 * @query order - Sort order: desc (default), asc
 * @query type - Filter by MIME type prefix: all (default), image, pdf, audio
 * @query callId - Optional call ID to filter to a single call
 * @response 200 { ok: true, media: SharedMediaItem[], total: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudentOrAdmin, isStudentAuthError } from "@/lib/student-access";

export async function GET(request: NextRequest) {
  const auth = await requireStudentOrAdmin(request);
  if (isStudentAuthError(auth)) return auth.error;

  const url = new URL(request.url);
  const sort = url.searchParams.get("sort") || "date";
  const order = url.searchParams.get("order") || "desc";
  const typeFilter = url.searchParams.get("type") || "all";
  const callIdFilter = url.searchParams.get("callId");

  // Build where clause
  const where: Record<string, unknown> = {
    mediaId: { not: null },
    call: { callerId: auth.callerId },
  };

  if (callIdFilter) {
    where.callId = callIdFilter;
  }

  if (typeFilter === "image") {
    where.media = { mimeType: { startsWith: "image/" } };
  } else if (typeFilter === "pdf") {
    where.media = { mimeType: "application/pdf" };
  } else if (typeFilter === "audio") {
    where.media = { mimeType: { startsWith: "audio/" } };
  }

  let orderBy: Record<string, unknown>;
  if (sort === "name") {
    orderBy = { media: { fileName: order as "asc" | "desc" } };
  } else if (sort === "type") {
    orderBy = { media: { mimeType: order as "asc" | "desc" } };
  } else {
    orderBy = { createdAt: order as "asc" | "desc" };
  }

  const messages = await prisma.callMessage.findMany({
    where,
    include: {
      media: {
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          title: true,
        },
      },
    },
    orderBy,
  });

  const media = messages
    .filter((m) => m.media)
    .map((m) => ({
      id: m.id,
      mediaId: m.media!.id,
      fileName: m.media!.fileName,
      mimeType: m.media!.mimeType,
      title: m.media!.title,
      content: m.content,
      sharedAt: m.createdAt,
      callId: m.callId,
      url: `/api/media/${m.media!.id}`,
    }));

  return NextResponse.json({ ok: true, media, total: media.length });
}
