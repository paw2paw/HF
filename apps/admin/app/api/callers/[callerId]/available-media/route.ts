import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * @api GET /api/callers/:callerId/available-media
 * @visibility internal
 * @scope callers:media:list
 * @auth session (VIEWER+)
 * @tags callers, media
 * @description Get all media assets available for sharing with a caller, based on their domain's linked subjects.
 * @response 200 { ok: true, media: MediaAsset[] }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ callerId: string }> }
) {
  const auth = await requireAuth("VIEWER");
  if (isAuthError(auth)) return auth.error;

  const { callerId } = await params;

  // Get caller's domain and its linked subjects
  const caller = await prisma.caller.findUnique({
    where: { id: callerId },
    select: {
      domain: {
        select: {
          subjects: {
            select: { subjectId: true },
          },
        },
      },
    },
  });

  if (!caller?.domain) {
    return NextResponse.json({ ok: true, media: [] });
  }

  const subjectIds = caller.domain.subjects.map((s) => s.subjectId);
  if (subjectIds.length === 0) {
    return NextResponse.json({ ok: true, media: [] });
  }

  // Get all media linked to these subjects
  const subjectMedia = await prisma.subjectMedia.findMany({
    where: { subjectId: { in: subjectIds } },
    include: {
      media: {
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          title: true,
          description: true,
          tags: true,
          trustLevel: true,
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  // Deduplicate (same media could be in multiple subjects)
  const seen = new Set<string>();
  const media = subjectMedia
    .filter((sm) => {
      if (seen.has(sm.media.id)) return false;
      seen.add(sm.media.id);
      return true;
    })
    .map((sm) => ({
      ...sm.media,
      url: `/api/media/${sm.media.id}`,
    }));

  return NextResponse.json({ ok: true, media });
}
