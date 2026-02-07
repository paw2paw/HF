/**
 * Metering System - Resource Usage Tracking
 *
 * This module provides comprehensive resource metering for tracking
 * AI, database, compute, storage, and external API usage.
 *
 * Usage:
 *
 * ```typescript
 * // Log AI usage
 * import { logAIUsage } from "@/lib/metering";
 * await logAIUsage({
 *   engine: "claude",
 *   model: "claude-sonnet-4",
 *   inputTokens: 500,
 *   outputTokens: 100,
 *   sourceOp: "compose-prompt",
 * });
 *
 * // Use instrumented AI client
 * import { getMeteredAICompletion } from "@/lib/metering";
 * const result = await getMeteredAICompletion(options, { sourceOp: "chat" });
 *
 * // Track compute time
 * import { trackCompute } from "@/lib/metering";
 * const result = await trackCompute("pipeline", async () => {
 *   return await runPipeline();
 * });
 * ```
 */

// Core logging
export {
  logUsageEvent,
  logUsageEventsBatch,
  logUsageEventFireAndForget,
  logAIUsage,
  logSlowQuery,
  logComputeUsage,
  logStorageUsage,
  logExternalAPIUsage,
  type UsageEventInput,
  type UsageEventResult,
} from "./usage-logger";

// Cost configuration
export {
  getCostRate,
  calculateCost,
  clearRateCache,
  getDefaultRates,
  DEFAULT_COST_RATES,
} from "./cost-config";

// Instrumented AI client
export {
  getMeteredAICompletion,
  getMeteredAICompletionStream,
  createMeteredStream,
  getConfiguredMeteredAICompletion,
  getConfiguredMeteredAICompletionStream,
  type MeteringContext,
} from "./instrumented-ai";

// Compute tracking
export {
  withComputeMetering,
  trackCompute,
  createComputeTimer,
  type ComputeContext,
} from "./compute-tracker";

// Rollup operations
export {
  runUsageRollup,
  cleanupOldUsageData,
  getUsageSummary,
  getTotalCost,
  getRecentEvents,
  type RollupOptions,
  type RollupResult,
  type CleanupResult,
} from "./rollup";
