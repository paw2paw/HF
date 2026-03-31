/**
 * Shared phase classification utilities.
 * Used by OnboardingEditor and the unified Journey Editor.
 */

/** Returns true if the phase is a survey phase (either by type or by having survey steps). */
export function isSurveyPhase(phase: { phase?: string; surveySteps?: unknown[] }): boolean {
  return phase.phase === 'survey' || (Array.isArray(phase.surveySteps) && phase.surveySteps.length > 0);
}
