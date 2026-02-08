/**
 * Personality Transforms
 * Extracted from route.ts lines 1671-1725, 2017-2075
 */

import { registerTransform } from "../TransformRegistry";
import { classifyValue } from "../types";
import type { AssembledContext, PersonalityData } from "../types";

/**
 * Map personality data into structured traits with scores, levels, descriptions.
 * Returns the personality section for llmPrompt.
 */
registerTransform("mapPersonalityTraits", (
  rawData: PersonalityData | null,
  context: AssembledContext,
) => {
  if (!rawData) return null;

  const personality = rawData;
  const { thresholds } = context.sharedState;

  return {
    traits: {
      openness: {
        score: personality.openness,
        level: classifyValue(personality.openness, thresholds),
        description: personality.openness !== null && personality.openness >= thresholds.high
          ? "Open to new experiences, curious, creative"
          : personality.openness !== null && personality.openness <= thresholds.low
            ? "Prefers routine, practical, conventional"
            : "Balanced between tradition and novelty",
      },
      conscientiousness: {
        score: personality.conscientiousness,
        level: classifyValue(personality.conscientiousness, thresholds),
        description: personality.conscientiousness !== null && personality.conscientiousness >= thresholds.high
          ? "Organized, reliable, goal-oriented"
          : personality.conscientiousness !== null && personality.conscientiousness <= thresholds.low
            ? "Flexible, spontaneous, adaptable"
            : "Balances planning with flexibility",
      },
      extraversion: {
        score: personality.extraversion,
        level: classifyValue(personality.extraversion, thresholds),
        description: personality.extraversion !== null && personality.extraversion >= thresholds.high
          ? "Outgoing, energetic, talkative"
          : personality.extraversion !== null && personality.extraversion <= thresholds.low
            ? "Reserved, reflective, quiet"
            : "Comfortable in both social and solitary settings",
      },
      agreeableness: {
        score: personality.agreeableness,
        level: classifyValue(personality.agreeableness, thresholds),
        description: personality.agreeableness !== null && personality.agreeableness >= thresholds.high
          ? "Cooperative, trusting, helpful"
          : personality.agreeableness !== null && personality.agreeableness <= thresholds.low
            ? "Direct, skeptical, competitive"
            : "Balanced between cooperation and assertiveness",
      },
      neuroticism: {
        score: personality.neuroticism,
        level: classifyValue(personality.neuroticism, thresholds),
        description: personality.neuroticism !== null && personality.neuroticism >= thresholds.high
          ? "Emotionally sensitive, may need reassurance"
          : personality.neuroticism !== null && personality.neuroticism <= thresholds.low
            ? "Emotionally stable, calm under pressure"
            : "Generally stable with normal emotional range",
      },
    },
    preferences: {
      tone: personality.preferredTone,
      responseLength: personality.preferredLength,
      technicalLevel: personality.technicalLevel,
    },
    confidence: personality.confidenceScore,
  };
});

/**
 * Compute personality-based adaptation instructions.
 * Used by the instructions transform.
 */
export function computePersonalityAdaptation(
  personality: PersonalityData | null,
  thresholds: { high: number; low: number },
): string[] {
  if (!personality) {
    return ["No personality data available - observe and adapt during conversation"];
  }

  const adaptations: string[] = [];

  if (personality.extraversion !== null) {
    if (personality.extraversion >= thresholds.high) {
      adaptations.push("HIGH extraversion: Match their energy - be engaging and conversational");
    } else if (personality.extraversion <= thresholds.low) {
      adaptations.push("LOW extraversion: Give them space - be concise, allow pauses");
    } else {
      adaptations.push("MODERATE extraversion: Balanced engagement - read their energy level each turn");
    }
  }

  if (personality.openness !== null) {
    if (personality.openness >= thresholds.high) {
      adaptations.push("HIGH openness: Explore ideas - they enjoy intellectual discussion and tangents");
    } else if (personality.openness <= thresholds.low) {
      adaptations.push("LOW openness: Stay practical - focus on concrete topics and proven approaches");
    } else {
      adaptations.push("MODERATE openness: Mix practical examples with some conceptual exploration");
    }
  }

  if (personality.conscientiousness !== null) {
    if (personality.conscientiousness >= thresholds.high) {
      adaptations.push("HIGH conscientiousness: Provide structured approach - they appreciate organization");
    } else if (personality.conscientiousness <= thresholds.low) {
      adaptations.push("LOW conscientiousness: Be flexible - allow spontaneous direction changes");
    } else {
      adaptations.push("MODERATE conscientiousness: Balance structure with flexibility");
    }
  }

  if (personality.agreeableness !== null) {
    if (personality.agreeableness >= thresholds.high) {
      adaptations.push("HIGH agreeableness: They're cooperative - gentle guidance works well");
    } else if (personality.agreeableness <= thresholds.low) {
      adaptations.push("LOW agreeableness: Be direct - they appreciate straightforward communication and may push back");
    } else {
      adaptations.push("MODERATE agreeableness: Direct but warm - they'll engage in healthy debate");
    }
  }

  if (personality.neuroticism !== null) {
    if (personality.neuroticism >= thresholds.high) {
      adaptations.push("HIGH neuroticism: Extra reassurance - acknowledge their concerns, slower pace");
    } else if (personality.neuroticism <= thresholds.low) {
      adaptations.push("LOW neuroticism: Emotionally stable - can handle challenge and critique well");
    }
  }

  return adaptations.length > 0 ? adaptations : ["No specific personality adaptations - use balanced approach"];
}
