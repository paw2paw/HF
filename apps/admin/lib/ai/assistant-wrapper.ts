/**
 * AI Assistant Wrapper
 *
 * Provides easy integration of knowledge accumulation and task tracking
 * for all AI assistant endpoints.
 */

import { logAIInteraction, AIInteraction } from "./knowledge-accumulation";
import { getContextForCallPoint } from "./system-context";

export interface AssistantCall {
  callPoint: string;
  userMessage: string;
  metadata?: {
    entityType?: string;
    entityId?: string;
    action?: string;
    [key: string]: any;
  };
}

export interface AssistantResult {
  response: string;
  success: boolean;
  fieldUpdates?: any;
  suggestions?: any;
}

/**
 * Wrap an AI call with automatic knowledge logging.
 * Call this AFTER getting the AI response to log the interaction.
 */
export async function logAssistantCall(
  call: AssistantCall,
  result: AssistantResult,
  userFeedback?: string
): Promise<void> {
  const interaction: AIInteraction = {
    callPoint: call.callPoint,
    userMessage: call.userMessage,
    aiResponse: result.response,
    outcome: result.success ? "success" : "failure",
    metadata: {
      ...call.metadata,
      userFeedback,
    },
  };

  // Log in background (don't await to avoid slowing response)
  logAIInteraction(interaction).catch((err) => {
    console.error("[AI Learning] Failed to log interaction:", err);
  });
}

/**
 * Load system context for an assistant call.
 * Convenience wrapper around getContextForCallPoint.
 */
export async function loadAssistantContext(callPoint: string) {
  return await getContextForCallPoint(callPoint);
}

/**
 * Helper to log corrections when user modifies AI output.
 * Use this when user edits/corrects fields that AI filled in.
 */
export async function logCorrection(
  callPoint: string,
  fieldName: string,
  aiValue: string,
  userValue: string
): Promise<void> {
  const interaction: AIInteraction = {
    callPoint,
    userMessage: `Corrected ${fieldName}`,
    aiResponse: aiValue,
    outcome: "correction",
    metadata: {
      action: "correction",
      fieldName,
      corrections: userValue,
    },
  };

  logAIInteraction(interaction).catch((err) => {
    console.error("[AI Learning] Failed to log correction:", err);
  });
}
