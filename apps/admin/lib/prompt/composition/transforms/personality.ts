/**
 * Personality Transforms - FULLY DYNAMIC
 * NO HARDCODING - All personality/trait data comes from database
 *
 * Extracted from route.ts lines 1671-1725, 2017-2075
 * Rewritten Feb 2026 to be data-driven
 */

import { registerTransform } from "../TransformRegistry";
import { classifyValue } from "../types";
import type { AssembledContext, PersonalityData } from "../types";

/**
 * Map personality data into structured traits with scores, levels, descriptions.
 * Returns the personality section for llmPrompt.
 *
 * FULLY DYNAMIC - works with ANY personality parameters from database
 */
registerTransform("mapPersonalityTraits", (
  rawData: PersonalityData | null,
  context: AssembledContext,
) => {
  if (!rawData) return null;

  const personality = rawData;
  const { thresholds } = context.sharedState;

  // Build dynamic traits object from all parameterValues
  const traits: Record<string, {
    score: number | null;
    level: string | null;
    parameterId?: string;
  }> = {};

  // Process ALL parameters dynamically (not just Big Five!)
  for (const [key, value] of Object.entries(personality)) {
    // Skip non-parameter fields
    if (['preferredTone', 'preferredLength', 'technicalLevel', 'confidenceScore', 'lastUpdatedAt'].includes(key)) {
      continue;
    }

    if (typeof value === 'number' || value === null) {
      traits[key] = {
        score: value,
        level: value !== null ? classifyValue(value, thresholds) : null,
        parameterId: key,
      };
    }
  }

  return {
    traits,
    preferences: {
      tone: personality.preferredTone,
      responseLength: personality.preferredLength,
      technicalLevel: personality.technicalLevel,
    },
    confidence: personality.confidenceScore,
    parameterCount: Object.keys(traits).length,
  };
});

/**
 * Compute personality-based adaptation instructions.
 * Used by the instructions transform.
 *
 * FULLY DYNAMIC - adapts to ANY personality parameters from database
 */
export function computePersonalityAdaptation(
  personality: PersonalityData | null,
  thresholds: { high: number; low: number },
): string[] {
  if (!personality) {
    return ["No personality data available - observe and adapt during conversation"];
  }

  const adaptations: string[] = [];

  // Process ALL personality parameters dynamically
  for (const [key, value] of Object.entries(personality)) {
    // Skip non-parameter fields
    if (['preferredTone', 'preferredLength', 'technicalLevel', 'confidenceScore', 'lastUpdatedAt'].includes(key)) {
      continue;
    }

    if (typeof value !== 'number' || value === null) continue;

    // Generate adaptation based on parameter value relative to thresholds
    const paramLabel = key.replace(/_/g, ' ').replace(/^b5-/i, '').replace(/^pers-/i, '').toUpperCase();

    if (value >= thresholds.high) {
      adaptations.push(`HIGH ${paramLabel}: Lean into this trait - value is ${(value * 100).toFixed(0)}%`);
    } else if (value <= thresholds.low) {
      adaptations.push(`LOW ${paramLabel}: Accommodate this trait - value is ${(value * 100).toFixed(0)}%`);
    }
    // Skip moderate values to keep adaptations concise
  }

  return adaptations.length > 0
    ? adaptations
    : ["No strong personality traits detected - use balanced approach"];
}
