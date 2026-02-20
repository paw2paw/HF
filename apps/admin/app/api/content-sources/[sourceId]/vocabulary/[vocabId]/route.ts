import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api PATCH /api/content-sources/:sourceId/vocabulary/:vocabId
 * @visibility public
 * @scope content-sources:write
 * @auth session (OPERATOR+)
 * @tags content-trust, vocabulary
 * @description Update an individual vocabulary entry. Can modify term, definition, part of speech,
 *   topic, and review status. When markReviewed is true, sets reviewedBy and reviewedAt.
 * @body term string - Updated term (1-500 chars)
 * @body definition string - Updated definition (1-5000 chars)
 * @body partOfSpeech string|null - Part of speech
 * @body topic string|null - Topic category
 * @body exampleUsage string|null - Example sentence
 * @body pronunciation string|null - Pronunciation guide
 * @body difficulty number|null - Difficulty 1-5
 * @body tags string[] - Tag array
 * @body chapter string|null - Chapter reference
 * @body pageRef string|null - Page reference
 * @body markReviewed boolean - When true, sets reviewedBy/reviewedAt from session
 * @response 200 { ok: true, vocabulary: ContentVocabulary }
 * @response 400 { ok: false, error: "..." }
 * @response 404 { ok: false, error: "Vocabulary entry not found" }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string; vocabId: string }> }
) {
  const auth = await requireAuth("OPERATOR");
  if (isAuthError(auth)) return auth.error;

  const { sourceId, vocabId } = await params;

  try {
    const existing = await prisma.contentVocabulary.findUnique({
      where: { id: vocabId },
    });

    if (!existing || existing.sourceId !== sourceId) {
      return NextResponse.json(
        { ok: false, error: "Vocabulary entry not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updates: Record<string, any> = {};

    if (body.term !== undefined) {
      const term = String(body.term).trim();
      if (term.length < 1 || term.length > 500) {
        return NextResponse.json(
          { ok: false, error: "Term must be 1-500 characters" },
          { status: 400 }
        );
      }
      updates.term = term;
    }

    if (body.definition !== undefined) {
      const def = String(body.definition).trim();
      if (def.length < 1 || def.length > 5000) {
        return NextResponse.json(
          { ok: false, error: "Definition must be 1-5000 characters" },
          { status: 400 }
        );
      }
      updates.definition = def;
    }

    if (body.partOfSpeech !== undefined) updates.partOfSpeech = body.partOfSpeech || null;
    if (body.topic !== undefined) updates.topic = body.topic || null;
    if (body.exampleUsage !== undefined) updates.exampleUsage = body.exampleUsage || null;
    if (body.pronunciation !== undefined) updates.pronunciation = body.pronunciation || null;
    if (body.chapter !== undefined) updates.chapter = body.chapter || null;
    if (body.pageRef !== undefined) updates.pageRef = body.pageRef || null;

    if (body.difficulty !== undefined) {
      if (body.difficulty !== null) {
        const val = Number(body.difficulty);
        if (isNaN(val) || val < 1 || val > 5 || !Number.isInteger(val)) {
          return NextResponse.json(
            { ok: false, error: "difficulty must be an integer between 1 and 5" },
            { status: 400 }
          );
        }
        updates.difficulty = val;
      } else {
        updates.difficulty = null;
      }
    }

    if (body.tags !== undefined) {
      if (!Array.isArray(body.tags)) {
        return NextResponse.json(
          { ok: false, error: "Tags must be an array" },
          { status: 400 }
        );
      }
      updates.tags = body.tags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 20);
    }

    // Mark as reviewed
    if (body.markReviewed) {
      if (!auth.session.user?.id) {
        return NextResponse.json({ ok: false, error: "Session user ID missing" }, { status: 401 });
      }
      updates.reviewedBy = auth.session.user.id;
      updates.reviewedAt = new Date();
    }

    const updated = await prisma.contentVocabulary.update({
      where: { id: vocabId },
      data: updates,
    });

    return NextResponse.json({ ok: true, vocabulary: updated });
  } catch (error: any) {
    console.error("[vocabulary/:id] PATCH error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Update failed" },
      { status: 500 }
    );
  }
}

/**
 * @api DELETE /api/content-sources/:sourceId/vocabulary/:vocabId
 * @visibility public
 * @scope content-sources:delete
 * @auth session (ADMIN+)
 * @tags content-trust, vocabulary
 * @description Delete an individual vocabulary entry.
 * @response 200 { ok: true, deleted: { id: string } }
 * @response 404 { ok: false, error: "Vocabulary entry not found" }
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sourceId: string; vocabId: string }> }
) {
  const auth = await requireAuth("ADMIN");
  if (isAuthError(auth)) return auth.error;

  const { sourceId, vocabId } = await params;

  try {
    const existing = await prisma.contentVocabulary.findUnique({
      where: { id: vocabId },
    });

    if (!existing || existing.sourceId !== sourceId) {
      return NextResponse.json(
        { ok: false, error: "Vocabulary entry not found" },
        { status: 404 }
      );
    }

    await prisma.contentVocabulary.delete({ where: { id: vocabId } });

    return NextResponse.json({ ok: true, deleted: { id: vocabId } });
  } catch (error: any) {
    console.error("[vocabulary/:id] DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Delete failed" },
      { status: 500 }
    );
  }
}
