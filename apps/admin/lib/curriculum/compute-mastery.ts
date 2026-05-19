/**
 * Module mastery computation (#494 E2 Slice 2.2).
 *
 * Deterministic EMA over `CallScore` rows for a (callerId, moduleId) pair.
 * Becomes the canonical source of truth for `CallerModuleProgress.mastery`
 * — the legacy `CallerAttribute mastery:*` writes are deprecated and will
 * be reconciled / deleted in Slice 2.1.
 *
 * Formula:
 *   - evidenceCount = count of CallScore rows for (callerId, moduleId)
 *   - if evidenceCount < 3 → mastery = 0 (insufficient evidence)
 *   - else: EMA across the most recent N=10 scores, time-decayed by
 *     `exp(-ln2 * dayDelta / halfLifeDays)` against now.
 *   - mastery is clamped to [0, 1].
 *   - `shouldMarkCompleted` flips true when mastery >= masteryThreshold
 *     AND evidenceCount >= minCallsToFull.
 *
 * Defaults: masteryThreshold=0.7, emaHalfLifeDays=14, minCallsToFull=4.
 * Each is overridable per (module / playbook). Pipeline reads playbook
 * config (`Playbook.config.skillScoringEmaHalfLifeDays`,
 * `Playbook.config.skillMinCallsToFull`) — see `MEMORY.md` PROD LAUNCH
 * CHECKLIST for the reconciled defaults.
 *
 * Works identically for authored courses and AI-generated curricula: both
 * populate `CurriculumModule` + `CallScore` rows with the same schema.
 *
 * `CallScore.callerId` is denormalized on the row itself (no `call.callerId`
 * relation join needed) — see `prisma/schema.prisma::CallScore`.
 */

import type { PrismaClient } from "@prisma/client";

/** Defaults aligned with `lib/pipeline/aggregate-runner.ts` skill-EMA path. */
export const DEFAULT_MASTERY_THRESHOLD = 0.7;
export const DEFAULT_EMA_HALF_LIFE_DAYS = 14;
export const DEFAULT_MIN_CALLS_TO_FULL = 4;
/** Window of most-recent CallScore rows folded into the EMA. */
export const MASTERY_EMA_WINDOW = 10;
/** Minimum CallScore rows required to compute a non-zero mastery. */
export const MASTERY_MIN_EVIDENCE = 3;

const MS_PER_DAY = 86_400_000;

export interface MasteryComputationInput {
  callerId: string;
  moduleId: string;
  /** Module-level override; falls back to {@link DEFAULT_MASTERY_THRESHOLD}. */
  masteryThreshold?: number;
  /** Playbook config override; falls back to {@link DEFAULT_EMA_HALF_LIFE_DAYS}. */
  emaHalfLifeDays?: number;
  /** Playbook config override; falls back to {@link DEFAULT_MIN_CALLS_TO_FULL}. */
  minCallsToFull?: number;
  /**
   * Optional clock injection for deterministic tests. Defaults to `new Date()`.
   * Mastery is anchored to "now" so the most recent score weighs ~1.0.
   */
  now?: Date;
}

export interface MasteryResult {
  /** Mastery in [0, 1] — 0 when evidenceCount < {@link MASTERY_MIN_EVIDENCE}. */
  mastery: number;
  /** Total CallScore rows for the (callerId, moduleId) pair. */
  evidenceCount: number;
  /** True when mastery crosses the threshold AND minCallsToFull is satisfied. */
  shouldMarkCompleted: boolean;
}

/**
 * Clamp a value to [0, 1]. NaN / non-finite collapses to 0 so a malformed
 * upstream score can't poison `CallerModuleProgress.mastery`.
 */
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Compute the EMA-derived mastery for a (callerId, moduleId) pair.
 *
 * Sample weight: `exp(-ln2 * (now - createdAt) / (halfLifeDays * 1 day))`.
 * The most recent score in the window approaches weight 1.0; a score one
 * half-life ago contributes 0.5; very old scores fade. Falls back to a
 * uniform mean if every score sits exactly on `now` (sum of weights still
 * non-zero by construction).
 *
 * Returns `mastery=0` when fewer than {@link MASTERY_MIN_EVIDENCE} CallScore
 * rows exist — guard against a single noisy score flipping a module to
 * COMPLETED. `shouldMarkCompleted` independently requires `minCallsToFull`
 * pieces of evidence on top of the threshold check.
 */
export async function computeModuleMastery(
  prisma: Pick<PrismaClient, "callScore">,
  input: MasteryComputationInput,
): Promise<MasteryResult> {
  const masteryThreshold = input.masteryThreshold ?? DEFAULT_MASTERY_THRESHOLD;
  const halfLifeDays = input.emaHalfLifeDays ?? DEFAULT_EMA_HALF_LIFE_DAYS;
  const minCallsToFull = input.minCallsToFull ?? DEFAULT_MIN_CALLS_TO_FULL;
  const nowMs = (input.now ?? new Date()).getTime();

  // CallScore.callerId is denormalised (`schema.prisma::CallScore`), so we
  // can query directly without joining through `call: { callerId }`. The
  // moduleId column was added by E1 Slice 1.2 (#491).
  const evidenceCount = await prisma.callScore.count({
    where: { callerId: input.callerId, moduleId: input.moduleId },
  });

  if (evidenceCount < MASTERY_MIN_EVIDENCE) {
    return { mastery: 0, evidenceCount, shouldMarkCompleted: false };
  }

  const recent = await prisma.callScore.findMany({
    where: { callerId: input.callerId, moduleId: input.moduleId },
    orderBy: { createdAt: "desc" },
    take: MASTERY_EMA_WINDOW,
    select: { score: true, createdAt: true },
  });

  // Guard against an empty window despite a positive count (race / mocked
  // findMany returning undefined). Falls back to mastery=0 + no completion.
  if (recent.length === 0) {
    return { mastery: 0, evidenceCount, shouldMarkCompleted: false };
  }

  let weightedSum = 0;
  let weightSum = 0;
  const halfLifeMs = halfLifeDays * MS_PER_DAY;
  for (const row of recent) {
    const dtMs = Math.max(0, nowMs - row.createdAt.getTime());
    // exp(-ln2 * dt / halfLife) — guard against halfLifeMs<=0 by treating it
    // as "no decay" (every score weight 1.0).
    const weight =
      halfLifeMs > 0 ? Math.exp(-Math.LN2 * (dtMs / halfLifeMs)) : 1;
    weightedSum += row.score * weight;
    weightSum += weight;
  }

  // weightSum is strictly positive: recent.length >= 1 and each weight > 0
  // (Math.exp is always positive). Defensive guard anyway in case the
  // recent rows somehow produce a non-finite weight.
  const rawMastery = weightSum > 0 ? weightedSum / weightSum : 0;
  const mastery = clamp01(rawMastery);

  const shouldMarkCompleted =
    mastery >= masteryThreshold && evidenceCount >= minCallsToFull;

  return { mastery, evidenceCount, shouldMarkCompleted };
}
