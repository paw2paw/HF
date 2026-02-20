import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/content-sources/:sourceId/vocabulary
 * @visibility public
 * @scope content-sources:read
 * @auth session
 * @tags content-trust, vocabulary
 * @description List extracted vocabulary for a content source with filtering.
 * @pathParam sourceId string
 * @query topic string - Filter by topic
 * @query search string - Search term or definition (case-insensitive)
 * @query reviewed string - Filter by review status ("true" or "false")
 * @query limit number - Max results (default 50, max 500)
 * @query offset number - Pagination offset (default 0)
 * @response 200 { ok, vocabulary, total, reviewedCount, reviewProgress }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  const authResult = await requireAuth("VIEWER");
  if (isAuthError(authResult)) return authResult.error;

  const { sourceId } = await params;
  const { searchParams } = new URL(req.url);
  const topic = searchParams.get("topic");
  const search = searchParams.get("search");
  const reviewed = searchParams.get("reviewed");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 500);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  const where: any = { sourceId };
  if (topic) where.topic = topic;
  if (search) {
    where.OR = [
      { term: { contains: search, mode: "insensitive" } },
      { definition: { contains: search, mode: "insensitive" } },
    ];
  }
  if (reviewed === "true") where.reviewedAt = { not: null };
  else if (reviewed === "false") where.reviewedAt = null;

  const [vocabulary, total, reviewedCount] = await Promise.all([
    prisma.contentVocabulary.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { term: "asc" }],
      take: limit,
      skip: offset,
      include: {
        assertion: {
          select: { id: true, assertion: true, category: true },
        },
        reviewer: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.contentVocabulary.count({ where }),
    prisma.contentVocabulary.count({ where: { sourceId, reviewedAt: { not: null } } }),
  ]);

  const totalForSource = await prisma.contentVocabulary.count({ where: { sourceId } });
  const reviewProgress = totalForSource > 0 ? Math.round((reviewedCount / totalForSource) * 100) : 0;

  return NextResponse.json({ ok: true, vocabulary, total, reviewedCount, reviewProgress });
}

/**
 * @api DELETE /api/content-sources/:sourceId/vocabulary
 * @visibility public
 * @scope content-sources:write
 * @auth OPERATOR
 * @tags content-trust, vocabulary
 * @description Delete all vocabulary for a content source (for re-extraction).
 * @pathParam sourceId string
 * @response 200 { ok, deleted }
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;

  const { sourceId } = await params;

  const result = await prisma.contentVocabulary.deleteMany({
    where: { sourceId },
  });

  return NextResponse.json({ ok: true, deleted: result.count });
}
