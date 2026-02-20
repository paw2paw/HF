import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api POST /api/content-sources/:sourceId/vocabulary/bulk-review
 * @visibility public
 * @scope content-sources:write
 * @auth session (OPERATOR+)
 * @tags content-trust, vocabulary
 * @description Mark multiple vocabulary entries as reviewed in a single transaction.
 *   All vocabulary IDs must belong to the specified source.
 * @body vocabularyIds string[] - Array of vocabulary IDs to mark as reviewed (max 100)
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
    const { vocabularyIds } = body;

    if (!Array.isArray(vocabularyIds) || vocabularyIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "vocabularyIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (vocabularyIds.length > 100) {
      return NextResponse.json(
        { ok: false, error: "Maximum 100 vocabulary entries per bulk review request" },
        { status: 400 }
      );
    }

    // Verify all IDs belong to this source
    const matchCount = await prisma.contentVocabulary.count({
      where: {
        id: { in: vocabularyIds },
        sourceId,
      },
    });

    if (matchCount !== vocabularyIds.length) {
      return NextResponse.json(
        { ok: false, error: `${vocabularyIds.length - matchCount} vocabulary entry/entries not found in this source` },
        { status: 400 }
      );
    }

    if (!auth.session.user?.id) {
      return NextResponse.json({ ok: false, error: "Session user ID missing" }, { status: 401 });
    }
    const userId = auth.session.user.id;
    const now = new Date();

    const result = await prisma.contentVocabulary.updateMany({
      where: {
        id: { in: vocabularyIds },
        sourceId,
      },
      data: {
        reviewedBy: userId,
        reviewedAt: now,
      },
    });

    return NextResponse.json({ ok: true, updated: result.count });
  } catch (error: any) {
    console.error("[vocabulary/bulk-review] POST error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Bulk review failed" },
      { status: 500 }
    );
  }
}
