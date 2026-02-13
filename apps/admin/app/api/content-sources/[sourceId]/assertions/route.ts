import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/content-sources/:sourceId/assertions
 * @visibility public
 * @scope content-sources:read
 * @auth session
 * @tags content-trust
 * @description List assertions for a content source with optional filtering
 * @pathParam sourceId string
 * @query category string - Filter by category (fact, definition, threshold, rule, process, example)
 * @query search string - Search assertion text
 * @query limit number - Max results (default 100)
 * @query offset number - Pagination offset (default 0)
 * @response 200 { ok: true, assertions: ContentAssertion[], total: number }
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
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const where: any = { sourceId };
    if (category) where.category = category;
    if (search) where.assertion = { contains: search, mode: "insensitive" };

    const [assertions, total] = await Promise.all([
      prisma.contentAssertion.findMany({
        where,
        orderBy: [{ chapter: "asc" }, { section: "asc" }, { createdAt: "asc" }],
        take: limit,
        skip: offset,
      }),
      prisma.contentAssertion.count({ where }),
    ]);

    return NextResponse.json({ ok: true, assertions, total });
  } catch (error: any) {
    console.error("[content-sources/:id/assertions] GET error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
