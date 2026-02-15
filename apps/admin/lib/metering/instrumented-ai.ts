/**
 * Instrumented AI Client
 *
 * Wraps the AI client functions to add automatic usage metering.
 * Use these functions instead of the raw AI client to track costs.
 */

import { config } from "@/lib/config";
import {
  getAICompletion,
  getAICompletionStream,
  getConfiguredAICompletion,
  getConfiguredAICompletionStream,
  AICompletionOptions,
  AICompletionResult,
  AIStreamOptions,
  AIEngine,
  ConfiguredAIOptions,
} from "@/lib/ai/client";
import { logAIUsage } from "./usage-logger";

export interface MeteringContext {
  userId?: string;
  callerId?: string;
  callId?: string;
  sourceOp?: string;
}

/**
 * Get AI completion with automatic usage metering.
 *
 * This wraps getAICompletion and logs token usage to the metering system.
 */
export async function getMeteredAICompletion(
  options: AICompletionOptions,
  context?: MeteringContext
): Promise<AICompletionResult> {
  const result = await getAICompletion(options);

  // Log usage if we have token counts (mock doesn't provide these)
  if (result.usage && result.engine !== "mock") {
    // Fire and forget - don't block the response
    logAIUsage({
      engine: result.engine as "claude" | "openai",
      model: result.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      userId: context?.userId,
      callerId: context?.callerId,
      callId: context?.callId,
      sourceOp: context?.sourceOp,
    }).catch((error) => {
      console.error("[metering] Failed to log AI usage:", error);
    });
  }

  return result;
}

/**
 * Streaming completion with usage estimation.
 *
 * Note: Streaming responses don't provide token counts from the API.
 * We estimate based on character count (rough: ~4 chars per token).
 *
 * For accurate metering of streaming calls, consider:
 * 1. Using non-streaming for operations where you need exact counts
 * 2. Accepting the estimation for chat-style interactions
 */
export async function getMeteredAICompletionStream(
  options: AIStreamOptions,
  context?: MeteringContext
): Promise<{ stream: ReadableStream<Uint8Array>; logUsage: (outputChars: number) => void }> {
  const stream = await getAICompletionStream(options);

  // Estimate input tokens from message content
  const inputChars = options.messages.reduce((sum, m) => sum + m.content.length, 0);
  const estimatedInputTokens = Math.ceil(inputChars / 4);

  // Return stream with a callback to log output when streaming completes
  const logUsage = (outputChars: number) => {
    if (options.engine === "mock") return;

    const estimatedOutputTokens = Math.ceil(outputChars / 4);

    logAIUsage({
      engine: options.engine as "claude" | "openai",
      model: options.engine === "claude" ? config.ai.claude.model : config.ai.openai.model,
      inputTokens: estimatedInputTokens,
      outputTokens: estimatedOutputTokens,
      userId: context?.userId,
      callerId: context?.callerId,
      callId: context?.callId,
      sourceOp: context?.sourceOp,
      metadata: {
        estimated: true,
        streamingMode: true,
      },
    }).catch((error) => {
      console.error("[metering] Failed to log streaming AI usage:", error);
    });
  };

  return { stream, logUsage };
}

/**
 * Create a metering-aware stream that tracks output length.
 *
 * Wraps the stream and calls logUsage when complete.
 */
export function createMeteredStream(
  originalStream: ReadableStream<Uint8Array>,
  engine: AIEngine,
  inputMessages: { content: string }[],
  context?: MeteringContext
): ReadableStream<Uint8Array> {
  if (engine === "mock") {
    return originalStream;
  }

  let totalOutputChars = 0;
  const decoder = new TextDecoder();

  // Estimate input tokens
  const inputChars = inputMessages.reduce((sum, m) => sum + m.content.length, 0);
  const estimatedInputTokens = Math.ceil(inputChars / 4);

  return new ReadableStream({
    async start(controller) {
      const reader = originalStream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Stream complete - log usage
            const estimatedOutputTokens = Math.ceil(totalOutputChars / 4);

            logAIUsage({
              engine: engine as "claude" | "openai",
              model: engine === "claude" ? config.ai.claude.model : config.ai.openai.model,
              inputTokens: estimatedInputTokens,
              outputTokens: estimatedOutputTokens,
              userId: context?.userId,
              callerId: context?.callerId,
              callId: context?.callId,
              sourceOp: context?.sourceOp,
              metadata: {
                estimated: true,
                streamingMode: true,
              },
            }).catch((error) => {
              console.error("[metering] Failed to log streaming AI usage:", error);
            });

            controller.close();
            break;
          }

          // Count output characters
          if (value) {
            totalOutputChars += decoder.decode(value, { stream: true }).length;
            controller.enqueue(value);
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

// ============================================================
// CONFIG-AWARE METERED COMPLETIONS
// ============================================================

/**
 * Get AI completion with configuration from database and automatic metering.
 * This is the preferred method for production code.
 *
 * @param options - Includes callPoint to load config for
 * @param context - Metering context (userId, callerId, etc.)
 * @returns Completion result with model info
 */
export async function getConfiguredMeteredAICompletion(
  options: ConfiguredAIOptions,
  context?: MeteringContext
): Promise<AICompletionResult> {
  const result = await getConfiguredAICompletion(options);

  // Log usage if we have token counts (mock doesn't provide these)
  if (result.usage && result.engine !== "mock") {
    logAIUsage({
      engine: result.engine as "claude" | "openai",
      model: result.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      userId: context?.userId,
      callerId: context?.callerId,
      callId: context?.callId,
      sourceOp: context?.sourceOp || options.callPoint,
    }).catch((error) => {
      console.error("[metering] Failed to log AI usage:", error);
    });
  }

  return result;
}

/**
 * Get AI completion stream with configuration from database and automatic metering.
 *
 * @param options - Includes callPoint to load config for
 * @param context - Metering context
 * @returns Metering-aware stream
 */
export async function getConfiguredMeteredAICompletionStream(
  options: ConfiguredAIOptions,
  context?: MeteringContext
): Promise<{ stream: ReadableStream<Uint8Array>; model: string }> {
  // Import config loader to get the model info
  const { getAIConfig } = await import("@/lib/ai/config-loader");
  const config = await getAIConfig(options.callPoint);

  const stream = await getConfiguredAICompletionStream(options);

  // Wrap with metering
  const meteredStream = createMeteredStreamWithModel(
    stream,
    config.provider,
    config.model,
    options.messages,
    { ...context, sourceOp: context?.sourceOp || options.callPoint }
  );

  return { stream: meteredStream, model: config.model };
}

/**
 * Create a metering-aware stream that tracks output length.
 * Uses the actual model from config instead of hardcoded defaults.
 */
function createMeteredStreamWithModel(
  originalStream: ReadableStream<Uint8Array>,
  engine: AIEngine,
  model: string,
  inputMessages: { content: string }[],
  context?: MeteringContext
): ReadableStream<Uint8Array> {
  if (engine === "mock") {
    return originalStream;
  }

  let totalOutputChars = 0;
  const decoder = new TextDecoder();

  // Estimate input tokens
  const inputChars = inputMessages.reduce((sum, m) => sum + m.content.length, 0);
  const estimatedInputTokens = Math.ceil(inputChars / 4);

  return new ReadableStream({
    async start(controller) {
      const reader = originalStream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            const estimatedOutputTokens = Math.ceil(totalOutputChars / 4);

            logAIUsage({
              engine: engine as "claude" | "openai",
              model: model,
              inputTokens: estimatedInputTokens,
              outputTokens: estimatedOutputTokens,
              userId: context?.userId,
              callerId: context?.callerId,
              callId: context?.callId,
              sourceOp: context?.sourceOp,
              metadata: {
                estimated: true,
                streamingMode: true,
              },
            }).catch((error) => {
              console.error("[metering] Failed to log streaming AI usage:", error);
            });

            controller.close();
            break;
          }

          if (value) {
            totalOutputChars += decoder.decode(value, { stream: true }).length;
            controller.enqueue(value);
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

// Re-export commonly used types for convenience
export type { AICompletionOptions, AICompletionResult, AIStreamOptions, AIEngine, ConfiguredAIOptions };
