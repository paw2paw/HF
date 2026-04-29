/**
 * @api GET /api/courses/[courseId]/session-flow
 * @visibility internal
 * @scope course:read
 * @auth session (OPERATOR+)
 * @tags course, session-flow
 * @description Returns the resolved Session Flow shape for a course — the
 *   single source of truth used by both the Course page Timeline (read view)
 *   and the upcoming Course page editor (#225). Reads via resolveSessionFlow
 *   regardless of feature flag — this endpoint is the *configuration view*,
 *   not the runtime path.
 * @response 200 { ok, sessionFlow: SessionFlowResolved, mode: "continuous"|"structured", teachingMode?: string, sessionCount?: number }
 * @response 404 { ok: false, error: "Course not found" }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { config } from "@/lib/config";
import { resolveSessionFlow } from "@/lib/session-flow/resolver";
import type {
  PlaybookConfig,
  OnboardingFlowPhases,
  SessionFlowResolved,
} from "@/lib/types/json-fields";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("OPERATOR");
  if (isAuthError(auth)) return auth.error;

  try {
    const { courseId } = await params;

    const playbook = await prisma.playbook.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        name: true,
        config: true,
        domain: {
          select: {
            slug: true,
            onboardingWelcome: true,
            onboardingFlowPhases: true,
          },
        },
      },
    });

    if (!playbook) {
      return NextResponse.json(
        { ok: false, error: "Course not found" },
        { status: 404 },
      );
    }

    const onboardingSpec = await prisma.analysisSpec.findUnique({
      where: { slug: config.specs.onboarding },
      select: { config: true },
    });

    const pbConfig = (playbook.config ?? {}) as PlaybookConfig;
    const resolved: SessionFlowResolved = resolveSessionFlow({
      playbook: { name: playbook.name, config: pbConfig },
      domain: playbook.domain,
      onboardingSpec: (onboardingSpec ?? null) as { config: { firstCallFlow?: OnboardingFlowPhases } } | null,
    });

    return NextResponse.json({
      ok: true,
      sessionFlow: resolved,
      mode: pbConfig.lessonPlanMode ?? "structured",
      teachingMode: pbConfig.teachingMode ?? null,
      sessionCount: pbConfig.sessionCount ?? null,
      courseName: playbook.name,
    });
  } catch (err) {
    console.error("[courses/[courseId]/session-flow GET]", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
