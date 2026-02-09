/**
 * Session Pedagogy Transform
 * Extracted from route.ts lines 2158-2229
 *
 * Uses INIT-001 first-call flow when available for new callers.
 */

import { registerTransform } from "../TransformRegistry";
import type { AssembledContext } from "../types";

/**
 * Compute session pedagogy plan (flow, review, new material, principles).
 * Uses shared state for module data, review type, first-call detection.
 * For first calls, uses INIT-001's firstCallFlow if available.
 */
registerTransform("computeSessionPedagogy", (
  _rawData: any,
  context: AssembledContext,
) => {
  const { isFirstCall, modules, moduleToReview, nextModule, reviewType, reviewReason } = context.sharedState;
  const onboardingSpec = context.loadedData.onboardingSpec;

  const plan: {
    sessionType: string;
    flow: string[];
    reviewFirst?: { module: string; reason: string; technique: string };
    newMaterial?: { module: string; approach: string };
    principles: string[];
    firstCallPhases?: Array<{
      phase: string;
      duration: string;
      priority: string;
      goals: string[];
      avoid: string[];
    }>;
    successMetrics?: string[];
  } = {
    sessionType: isFirstCall ? "FIRST_CALL" : "RETURNING_CALLER",
    flow: [],
    principles: [],
  };

  if (isFirstCall) {
    const firstModule = modules[0];

    // Use INIT-001's first-call flow if available
    if (onboardingSpec?.config?.firstCallFlow) {
      const fcFlow = onboardingSpec.config.firstCallFlow;
      plan.firstCallPhases = fcFlow.phases;
      plan.successMetrics = fcFlow.successMetrics;

      // Convert phases to flow steps
      plan.flow = fcFlow.phases.map((phase, i) =>
        `${i + 1}. ${phase.phase.charAt(0).toUpperCase() + phase.phase.slice(1)} (${phase.duration}) - ${phase.goals[0]}`
      );

      console.log(`[pedagogy] Using INIT-001 first-call flow with ${fcFlow.phases.length} phases`);
    } else {
      // Fallback to default first-call flow
      plan.flow = [
        "1. Welcome & set expectations",
        "2. Probe existing knowledge with open questions",
        `3. Introduce foundation: ${firstModule?.name || "first concept"}`,
        "4. Check understanding with application question",
        "5. Summarize & preview next session",
      ];
    }

    if (firstModule) {
      plan.newMaterial = {
        module: firstModule.name,
        approach: `Start with ${firstModule.description || "foundational concepts"}. Use concrete examples before abstractions.`,
      };
    }
  } else {
    plan.flow = [
      "1. Reconnect - reference last session specifically",
      `2. Spaced retrieval (${reviewType}) - recall question on ${moduleToReview?.name || "previous concept"}`,
      "3. Reinforce or correct based on their recall",
      `4. Bridge - connect ${moduleToReview?.name || "old"} to ${nextModule?.name || "new material"}`,
      `5. New material - introduce ${nextModule?.name || "next concept"}`,
      "6. Integrate - question using both old and new",
      "7. Close with summary and preview",
    ];

    if (moduleToReview) {
      plan.reviewFirst = {
        module: moduleToReview.name,
        reason: reviewReason,
        technique: reviewType === "quick_recall"
          ? "Ask one recall question, wait for their attempt before proceeding"
          : reviewType === "application"
            ? "Give a scenario requiring them to apply the concept"
            : "Walk through the concept again with a fresh example",
      };
    }

    if (nextModule) {
      plan.newMaterial = {
        module: nextModule.name,
        approach: `After confirming ${moduleToReview?.name || "previous"} understanding, introduce ${nextModule.description || "new concepts"}`,
      };
    }
  }

  plan.principles = [
    "Review BEFORE new material - never skip unless learner explicitly confirms mastery",
    "One main new concept per session - depth over breadth",
    "If review reveals gaps, stay on review - don't accumulate confusion",
    "Connection questions ('How does X relate to Y?') are more valuable than isolated recall",
  ];

  return plan;
});
