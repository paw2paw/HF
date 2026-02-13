import { NextResponse } from "next/server";
import { checkDomainReadiness } from "@/lib/domain/readiness";
import { requireAuth, isAuthError } from "@/lib/permissions";

export const runtime = "nodejs";

/**
 * @api GET /api/domains/:domainId/readiness
 * @visibility public
 * @scope domains:read
 * @auth session
 * @tags domains, readiness
 * @description Check if a domain is ready to receive calls. Evaluates checks defined in DOMAIN-READY-001 ORCHESTRATE spec. Returns structured pass/fail results with fix action links.
 * @pathParam domainId string - The domain ID to check readiness for
 * @response 200 { ok: true, domainId, domainName, ready, score, level, checks[], criticalPassed, criticalTotal, recommendedPassed, recommendedTotal }
 * @response 404 { ok: false, error: "Domain not found: ..." }
 * @response 500 { ok: false, error: string }
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ domainId: string }> },
) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { domainId } = await params;
    const result = await checkDomainReadiness(domainId);

    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    const is404 = error.message?.includes("not found");
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: is404 ? 404 : 500 },
    );
  }
}
