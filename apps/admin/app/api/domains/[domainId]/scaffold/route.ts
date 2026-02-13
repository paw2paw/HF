import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { scaffoldDomain } from "@/lib/domain/scaffold";

/**
 * @api POST /api/domains/:domainId/scaffold
 * @visibility internal
 * @auth session (OPERATOR)
 * @tags domains, setup
 * @description Auto-scaffold minimum viable domain setup: identity spec, playbook, publish, onboarding config.
 *              Idempotent — safe to call multiple times. Skips if domain already has a published playbook.
 * @pathParam domainId string - The domain ID
 * @response 200 { ok: true, result: ScaffoldResult }
 * @response 404 { ok: false, error: "Domain not found: ..." }
 * @response 500 { ok: false, error: string }
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ domainId: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { domainId } = await params;
    const result = await scaffoldDomain(domainId);

    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    const status = error.message?.includes("not found") ? 404 : 500;
    return NextResponse.json(
      { ok: false, error: error.message || "Scaffold failed" },
      { status }
    );
  }
}
