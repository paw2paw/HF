/**
 * @api GET /api/student/journey-position
 * @visibility internal
 * @scope student:read
 * @auth session (STUDENT | OPERATOR+)
 * @tags student, journey
 * @description Resolves the student's next stop: onboarding → teaching (or continuous with TP progress).
 *   Session-based rail walking was removed when the scheduler replaced session pacing (Phase 1-2).
 * @response 200 { ok, nextStop: { type, session, redirect }, journey: { totalStops, completedStops, currentPosition, progressPercentage? } }
 * @response 404 { ok: false, error: "..." }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudentOrAdmin, isStudentAuthError } from "@/lib/student-access";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireStudentOrAdmin(request);
    if (isStudentAuthError(auth)) return auth.error;

    const { callerId } = auth;

    // Load enrollment + onboarding state in parallel
    const [enrollment, onboardingSession] = await Promise.all([
      prisma.callerPlaybook.findFirst({
        where: { callerId, status: "ACTIVE" },
        select: {
          playbook: {
            select: {
              id: true,
              subjects: {
                select: {
                  subject: {
                    select: {
                      curricula: {
                        where: { deliveryConfig: { not: null } },
                        select: { id: true, slug: true, deliveryConfig: true },
                        take: 1,
                      },
                    },
                  },
                },
                take: 1,
              },
            },
          },
        },
      }),
      prisma.onboardingSession.findFirst({
        where: { callerId },
        select: { isComplete: true, wasSkipped: true },
      }),
    ]);

    if (!enrollment) {
      return NextResponse.json(
        { ok: false, error: "No active enrollment", nextStop: { type: "complete", session: 0, redirect: "/x/student/progress" } },
        { status: 404 },
      );
    }

    const curriculum = enrollment.playbook.subjects?.[0]?.subject?.curricula?.[0];
    const deliveryConfig = curriculum?.deliveryConfig as Record<string, unknown> | null;
    const onboardingComplete = onboardingSession?.isComplete || onboardingSession?.wasSkipped || false;

    // ── Continuous mode: collapse journey to single stop with progress % ──
    const lessonPlanMode = deliveryConfig?.lessonPlanMode as string | undefined;
    if (lessonPlanMode === 'continuous' && curriculum?.slug) {
      const { getTpProgressSummary } = await import("@/lib/curriculum/track-progress");
      const summary = await getTpProgressSummary(callerId, curriculum.slug);
      const pct = summary.totalTps > 0
        ? Math.round((summary.mastered / summary.totalTps) * 100)
        : 0;
      const isComplete = pct >= 100;

      return NextResponse.json({
        ok: true,
        nextStop: isComplete
          ? { type: "complete", session: 1, redirect: "/x/student/progress" }
          : { type: "continuous", session: 1, redirect: "/x/sim" },
        journey: {
          totalStops: 1,
          completedStops: isComplete ? 1 : 0,
          currentPosition: 1,
          progressPercentage: pct,
          mastered: summary.mastered,
          inProgress: summary.inProgress,
          notStarted: summary.notStarted,
          totalTps: summary.totalTps,
        },
      });
    }

    // ── Default: onboarding gate then teaching ──
    return NextResponse.json({
      ok: true,
      nextStop: onboardingComplete
        ? { type: "teaching", session: 1, redirect: "/x/sim" }
        : { type: "onboarding", session: 1, redirect: "/x/sim" },
      journey: { totalStops: 0, completedStops: onboardingComplete ? 1 : 0, currentPosition: 0 },
    });
  } catch (err) {
    console.error("[student/journey-position GET]", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
