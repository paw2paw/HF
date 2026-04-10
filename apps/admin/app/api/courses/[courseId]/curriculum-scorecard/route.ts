import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { computeCourseLinkageScorecard } from "@/lib/content-trust/validate-lo-linkage";

type Params = { params: Promise<{ courseId: string }> };

/**
 * @api GET /api/courses/:courseId/curriculum-scorecard
 * @visibility internal
 * @scope courses:read
 * @auth session (VIEWER+)
 * @tags courses, curriculum, content-trust
 * @description Returns LO linkage health for a course — assertion coverage,
 *   FK coverage, garbage description count, orphan LOs, question linkage, and
 *   human-readable warnings. Used by the Curriculum tab (epic #131 #138) to
 *   render a data-quality banner above the module list, and shared with the
 *   one-time repair script as its before/after measurement.
 * @pathParam courseId string - Playbook UUID
 * @response 200 { ok, scorecard }
 * @response 404 { ok: false, error: "Course not found" }
 */
export async function GET(
  _req: NextRequest,
  { params }: Params,
): Promise<NextResponse> {
  try {
    const auth = await requireAuth("VIEWER");
    if (isAuthError(auth)) return auth.error;

    const { courseId } = await params;
    const scorecard = await computeCourseLinkageScorecard(courseId);
    if (!scorecard) {
      return NextResponse.json(
        { ok: false, error: "Course not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, scorecard });
  } catch (error) {
    console.error("[courses/:id/curriculum-scorecard] GET error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
