/**
 * Agent Tuner — Derive Parameter Map
 *
 * Pure client-safe function (no server imports). Computes a flattened
 * parameterMap from active pills by blending each pill's contribution.
 *
 * Runs instantly on pill add/remove — no API call needed.
 */

import type { AgentTunerPill } from "./types";

/**
 * Derive a flattened parameterMap from active pills.
 *
 * For each parameter touched by any pill, computes:
 *   effectiveValue = atZero + intensity * (atFull - atZero)
 *
 * When multiple pills affect the same parameter, uses an
 * intensity-weighted average of their effective values.
 *
 * @returns Record<parameterId, derivedValue> — all values clamped [0, 1]
 */
export function deriveParameterMap(
  pills: AgentTunerPill[],
): Record<string, number> {
  const accum: Record<string, { weightedSum: number; totalWeight: number }> = {};

  for (const pill of pills) {
    if (pill.intensity <= 0) continue;

    for (const param of pill.parameters) {
      const effective = param.atZero + pill.intensity * (param.atFull - param.atZero);

      if (!accum[param.parameterId]) {
        accum[param.parameterId] = { weightedSum: 0, totalWeight: 0 };
      }

      accum[param.parameterId].weightedSum += effective * pill.intensity;
      accum[param.parameterId].totalWeight += pill.intensity;
    }
  }

  const result: Record<string, number> = {};
  for (const [paramId, { weightedSum, totalWeight }] of Object.entries(accum)) {
    if (totalWeight > 0) {
      result[paramId] = Math.max(0, Math.min(1, weightedSum / totalWeight));
    }
  }

  return result;
}
