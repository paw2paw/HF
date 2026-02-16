import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api POST /api/content-sources/:sourceId/assertions/bulk-review
 * @visibility public
 * @scope content-sources:write
 * @auth session (OPERATOR+)
 * @tags content-trust
 * @description Mark multiple assertions as reviewed in a single transaction.
 *   All assertion IDs must belong to the specified source.
 * @body assertionIds string[] - Array of assertion IDs to mark as reviewed (max 100)
 * @response 200 { ok: true, updated: number }
 * @response 400 { ok: false, error: "..." }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const auth = await requireAuth("OPERATOR");
  if (isAuthError(auth)) return auth.error;

  const { sourceId } = await params;

  try {
    const body = await request.json();
    const { assertionIds } = body;

    if (!Array.isArray(assertionIds) || assertionIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "assertionIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (assertionIds.length > 100) {
      return NextResponse.json(
        { ok: false, error: "Maximum 100 assertions per bulk review request" },
        { status: 400 }
      );
    }

    // Verify all IDs belong to this source
    const matchCount = await prisma.contentAssertion.count({
      where: {
        id: { in: assertionIds },
        sourceId,
      },
    });

    if (matchCount !== assertionIds.length) {
      return NextResponse.json(
        { ok: false, error: `${assertionIds.length - matchCount} assertion(s) not found in this source` },
        { status: 400 }
      );
    }

    if (!auth.session.user?.id) {
      return NextResponse.json({ ok: false, error: "Session user ID missing" }, { status: 401 });
    }
    const userId = auth.session.user.id;
    const now = new Date();

    const result = await prisma.contentAssertion.updateMany({
      where: {
        id: { in: assertionIds },
        sourceId,
      },
      data: {
        reviewedBy: userId,
        reviewedAt: now,
      },
    });

    return NextResponse.json({ ok: true, updated: result.count });
  } catch (error: any) {
    console.error("[assertions/bulk-review] POST error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Bulk review failed" },
      { status: 500 }
    );
  }
}
