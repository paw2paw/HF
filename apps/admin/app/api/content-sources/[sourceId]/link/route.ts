import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { linkContentForSource } from "@/lib/content-trust/link-content";

/**
 * @api POST /api/content-sources/:sourceId/link
 * @visibility internal
 * @scope content-sources:write
 * @auth OPERATOR
 * @tags content-trust, linking
 * @description Re-run question/vocabulary → assertion linking for a content source.
 *   Useful after embeddings complete or after changing linking thresholds in Settings.
 *   Non-destructive — only updates assertionId where currently NULL.
 *   Idempotent — safe to call multiple times.
 *
 * @pathParam sourceId string - ContentSource UUID
 *
 * @response 200 { ok, questionsLinked, questionsOrphaned, vocabularyLinked, vocabularyOrphaned, warnings }
 * @response 404 { ok: false, error }
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { sourceId } = await params;

    // Verify source exists
    const source = await prisma.contentSource.findUnique({
      where: { id: sourceId },
      select: { id: true, name: true },
    });

    if (!source) {
      return NextResponse.json({ ok: false, error: "Content source not found" }, { status: 404 });
    }

    const result = await linkContentForSource(sourceId);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error: any) {
    console.error("[content-sources/:id/link] POST error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Linking failed" },
      { status: 500 },
    );
  }
}
