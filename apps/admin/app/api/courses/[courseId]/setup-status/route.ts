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
    // Lesson plan lives on Curriculum.deliveryConfig.lessonPlan (not on AnalysisSpec)
    // Path: Playbook → PlaybookSubject → Subject → Curriculum
    const subjectIds = await prisma.playbookSubject.findMany({
      where: { playbookId: courseId },
      select: { subjectId: true },
    });

    let lessonPlanBuilt = false;
    if (subjectIds.length > 0) {
      const curriculum = await prisma.curriculum.findFirst({
        where: {
          subjectId: { in: subjectIds.map((s) => s.subjectId) },
        },
        select: { deliveryConfig: true },
      });
      const dc = curriculum?.deliveryConfig as Record<string, any> | null;
      const lessonPlan = dc?.lessonPlan;
      // lessonPlan can be { entries: [...], estimatedSessions, ... } or a raw array
      const entries = Array.isArray(lessonPlan)
        ? lessonPlan
        : Array.isArray(lessonPlan?.entries)
          ? lessonPlan.entries
          : [];
      lessonPlanBuilt = entries.length > 0;
    }

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
