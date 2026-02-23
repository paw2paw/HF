import { NextRequest, NextResponse } from "next/server";
import { listAvailableSources } from "@/lib/content-trust/validate-source-authority";
import { requireEntityAccess, isEntityAuthError } from "@/lib/access-control";

/**
 * @api GET /api/content-sources/available
 * @visibility internal
 * @scope content-sources:read
 * @auth session
 * @tags content-sources
 * @description List content sources in a lightweight format for the source picker UI. Domain-scoped users see only their domain's sources.
 * @query domainId string - Filter by domain (explicit filter for any role)
 * @response 200 { ok: true, sources: Array<{ slug, name, trustLevel, publisherOrg, validUntil, isExpired }> }
 * @response 403 { error: "Forbidden" }
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireEntityAccess("content", "R");
    if (isEntityAuthError(authResult)) return authResult.error;
    const { session, scope } = authResult;

    const { searchParams } = new URL(req.url);
    const domainIdParam = searchParams.get("domainId");

    // Domain scoping: DOMAIN scope uses assignedDomainId, explicit param overrides for any role
    const targetDomainId = scope === "DOMAIN"
      ? session.user.assignedDomainId || undefined
      : domainIdParam || undefined;

    const sources = await listAvailableSources(targetDomainId);
    return NextResponse.json({ ok: true, sources });
  } catch (error: any) {
    console.error("[content-sources/available] GET error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
