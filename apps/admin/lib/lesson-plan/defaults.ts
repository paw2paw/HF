/**
 * Lesson Plan Defaults — 3-layer cascade resolver.
 *
 * Resolution order:
 *   Domain.lessonPlanDefaults (per-institution) →
 *   SystemSettings (global) →
 *   LESSON_PLAN_DEFAULTS (hardcoded fallback)
 *
 * Used by IntentStep (eager plan generation) and LessonPlanStep (intents panel).
 */

import { getLessonPlanSettings, type LessonPlanSettings } from "@/lib/system-settings";
import { prisma } from "@/lib/prisma";

export type { LessonPlanSettings };

/** Source of each resolved value — used by defaults UI for source badges. */
export type ConfigSource = "system" | "domain" | "course";

export type LessonPlanDefaultsWithSource = {
  [K in keyof LessonPlanSettings]: {
    value: LessonPlanSettings[K];
    source: ConfigSource;
  };
};

/**
 * Resolve lesson plan defaults with cascade:
 *   Domain (if provided and has overrides) → SystemSettings → Hardcoded defaults.
 */
export async function getLessonPlanDefaults(
  domainId?: string | null,
): Promise<LessonPlanSettings> {
  const system = await getLessonPlanSettings();
  if (!domainId) return system;

  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
    select: { lessonPlanDefaults: true },
  });

  if (!domain?.lessonPlanDefaults) return system;
  const overrides = domain.lessonPlanDefaults as Partial<LessonPlanSettings>;

  return {
    sessionCount: overrides.sessionCount ?? system.sessionCount,
    durationMins: overrides.durationMins ?? system.durationMins,
    emphasis: overrides.emphasis ?? system.emphasis,
    assessments: overrides.assessments ?? system.assessments,
    lessonPlanModel: overrides.lessonPlanModel ?? system.lessonPlanModel,
    audience: overrides.audience ?? system.audience,
  };
}

/**
 * Resolve with source badges — for domain defaults UI.
 * Shows whether each value comes from "system" or "domain" override.
 */
export async function getLessonPlanDefaultsWithSource(
  domainId: string,
): Promise<LessonPlanDefaultsWithSource> {
  const system = await getLessonPlanSettings();

  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
    select: { lessonPlanDefaults: true },
  });

  const overrides = (domain?.lessonPlanDefaults as Partial<LessonPlanSettings>) ?? {};

  const keys: Array<keyof LessonPlanSettings> = [
    "sessionCount",
    "durationMins",
    "emphasis",
    "assessments",
    "lessonPlanModel",
    "audience",
  ];

  const result = {} as LessonPlanDefaultsWithSource;
  for (const key of keys) {
    const domainVal = overrides[key];
    if (domainVal != null) {
      (result as any)[key] = { value: domainVal, source: "domain" };
    } else {
      (result as any)[key] = { value: system[key], source: "system" };
    }
  }

  return result;
}

/**
 * 3-layer resolve: Playbook.config (course) → Domain → System.
 * Used by Course Settings tab to show where each value comes from.
 */
export async function getCourseDefaultsWithSource(
  playbookId: string,
  domainId: string,
): Promise<LessonPlanDefaultsWithSource> {
  const system = await getLessonPlanSettings();

  const [domain, playbook] = await Promise.all([
    prisma.domain.findUnique({
      where: { id: domainId },
      select: { lessonPlanDefaults: true },
    }),
    prisma.playbook.findUnique({
      where: { id: playbookId },
      select: { config: true },
    }),
  ]);

  const domainOverrides = (domain?.lessonPlanDefaults as Partial<LessonPlanSettings>) ?? {};
  const pbConfig = (playbook?.config || {}) as Record<string, any>;

  const keys: Array<keyof LessonPlanSettings> = [
    "sessionCount",
    "durationMins",
    "emphasis",
    "assessments",
    "lessonPlanModel",
    "audience",
  ];

  const result = {} as LessonPlanDefaultsWithSource;
  for (const key of keys) {
    const courseVal = pbConfig[key];
    if (courseVal != null) {
      (result as any)[key] = { value: courseVal, source: "course" };
    } else if (domainOverrides[key] != null) {
      (result as any)[key] = { value: domainOverrides[key], source: "domain" };
    } else {
      (result as any)[key] = { value: system[key], source: "system" };
    }
  }

  return result;
}
