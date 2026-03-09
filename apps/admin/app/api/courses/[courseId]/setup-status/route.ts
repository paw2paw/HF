import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/courses/:courseId/setup-status
 * @visibility public
 * @scope courses:read
 * @auth VIEWER
 * @tags courses, readiness
 * @description Returns aggregated setup status for stages 4-6 of the Course Setup Tracker.
 *   Stages 1-3 are derived client-side from data already loaded on the page.
 *   This endpoint checks: lesson plan existence, onboarding config, and prompt composability.
 *
 * @pathParam courseId string - Playbook UUID
 * @response 200 { ok, lessonPlanBuilt, onboardingConfigured, promptComposable, allCriticalPass, details }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const user = await requireAuth("VIEWER");
    if (isAuthError(user)) return user;

    const { courseId } = await params;

    // Load playbook with domain
    const playbook = await prisma.playbook.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        domainId: true,
        config: true,
        domain: {
          select: {
            id: true,
            onboardingIdentitySpecId: true,
            onboardingFlowPhases: true,
          },
        },
      },
    });

    if (!playbook) {
      return NextResponse.json({ ok: false, error: "Course not found" }, { status: 404 });
    }

    // ── Stage 4: Lesson Plan Built ──────────────────
    // Check if any CONTENT spec linked to this playbook has a lessonPlan
    const contentSpec = await prisma.analysisSpec.findFirst({
      where: {
        specRole: "CONTENT",
        isActive: true,
        playbookItems: {
          some: {
            playbookId: courseId,
            isEnabled: true,
          },
        },
      },
      select: { config: true },
    });

    const specConfig = contentSpec?.config as Record<string, any> | null;
    const deliveryConfig = specConfig?.deliveryConfig;
    const lessonPlan = deliveryConfig?.lessonPlan;
    const lessonPlanBuilt = Array.isArray(lessonPlan) && lessonPlan.length > 0;

    // ── Stage 5: Tutor Configured ───────────────────
    const hasIdentity = !!playbook.domain.onboardingIdentitySpecId;
    const hasPhases = !!playbook.domain.onboardingFlowPhases;
    const onboardingConfigured = hasIdentity && hasPhases;

    // ── Stage 6: Prompt Composable ──────────────────
    // Check if any caller for this domain has a composed prompt
    const composedPrompt = await prisma.composedPrompt.findFirst({
      where: {
        caller: {
          domainId: playbook.domainId,
        },
      },
      select: { id: true },
    });
    const promptComposable = !!composedPrompt;

    // All critical = prompt composable (matches COURSE-READY-001 critical check)
    const allCriticalPass = promptComposable;

    return NextResponse.json({
      ok: true,
      lessonPlanBuilt,
      onboardingConfigured,
      promptComposable,
      allCriticalPass,
    });
  } catch (err) {
    console.error("[setup-status] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to check setup status" },
      { status: 500 },
    );
  }
}
