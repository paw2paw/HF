import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api DELETE /api/content-sources/:sourceId/permanent
 * @visibility internal
 * @scope content-sources:delete
 * @auth session
 * @tags content-trust
 * @description Permanently delete an archived content source and all its children.
 * Source must be archived first (two-step safety). Cascades: assertions, questions,
 * vocabulary, subject links are deleted. Media assets and curriculum refs are nulled.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const authResult = await requireAuth("SUPERADMIN");
    if (isAuthError(authResult)) return authResult.error;

    const { sourceId } = await params;

    const source = await prisma.contentSource.findUnique({
      where: { id: sourceId },
      include: {
        _count: { select: { assertions: true, questions: true, vocabulary: true, mediaAssets: true } },
        subjects: { select: { subject: { select: { id: true, name: true } } } },
        curricula: { select: { id: true, slug: true } },
      },
    });

    if (!source) {
      return NextResponse.json({ ok: false, error: "Source not found" }, { status: 404 });
    }

    if (source.isActive || !source.archivedAt) {
      return NextResponse.json(
        { ok: false, error: "Source must be archived before permanent deletion. Archive it first via DELETE /api/content-sources/:id." },
        { status: 400 }
      );
    }

    const deletionSummary = {
      assertions: source._count.assertions,
      questions: source._count.questions,
      vocabulary: source._count.vocabulary,
      mediaAssetsOrphaned: source._count.mediaAssets,
      subjectLinksRemoved: source.subjects.length,
      curriculaUnlinked: source.curricula.length,
    };

    // Prisma cascade rules handle children automatically
    await prisma.contentSource.delete({ where: { id: sourceId } });

    return NextResponse.json({
      ok: true,
      message: "Content source permanently deleted",
      deleted: deletionSummary,
    });
  } catch (error: any) {
    console.error("[content-sources/:id/permanent] DELETE error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
