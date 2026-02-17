import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/content-sources/:sourceId/assertions
 * @visibility public
 * @scope content-sources:read
 * @auth session
 * @tags content-trust
 * @description List assertions for a content source with optional filtering, sorting, and review status.
 * @pathParam sourceId string
 * @query category string - Filter by category (fact, definition, threshold, rule, process, example)
 * @query search string - Search assertion text (case-insensitive)
 * @query reviewed "true"|"false" - Filter by review status
 * @query sortBy "createdAt"|"reviewedAt"|"chapter"|"category" - Sort field (default: chapter)
 * @query sortDir "asc"|"desc" - Sort direction (default: asc)
 * @query limit number - Max results (default 50, max 500)
 * @query offset number - Pagination offset (default 0)
 * @response 200 { ok: true, assertions: ContentAssertion[], total: number, reviewed: number, reviewProgress: number }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { sourceId } = await params;
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const reviewed = searchParams.get("reviewed");
    const sortBy = searchParams.get("sortBy") || "chapter";
    const sortDir = (searchParams.get("sortDir") || "asc") as "asc" | "desc";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 500);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const where: any = { sourceId };
    if (category) where.category = category;
    if (search) where.assertion = { contains: search, mode: "insensitive" };
    if (reviewed === "true") where.reviewedAt = { not: null };
    if (reviewed === "false") where.reviewedAt = null;

    // Build sort order
    const orderBy: any[] = [];
    const validSortFields = ["createdAt", "reviewedAt", "chapter", "category"];
    if (validSortFields.includes(sortBy)) {
      orderBy.push({ [sortBy]: sortDir });
    }
    // Secondary sort for stability
    if (sortBy !== "createdAt") {
      orderBy.push({ createdAt: "asc" });
    }

    const [assertions, total, reviewedCount] = await Promise.all([
      prisma.contentAssertion.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: {
          _count: { select: { children: true } },
        },
      }),
      prisma.contentAssertion.count({ where }),
      prisma.contentAssertion.count({
        where: { sourceId, reviewedAt: { not: null } },
      }),
    ]);

    // Fetch reviewer names for assertions that have been reviewed
    const reviewerIds = [...new Set(
      assertions
        .map((a: any) => a.reviewedBy)
        .filter(Boolean)
    )];
    const reviewers = reviewerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: reviewerIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const reviewerMap = new Map(reviewers.map((r) => [r.id, r]));

    // Attach reviewer info to assertions
    const enriched = assertions.map((a: any) => ({
      ...a,
      reviewer: a.reviewedBy ? reviewerMap.get(a.reviewedBy) || null : null,
    }));

    const totalForSource = await prisma.contentAssertion.count({ where: { sourceId } });
    const reviewProgress = totalForSource > 0
      ? Math.round((reviewedCount / totalForSource) * 100)
      : 0;

    return NextResponse.json({
      ok: true,
      assertions: enriched,
      total,
      reviewed: reviewedCount,
      reviewProgress,
    });
  } catch (error: any) {
    console.error("[content-sources/:id/assertions] GET error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
