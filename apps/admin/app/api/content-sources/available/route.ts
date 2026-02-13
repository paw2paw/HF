import { NextResponse } from "next/server";
import { listAvailableSources } from "@/lib/content-trust/validate-source-authority";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/content-sources/available
 * @visibility internal
 * @scope content-sources:read
 * @auth session
 * @tags content-sources
 * @description List content sources in a lightweight format for the source picker UI in the spec editor
 * @response 200 { ok: true, sources: Array<{ slug, name, trustLevel, publisherOrg, validUntil, isExpired }> }
 */
export async function GET() {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const sources = await listAvailableSources();
    return NextResponse.json({ ok: true, sources });
  } catch (error: any) {
    console.error("[content-sources/available] GET error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
