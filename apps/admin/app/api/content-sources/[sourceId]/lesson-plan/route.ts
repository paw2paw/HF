import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { generateLessonPlan } from "@/lib/content-trust/lesson-planner";

/**
 * @api POST /api/content-sources/:sourceId/lesson-plan
 * @visibility public
 * @scope content-sources:write
 * @auth OPERATOR
 * @tags content-trust, lesson-plan
 * @description Generate a lesson plan from a content source's assertions, questions, and vocabulary.
 * @pathParam sourceId string
 * @body sessionLength number - Target minutes per session (default 30)
 * @body includeAssessment boolean - Include assessment session (default true)
 * @body includeReview boolean - Include review session (default true)
 * @response 200 { ok, plan }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;

  const { sourceId } = await params;
  const body = await req.json().catch(() => ({}));

  const plan = await generateLessonPlan(sourceId, {
    sessionLength: body.sessionLength,
    includeAssessment: body.includeAssessment,
    includeReview: body.includeReview,
  });

  return NextResponse.json({ ok: true, plan });
}
