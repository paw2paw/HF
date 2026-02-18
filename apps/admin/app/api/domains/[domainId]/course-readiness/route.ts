import { NextResponse } from "next/server";
import { checkCourseReadiness } from "@/lib/domain/course-readiness";
import { requireAuth, isAuthError } from "@/lib/permissions";

export const runtime = "nodejs";

/**
 * @api GET /api/domains/:domainId/course-readiness
 * @visibility public
 * @scope domains:read
 * @auth session
 * @tags domains, readiness, course
 * @description Check if a course is content-ready for its first lesson. Evaluates checks defined in COURSE-READY-001 ORCHESTRATE spec. Returns structured pass/fail results with action links.
 * @pathParam domainId string - The domain ID to check course readiness for
 * @queryParam callerId string - Test caller ID (for prompt composition check)
 * @queryParam sourceId string - Content source ID (for assertion review link)
 * @queryParam subjectId string - Subject ID (for lesson plan link)
 * @response 200 { ok: true, domainId, ready, score, level, checks[], criticalPassed, criticalTotal, recommendedPassed, recommendedTotal }
 * @response 500 { ok: false, error: string }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ domainId: string }> },
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { domainId } = await params;
    const url = new URL(request.url);
    const callerId = url.searchParams.get("callerId") || undefined;
    const sourceId = url.searchParams.get("sourceId") || undefined;
    const subjectId = url.searchParams.get("subjectId") || undefined;

    const result = await checkCourseReadiness({
      domainId,
      callerId,
      sourceId,
      subjectId,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
}
