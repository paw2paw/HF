import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/domains/:domainId/content-categories
 * @visibility internal
 * @scope domains:read
 * @auth VIEWER
 * @tags domains, content-trust
 * @description Returns assertion counts grouped by category, plus question and vocabulary
 *   counts for a domain's content. Used by the Teach wizard to show content group review.
 * @pathParam domainId string - Domain UUID
 * @query subjectIds string - Comma-separated subject IDs to scope results
 * @response 200 { ok, categories: Array<{ category, count }>, total, questions: Array<{ questionType, count }>, vocabularyCount }
 * @response 404 { ok: false, error: "Domain not found" }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ domainId: string }> }
) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { domainId } = await params;
    const { searchParams } = new URL(req.url);
    const subjectIdsParam = searchParams.get("subjectIds");
    const subjectIds = subjectIdsParam ? subjectIdsParam.split(",").filter(Boolean) : undefined;

    // Verify domain exists
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      select: { id: true },
    });
    if (!domain) {
      return NextResponse.json({ ok: false, error: "Domain not found" }, { status: 404 });
    }

    // Build subject filter
    const subjectFilter = subjectIds?.length
      ? { subject: { id: { in: subjectIds }, domains: { some: { domainId } } } }
      : { subject: { domains: { some: { domainId } } } };

    // Get sources linked to this domain
    const sources = await prisma.contentSource.findMany({
      where: { subjects: { some: subjectFilter } },
      select: { id: true },
    });
    const sourceIds = sources.map((s) => s.id);

    if (sourceIds.length === 0) {
      return NextResponse.json({ ok: true, categories: [], total: 0, questions: [], vocabularyCount: 0, mediaCount: 0 });
    }

    // Group assertions by category
    const grouped = await prisma.contentAssertion.groupBy({
      by: ["category"],
      where: { sourceId: { in: sourceIds } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    const categories = grouped.map((g) => ({
      category: g.category,
      count: g._count.id,
    }));

    const total = categories.reduce((sum, c) => sum + c.count, 0);

    // Question counts grouped by questionType
    const questionGrouped = await prisma.contentQuestion.groupBy({
      by: ["questionType"],
      where: { sourceId: { in: sourceIds } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    const questions = questionGrouped.map((g) => ({
      questionType: g.questionType,
      count: g._count.id,
    }));

    // Total vocabulary count
    const vocabularyCount = await prisma.contentVocabulary.count({
      where: { sourceId: { in: sourceIds } },
    });

    // Extracted image count (visual aids)
    const mediaCount = await prisma.mediaAsset.count({
      where: { sourceId: { in: sourceIds }, mimeType: { startsWith: "image/" }, extractedFrom: { not: null } },
    });

    return NextResponse.json({ ok: true, categories, total, questions, vocabularyCount, mediaCount });
  } catch (error: unknown) {
    console.error("[domains/:id/content-categories] GET error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load categories" },
      { status: 500 }
    );
  }
}
