import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { generateContentSpec } from "@/lib/domain/generate-content-spec";

/**
 * @api POST /api/domains/:domainId/generate-content-spec
 * @visibility internal
 * @auth session (OPERATOR)
 * @tags domains, content, specs
 * @description Auto-generate a CONTENT spec from the domain's content source assertions.
 *              Uses AI to extract curriculum structure (modules, learning outcomes) from
 *              teaching points, then creates an AnalysisSpec and adds it to the playbook.
 *              Idempotent — skips if content spec already exists or no assertions available.
 * @pathParam domainId string - The domain ID
 * @response 200 { ok: true, result: ContentSpecResult }
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
    const result = await generateContentSpec(domainId);

    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error, result }, { status: 422 });
    }

    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    const status = error.message?.includes("not found") ? 404 : 500;
    return NextResponse.json(
      { ok: false, error: error.message || "Content spec generation failed" },
      { status }
    );
  }
}
