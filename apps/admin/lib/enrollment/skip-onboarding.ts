import { prisma } from "@/lib/prisma";
import { SURVEY_SCOPES, PRE_SURVEY_KEYS, POST_SURVEY_KEYS } from "@/lib/learner/survey-keys";
import { initializeLessonPlanSession } from "./init-lesson-plan";

/**
 * Skip onboarding for a caller: marks OnboardingSession complete,
 * marks pre/post surveys as submitted, and initializes lesson plan
 * to the first teaching session.
 *
 * Shared by POST /api/callers and POST /api/sim/setup.
 */
export async function applySkipOnboarding(
  callerId: string,
  domainId: string,
): Promise<void> {
  await prisma.onboardingSession.upsert({
    where: { callerId_domainId: { callerId, domainId } },
    create: {
      callerId,
      domainId,
      isComplete: true,
      wasSkipped: true,
      completedAt: new Date(),
    },
    update: {
      isComplete: true,
      wasSkipped: true,
      completedAt: new Date(),
    },
  });

  // Mark pre-survey and post-survey as submitted so student pages skip them
  const now = new Date().toISOString();
  for (const scope of [SURVEY_SCOPES.PRE, SURVEY_SCOPES.POST]) {
    const key = scope === SURVEY_SCOPES.PRE ? PRE_SURVEY_KEYS.SUBMITTED_AT : POST_SURVEY_KEYS.SUBMITTED_AT;
    await prisma.callerAttribute.upsert({
      where: { callerId_key_scope: { callerId, key, scope } },
      create: {
        callerId,
        key,
        scope,
        valueType: "STRING",
        stringValue: now,
      },
      update: { stringValue: now },
    });
  }

  // Initialize lesson plan session to first content session
  await initializeLessonPlanSession(callerId, domainId);
  console.log(`[skip-onboarding] Skipped onboarding for ${callerId}`);
}

/**
 * Reset onboarding for a caller: clears OnboardingSession so they
 * can re-experience the full journey.
 */
export async function resetOnboarding(
  callerId: string,
  domainId: string,
): Promise<void> {
  await prisma.onboardingSession.upsert({
    where: { callerId_domainId: { callerId, domainId } },
    create: {
      callerId,
      domainId,
      isComplete: false,
      wasSkipped: false,
    },
    update: {
      isComplete: false,
      wasSkipped: false,
      currentPhase: null,
      completedPhases: [],
      completedAt: null,
    },
  });

  // Remove survey submission markers so surveys appear again
  for (const scope of [SURVEY_SCOPES.PRE, SURVEY_SCOPES.POST]) {
    const key = scope === SURVEY_SCOPES.PRE ? PRE_SURVEY_KEYS.SUBMITTED_AT : POST_SURVEY_KEYS.SUBMITTED_AT;
    await prisma.callerAttribute.deleteMany({
      where: { callerId, key, scope },
    });
  }

  console.log(`[skip-onboarding] Reset onboarding for ${callerId}`);
}
