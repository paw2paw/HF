/**
 * @api POST /api/playbooks/:playbookId/reset-mcqs
 * @auth OPERATOR+
 * @tags playbook, assessment
 * @desc Regenerate MCQ questions for the playbook's curriculum from assertions.
 *       Warns if callers have pre-test results that would be orphaned.
 *       Pass { force: true } to proceed despite existing results.
 * @body { force?: boolean }
 * @response 200 { ok, created, duplicatesSkipped }
 * @response 200 { ok: false, hasResults: true, affectedCallerCount }
 * @response 404 { ok: false, error: "..." }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { deleteQuestionsForSource } from "@/lib/content-trust/save-questions";
import { generateMcqsForSource } from "@/lib/assessment/generate-mcqs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ playbookId: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("OPERATOR");
  if (isAuthError(auth)) return auth.error;

  const { playbookId } = await params;
  const body = await req.json().catch(() => ({}));
  const force = body.force === true;

  // Resolve curriculum + primarySource
  const playbook = await prisma.playbook.findUnique({
    where: { id: playbookId },
    select: {
      curriculum: {
        select: {
          id: true,
          primarySourceId: true,
        },
      },
    },
  });

  if (!playbook?.curriculum?.primarySourceId) {
    return NextResponse.json(
      { ok: false, error: "No curriculum or primary source found" },
      { status: 404 },
    );
  }

  const sourceId = playbook.curriculum.primarySourceId;

  // Check if any enrolled callers have pre-test results
  if (!force) {
    const affectedCallerCount = await prisma.callerAttribute.count({
      where: {
        scope: "PRE_TEST",
        key: "question_ids",
        caller: {
          callerPlaybooks: {
            some: { playbookId, status: "ACTIVE" },
          },
        },
      },
    });

    if (affectedCallerCount > 0) {
      return NextResponse.json({
        ok: false,
        hasResults: true,
        affectedCallerCount,
        message: `${affectedCallerCount} student${affectedCallerCount !== 1 ? "s have" : " has"} completed pre-tests. Regenerating will invalidate their results for uplift comparison.`,
      });
    }
  }

  // Delete existing MCQs and regenerate
  const deleted = await deleteQuestionsForSource(sourceId);
  console.log(`[reset-mcqs] Deleted ${deleted} questions for source ${sourceId}`);

  const result = await generateMcqsForSource(sourceId, { userId: auth.userId });

  return NextResponse.json({
    ok: true,
    deleted,
    created: result.created,
    duplicatesSkipped: result.duplicatesSkipped,
    skipped: result.skipped,
    skipReason: result.skipReason,
  });
}
