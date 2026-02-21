import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { loadWizardSteps, type WizardStep } from "@/lib/wizards/wizard-spec";
import { config } from "@/lib/config";

/** Map wizard name → config.specs slug (server-side resolution) */
const WIZARD_SLUG_MAP: Record<string, () => string> = {
  "content-source": () => config.specs.contentSourceSetup,
  "course": () => config.specs.courseSetup,
  "classroom": () => config.specs.classroomSetup,
  "demonstrate": () => config.specs.demonstrateFlow,
  "teach": () => config.specs.teachFlow,
};

/**
 * @api GET /api/wizard-steps
 * @visibility internal
 * @auth VIEWER+
 * @tags wizard
 * @description Load wizard step definitions from a spec. Accepts either `wizard` (name resolved via config) or `slug` (direct). Returns hardcoded fallback if spec not found.
 * @query wizard string - Wizard name (e.g., "demonstrate", "course", "classroom"). Resolved to spec slug via config.
 * @query slug string - Direct spec slug (deprecated, prefer `wizard`). Ignored if `wizard` is provided.
 * @response 200 { ok: true, steps: WizardStep[], source: "database" | "fallback" }
 * @response 400 { ok: false, error: string }
 * @response 500 { ok: false, error: string }
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth("VIEWER");
    if (isAuthError(auth)) return auth.error;

    const { searchParams } = new URL(request.url);
    const wizardName = searchParams.get("wizard");
    const directSlug = searchParams.get("slug");

    // Resolve slug: wizard name → config lookup, or direct slug fallback
    let slug: string | null = null;
    if (wizardName) {
      const resolver = WIZARD_SLUG_MAP[wizardName];
      if (!resolver) {
        return NextResponse.json(
          { ok: false, error: `Unknown wizard: '${wizardName}'. Valid: ${Object.keys(WIZARD_SLUG_MAP).join(", ")}` },
          { status: 400 }
        );
      }
      slug = resolver();
    } else if (directSlug) {
      slug = directSlug;
    }

    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "Missing 'wizard' or 'slug' query parameter" },
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
