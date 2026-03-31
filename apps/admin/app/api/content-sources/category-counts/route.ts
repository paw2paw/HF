import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/content-sources/category-counts
 * @visibility internal
 * @scope content-sources:read
 * @auth VIEWER
 * @tags content-trust, extraction
 * @description Returns assertion counts grouped by category for given content sources.
 *
 * @query ids string — comma-separated ContentSource UUIDs (max 50)
 *
 * @response 200 { ok: true, categoryCounts: Record<string, number> }
 */

const MAX_IDS = 50;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth("VIEWER");
  if (isAuthError(auth)) return auth.error;

  const idsParam = req.nextUrl.searchParams.get("ids");
  if (!idsParam) {
    return NextResponse.json({ ok: false, error: "ids parameter required" }, { status: 400 });
  }

  const ids = idsParam.split(",").filter(Boolean).slice(0, MAX_IDS);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, categoryCounts: {} });
  }

  const groups = await prisma.contentAssertion.groupBy({
    by: ["category"],
    where: { sourceId: { in: ids } },
    _count: { id: true },
  });

  const categoryCounts: Record<string, number> = {};
  for (const g of groups) {
    if (g.category) categoryCounts[g.category] = g._count.id;
  }

  return NextResponse.json({ ok: true, categoryCounts });
}
