import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { getLessonPlanDefaults, getCourseDefaultsWithSource } from "@/lib/lesson-plan/defaults";

/**
 * @api GET /api/lesson-plan-defaults
 * @visibility internal
 * @scope courses:read
 * @auth session (VIEWER+)
 * @tags lesson-plan
 * @description Get resolved lesson plan defaults. Cascades: Course → Domain → SystemSettings → hardcoded.
 * If playbookId + domainId provided, returns values with source badges ("course" | "domain" | "system").
 * Used by Course Setup Wizard IntentStep and Course Settings tab.
 * @query domainId string? - Optional domain ID for institution-level overrides
 * @query playbookId string? - Optional playbook ID for course-level overrides (enables source badges)
 * @response 200 { ok: true, defaults: LessonPlanSettings } | { ok: true, defaults: LessonPlanDefaultsWithSource }
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth("VIEWER");
    if (isAuthError(auth)) return auth.error;

    const domainId = request.nextUrl.searchParams.get("domainId");
    const playbookId = request.nextUrl.searchParams.get("playbookId");

    // If both playbookId and domainId provided, return 3-layer cascade with source badges
    if (playbookId && domainId) {
      const defaults = await getCourseDefaultsWithSource(playbookId, domainId);
      return NextResponse.json({ ok: true, defaults, withSource: true });
    }

    const defaults = await getLessonPlanDefaults(domainId);
    return NextResponse.json({ ok: true, defaults });
  } catch (error: any) {
    console.error("[lesson-plan-defaults] GET error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
}
