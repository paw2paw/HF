import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { getLessonPlanModel } from "@/lib/lesson-plan/models";
import { computeSessionCountRecommendation } from "@/lib/content-trust/lesson-planner";
import { INSTRUCTION_CATEGORIES } from "@/lib/content-trust/resolve-config";

/**
 * @api GET /api/courses/:courseId/session-count-recommendation
 * @visibility internal
 * @scope courses:read
 * @auth VIEWER
 * @tags courses, lesson-plan
 * @description Computes a session count recommendation based on the course's
 *   teaching points, pedagogical model, and session duration. Returns min,
 *   recommended, and max session counts with a breakdown by session type.
 * @pathParam courseId string - Playbook UUID
 * @response 200 { ok, recommendation }
 * @response 404 { ok: false, error: "Course not found" }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { courseId } = await params;

    // Load playbook config
    const playbook = await prisma.playbook.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        config: true,
      },
    });

    if (!playbook) {
      return NextResponse.json(
        { ok: false, error: "Course not found" },
        { status: 404 },
      );
    }

    const config = (playbook.config as Record<string, unknown>) || {};
    const lessonPlanModel = (config.lessonPlanModel as string) || null;
    const durationMins = (config.durationMins as number) || 30;
    const modelDef = getLessonPlanModel(lessonPlanModel);

    // Resolve source IDs for this playbook
    const playbookSubjects = await prisma.playbookSubject.findMany({
      where: { playbookId: courseId },
      select: {
        subject: {
          select: {
            sources: { select: { sourceId: true } },
          },
        },
      },
    });

    const sourceIds = [...new Set(
      playbookSubjects.flatMap((ps) => ps.subject.sources.map((s) => s.sourceId)),
    )];

    if (sourceIds.length === 0) {
      return NextResponse.json({
        ok: true,
        recommendation: {
          min: 2,
          recommended: 2,
          max: 4,
          breakdown: { onboarding: 1, teaching: 0, review: 0, assess: 0, consolidation: 1 },
          effectiveMaxTPs: modelDef.defaults.maxTpsPerSession,
          totalTPs: 0,
          totalModules: 0,
        },
      });
    }

    // Count TPs and distinct topic groups
    const [tpCount, topicGroups] = await Promise.all([
      prisma.contentAssertion.count({
        where: { sourceId: { in: sourceIds }, category: { notIn: [...INSTRUCTION_CATEGORIES] } },
      }),
      prisma.contentAssertion.groupBy({
        by: ["learningOutcomeRef"],
        where: { sourceId: { in: sourceIds }, category: { notIn: [...INSTRUCTION_CATEGORIES] } },
      }),
    ]);

    const recommendation = computeSessionCountRecommendation(
      tpCount,
      topicGroups.length,
      modelDef.defaults,
      durationMins,
    );

    return NextResponse.json({ ok: true, recommendation });
  } catch (error: unknown) {
    console.error("[session-count-recommendation] GET error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to compute recommendation" },
      { status: 500 },
    );
  }
}
