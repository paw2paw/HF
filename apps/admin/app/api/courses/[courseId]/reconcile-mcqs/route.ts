import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { reconcileQuestionAssertions } from "@/lib/content-trust/reconcile-question-linkage";

/**
 * @api POST /api/courses/:courseId/reconcile-mcqs
 * @visibility internal
 * @scope courses:write
 * @auth OPERATOR
 * @tags courses, content-trust, questions
 * @description Run the AI retag pass for orphan MCQs on this course. Issue
 *   #163 Phase 2 — extends the same child→parent linkage utility used by the
 *   assertion→LO reconciler to ContentQuestion→ContentAssertion.
 *   Rate-limited: 60s in-memory cooldown per courseId to prevent hot-loops.
 * @pathParam courseId string
 * @response 200 { ok, scanned, matched, unmatched, invalidRefs }
 * @response 429 { ok: false, error, retryAfter }
 */

const COOLDOWN_MS = 60_000;
const lastRunByCourse = new Map<string, number>();

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const auth = await requireAuth("OPERATOR");
    if (isAuthError(auth)) return auth.error;

    const { courseId } = await params;

    const now = Date.now();
    const lastRun = lastRunByCourse.get(courseId);
    if (lastRun && now - lastRun < COOLDOWN_MS) {
      const retryAfter = Math.ceil((COOLDOWN_MS - (now - lastRun)) / 1000);
      return NextResponse.json(
        {
          ok: false,
          error: "MCQ reconcile recently ran for this course",
          retryAfter,
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    lastRunByCourse.set(courseId, now);

    const result = await reconcileQuestionAssertions(courseId);

    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      matched: result.matched,
      unmatched: result.unmatched,
      invalidRefs: result.invalidRefs,
    });
  } catch (err: any) {
    console.error("[reconcile-mcqs] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Internal error" },
      { status: 500 },
    );
  }
}
