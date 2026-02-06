/**
 * Compute Tracker - Wraps functions to track execution time
 *
 * Use this to instrument compute-intensive operations like pipeline runs,
 * analysis operations, and imports.
 */

import { logComputeUsage } from "./usage-logger";

export interface ComputeContext {
  userId?: string;
  callerId?: string;
  sourceOp?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Wrap an async function to track its execution time.
 *
 * @param operation - Name of the operation (e.g., "pipeline", "analysis")
 * @param fn - The async function to wrap
 * @param context - Optional context for attribution
 * @returns The wrapped function
 */
export function withComputeMetering<T extends unknown[], R>(
  operation: string,
  fn: (...args: T) => Promise<R>,
  context?: ComputeContext
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();

    try {
      const result = await fn(...args);
      return result;
    } finally {
      const durationMs = Date.now() - startTime;

      // Fire and forget
      logComputeUsage({
        operation,
        durationMs,
        userId: context?.userId,
        callerId: context?.callerId,
        sourceOp: context?.sourceOp,
        metadata: {
          ...context?.metadata,
          durationMs,
        },
      }).catch((error) => {
        console.error("[metering] Failed to log compute usage:", error);
      });
    }
  };
}

/**
 * Track execution of a code block with timing.
 *
 * Usage:
 * ```
 * const result = await trackCompute("pipeline", async () => {
 *   // Your code here
 *   return await runPipeline();
 * }, { userId: "..." });
 * ```
 */
export async function trackCompute<R>(
  operation: string,
  fn: () => Promise<R>,
  context?: ComputeContext
): Promise<R> {
  const startTime = Date.now();

  try {
    const result = await fn();
    return result;
  } finally {
    const durationMs = Date.now() - startTime;

    // Fire and forget
    logComputeUsage({
      operation,
      durationMs,
      userId: context?.userId,
      callerId: context?.callerId,
      sourceOp: context?.sourceOp,
      metadata: {
        ...context?.metadata,
        durationMs,
      },
    }).catch((error) => {
      console.error("[metering] Failed to log compute usage:", error);
    });
  }
}

/**
 * Create a timer that can be started and stopped manually.
 *
 * Useful when the code isn't easily wrappable.
 *
 * Usage:
 * ```
 * const timer = createComputeTimer("analysis", { userId: "..." });
 * timer.start();
 * // ... do work ...
 * await timer.stop();
 * ```
 */
export function createComputeTimer(
  operation: string,
  context?: ComputeContext
): {
  start: () => void;
  stop: () => Promise<void>;
  elapsed: () => number;
} {
  let startTime: number | null = null;

  return {
    start() {
      startTime = Date.now();
    },

    async stop() {
      if (startTime === null) {
        console.warn("[metering] Timer stopped without being started");
        return;
      }

      const durationMs = Date.now() - startTime;
      startTime = null;

      await logComputeUsage({
        operation,
        durationMs,
        userId: context?.userId,
        callerId: context?.callerId,
        sourceOp: context?.sourceOp,
        metadata: {
          ...context?.metadata,
          durationMs,
        },
      });
    },

    elapsed() {
      if (startTime === null) return 0;
      return Date.now() - startTime;
    },
  };
}
