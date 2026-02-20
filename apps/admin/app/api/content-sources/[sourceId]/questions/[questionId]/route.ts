import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

const VALID_QUESTION_TYPES = [
  "MCQ", "TRUE_FALSE", "SHORT_ANSWER", "MATCHING", "FILL_IN_BLANK",
  "ORDERING", "OPEN", "CALCULATION", "CASE_STUDY", "ESSAY",
];

/**
 * @api PATCH /api/content-sources/:sourceId/questions/:questionId
 * @visibility public
 * @scope content-sources:write
 * @auth session (OPERATOR+)
 * @tags content-trust, questions
 * @description Update an individual content question. Can modify text, type, answer, options,
 *   difficulty, and review status. When markReviewed is true, sets reviewedBy and reviewedAt.
 * @body questionText string - Updated question text (5-5000 chars)
 * @body questionType string - Question type enum
 * @body correctAnswer string|null - Correct answer
 * @body answerExplanation string|null - Explanation of the answer
 * @body options object|null - Answer options (for MCQ etc.)
 * @body markScheme string|null - Mark scheme text
 * @body difficulty number|null - Difficulty 1-5
 * @body tags string[] - Tag array
 * @body chapter string|null - Chapter reference
 * @body pageRef string|null - Page reference
 * @body learningOutcomeRef string|null - Learning outcome reference
 * @body markReviewed boolean - When true, sets reviewedBy/reviewedAt from session
 * @response 200 { ok: true, question: ContentQuestion }
 * @response 400 { ok: false, error: "..." }
 * @response 404 { ok: false, error: "Question not found" }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string; questionId: string }> }
) {
  const auth = await requireAuth("OPERATOR");
  if (isAuthError(auth)) return auth.error;

  const { sourceId, questionId } = await params;

  try {
    const existing = await prisma.contentQuestion.findUnique({
      where: { id: questionId },
    });

    if (!existing || existing.sourceId !== sourceId) {
      return NextResponse.json(
        { ok: false, error: "Question not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updates: Record<string, any> = {};

    if (body.questionText !== undefined) {
      const text = String(body.questionText).trim();
      if (text.length < 5 || text.length > 5000) {
        return NextResponse.json(
          { ok: false, error: "Question text must be 5-5000 characters" },
          { status: 400 }
        );
      }
      updates.questionText = text;
    }

    if (body.questionType !== undefined) {
      if (!VALID_QUESTION_TYPES.includes(body.questionType)) {
        return NextResponse.json(
          { ok: false, error: `Invalid questionType. Must be one of: ${VALID_QUESTION_TYPES.join(", ")}` },
          { status: 400 }
        );
      }
      updates.questionType = body.questionType;
    }

    if (body.correctAnswer !== undefined) updates.correctAnswer = body.correctAnswer || null;
    if (body.answerExplanation !== undefined) updates.answerExplanation = body.answerExplanation || null;
    if (body.options !== undefined) updates.options = body.options;
    if (body.markScheme !== undefined) updates.markScheme = body.markScheme || null;
    if (body.chapter !== undefined) updates.chapter = body.chapter || null;
    if (body.pageRef !== undefined) updates.pageRef = body.pageRef || null;
    if (body.learningOutcomeRef !== undefined) updates.learningOutcomeRef = body.learningOutcomeRef || null;

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

    const updated = await prisma.contentQuestion.update({
      where: { id: questionId },
      data: updates,
    });

    return NextResponse.json({ ok: true, question: updated });
  } catch (error: any) {
    console.error("[questions/:id] PATCH error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Update failed" },
      { status: 500 }
    );
  }
}

/**
 * @api DELETE /api/content-sources/:sourceId/questions/:questionId
 * @visibility public
 * @scope content-sources:delete
 * @auth session (ADMIN+)
 * @tags content-trust, questions
 * @description Delete an individual content question.
 * @response 200 { ok: true, deleted: { id: string } }
 * @response 404 { ok: false, error: "Question not found" }
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sourceId: string; questionId: string }> }
) {
  const auth = await requireAuth("ADMIN");
  if (isAuthError(auth)) return auth.error;

  const { sourceId, questionId } = await params;

  try {
    const existing = await prisma.contentQuestion.findUnique({
      where: { id: questionId },
    });

    if (!existing || existing.sourceId !== sourceId) {
      return NextResponse.json(
        { ok: false, error: "Question not found" },
        { status: 404 }
      );
    }

    await prisma.contentQuestion.delete({ where: { id: questionId } });

    return NextResponse.json({ ok: true, deleted: { id: questionId } });
  } catch (error: any) {
    console.error("[questions/:id] DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Delete failed" },
      { status: 500 }
    );
  }
}
