/**
 * information-need.ts — #164 (retrieval practice).
 *
 * Computes a 0–1 signal representing how much the system needs to learn
 * about this learner's mastery right now. Drives adaptive retrieval
 * question count: high informationNeed → more questions, low → fewer.
 *
 * v1 uses coverage gap only (what fraction of LOs have no mastery data).
 * v2 will add per-LO staleness based on call count (not calendar days)
 * since HF learners range from 3-calls-per-day to 1-call-per-fortnight.
 *
 * Pure function — no DB, no side effects.
 */

/**
 * Compute the information need for a learner.
 *
 * @param loMasteryMap  Per-LO mastery scores from CallerAttributes.
 *                       Keys are `moduleId:ref` or bare refs; values are 0–1.
 *                       Missing LOs = uncharacterized = high need.
 * @param totalLOs      Total number of LearningObjectives in the curriculum.
 *                       From `workingSet.totalLOs` or dbLOs.length.
 * @returns             0 = all LOs have mastery data (low need),
 *                       1 = no LOs have mastery data (maximum need).
 *                       Clamped to [0, 1].
 */
export function computeInformationNeed(
  loMasteryMap: Record<string, number>,
  totalLOs: number,
): number {
  if (totalLOs <= 0) return 1; // No LOs at all → max need (defensive)

  const characterizedCount = Object.keys(loMasteryMap).length;
  const gap = (totalLOs - characterizedCount) / totalLOs;

  return Math.max(0, Math.min(1, gap));
}

/**
 * Derive the number of retrieval questions for this call.
 *
 * @param informationNeed  0–1 signal from computeInformationNeed.
 * @param maxQuestions     Ceiling from the archetype config (per mode).
 * @param minQuestions     Floor — retrieval is never fully off. Default 1.
 * @returns                Integer question count, clamped to [min, max].
 */
export function deriveQuestionCount(
  informationNeed: number,
  maxQuestions: number,
  minQuestions: number = 1,
): number {
  const raw = Math.ceil(informationNeed * maxQuestions);
  return Math.max(minQuestions, Math.min(maxQuestions, raw));
}
