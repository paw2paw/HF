import { NextResponse } from "next/server";
import { checkCourseReadiness } from "@/lib/domain/course-readiness";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";

export const runtime = "nodejs";

/**
 * @api GET /api/domains/:domainId/course-readiness
 * @visibility public
 * @scope domains:read
 * @auth session
 * @tags domains, readiness, course, community
 * @description Check if a course or community is content-ready. Automatically selects the right readiness spec based on domain kind: COURSE-READY-001 for institutions, COMMUNITY-READY-001 for communities. Returns structured pass/fail results with action links.
 * @pathParam domainId string - The domain ID to check readiness for
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

    // Detect domain kind to select the right readiness spec
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      select: { kind: true },
    });
    const specSlug = domain?.kind === "COMMUNITY"
      ? config.specs.communityReady
      : config.specs.courseReady;

    const result = await checkCourseReadiness(
      { domainId, callerId, sourceId, subjectId },
      specSlug,
    );

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
