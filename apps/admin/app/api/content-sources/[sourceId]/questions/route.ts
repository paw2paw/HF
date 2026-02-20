import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/content-sources/:sourceId/questions
 * @visibility public
 * @scope content-sources:read
 * @auth session
 * @tags content-trust, questions
 * @description List extracted questions for a content source with filtering.
 * @pathParam sourceId string
 * @query questionType string - Filter by type (MCQ, TRUE_FALSE, MATCHING, etc.)
 * @query search string - Search question text (case-insensitive)
 * @query reviewed string - Filter by review status ("true" or "false")
 * @query limit number - Max results (default 50, max 500)
 * @query offset number - Pagination offset (default 0)
 * @response 200 { ok, questions, total, reviewedCount, reviewProgress }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  const authResult = await requireAuth("VIEWER");
  if (isAuthError(authResult)) return authResult.error;

  const { sourceId } = await params;
  const { searchParams } = new URL(req.url);
  const questionType = searchParams.get("questionType");
  const search = searchParams.get("search");
  const reviewed = searchParams.get("reviewed");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 500);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  const where: any = { sourceId };
  if (questionType) where.questionType = questionType;
  if (search) where.questionText = { contains: search, mode: "insensitive" };
  if (reviewed === "true") where.reviewedAt = { not: null };
  else if (reviewed === "false") where.reviewedAt = null;

  const [questions, total, reviewedCount] = await Promise.all([
    prisma.contentQuestion.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
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
    prisma.contentQuestion.count({ where }),
    prisma.contentQuestion.count({ where: { sourceId, reviewedAt: { not: null } } }),
  ]);

  const totalForSource = await prisma.contentQuestion.count({ where: { sourceId } });
  const reviewProgress = totalForSource > 0 ? Math.round((reviewedCount / totalForSource) * 100) : 0;

  return NextResponse.json({ ok: true, questions, total, reviewedCount, reviewProgress });
}

/**
 * @api DELETE /api/content-sources/:sourceId/questions
 * @visibility public
 * @scope content-sources:write
 * @auth OPERATOR
 * @tags content-trust, questions
 * @description Delete all questions for a content source (for re-extraction).
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

  const result = await prisma.contentQuestion.deleteMany({
    where: { sourceId },
  });

  return NextResponse.json({ ok: true, deleted: result.count });
}
