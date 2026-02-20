import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api POST /api/content-sources/:sourceId/questions/bulk-review
 * @visibility public
 * @scope content-sources:write
 * @auth session (OPERATOR+)
 * @tags content-trust, questions
 * @description Mark multiple questions as reviewed in a single transaction.
 *   All question IDs must belong to the specified source.
 * @body questionIds string[] - Array of question IDs to mark as reviewed (max 100)
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
    const { questionIds } = body;

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "questionIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (questionIds.length > 100) {
      return NextResponse.json(
        { ok: false, error: "Maximum 100 questions per bulk review request" },
        { status: 400 }
      );
    }

    // Verify all IDs belong to this source
    const matchCount = await prisma.contentQuestion.count({
      where: {
        id: { in: questionIds },
        sourceId,
      },
    });

    if (matchCount !== questionIds.length) {
      return NextResponse.json(
        { ok: false, error: `${questionIds.length - matchCount} question(s) not found in this source` },
        { status: 400 }
      );
    }

    if (!auth.session.user?.id) {
      return NextResponse.json({ ok: false, error: "Session user ID missing" }, { status: 401 });
    }
    const userId = auth.session.user.id;
    const now = new Date();

    const result = await prisma.contentQuestion.updateMany({
      where: {
        id: { in: questionIds },
        sourceId,
      },
      data: {
        reviewedBy: userId,
        reviewedAt: now,
      },
    });

    return NextResponse.json({ ok: true, updated: result.count });
  } catch (error: any) {
    console.error("[questions/bulk-review] POST error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Bulk review failed" },
      { status: 500 }
    );
  }
}
