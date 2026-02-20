import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { loadWizardSteps, type WizardStep } from "@/lib/wizards/wizard-spec";

/**
 * @api GET /api/wizard-steps
 * @visibility internal
 * @auth VIEWER+
 * @tags wizard
 * @description Load wizard step definitions from a spec. Returns hardcoded fallback if spec not found.
 * @query slug string - Spec slug (e.g., "CONTENT-SOURCE-SETUP-001")
 * @response 200 { ok: true, steps: WizardStep[], source: "database" | "fallback" }
 * @response 400 { ok: false, error: string }
 * @response 500 { ok: false, error: string }
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth("VIEWER");
    if (isAuthError(auth)) return auth.error;

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "Missing 'slug' query parameter" },
        { status: 400 }
      );
    }

    // Try to load from database
    const steps = await loadWizardSteps(slug);

    if (steps) {
      return NextResponse.json({
        ok: true,
        steps,
        source: "database",
      });
    }

    // Spec not found — return fallback (empty, client should use hardcoded defaults)
    return NextResponse.json({
      ok: true,
      steps: [],
      source: "fallback",
    });
  } catch (error: any) {
    console.error("[wizard-steps] Error fetching wizard steps:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch wizard steps" },
      { status: 500 }
    );
  }
}
