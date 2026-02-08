/**
 * Pipeline Tracing System
 *
 * Provides instrumentation for recording pipeline executions.
 * Used by the pipeline visualization UI to show actual run data.
 */

import { prisma } from "@/lib/prisma";
import type { PipelinePhase, PipelineStepStatus } from "@prisma/client";

// =============================================================================
// TYPES
// =============================================================================

export interface TraceContext {
  runId: string;
  phase: PipelinePhase;
  callerId?: string | null;
  callId?: string | null;
  stepIndex: number;
}

export interface StepResult<T> {
  data: T;
  counts?: Record<string, number>;
  recordIds?: Record<string, string[]>;
}

export interface ComposeStepResult<T> extends StepResult<T> {
  sectionsActivated?: string[];
  sectionsSkipped?: string[];
  sectionTimings?: Record<string, number>;
}

// Helper to safely convert to JSON-serializable value
function toJson(value: unknown): object | undefined {
  if (value === null || value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

// =============================================================================
// MAIN API
// =============================================================================

/**
 * Start a new pipeline run and return a trace context
 */
export async function startPipelineRun(opts: {
  phase: PipelinePhase;
  callerId?: string | null;
  callId?: string | null;
  triggeredBy?: string;
  metadata?: Record<string, unknown>;
}): Promise<TraceContext> {
  const run = await prisma.pipelineRun.create({
    data: {
      phase: opts.phase,
      callerId: opts.callerId ?? null,
      callId: opts.callId ?? null,
      triggeredBy: opts.triggeredBy ?? "manual",
      status: "RUNNING",
      metadata: toJson(opts.metadata),
    },
  });

  return {
    runId: run.id,
    phase: opts.phase,
    callerId: opts.callerId,
    callId: opts.callId,
    stepIndex: 0,
  };
}

/**
 * Trace a pipeline step with automatic timing and error handling
 *
 * @example
 * const personality = await traceStep(ctx, "personality:analyze", {
 *   label: "Analyze Personality",
 *   specSlug: "personality",
 *   inputs: { callId, transcriptLength: call.transcript.length }
 * }, async () => {
 *   const result = await analyzePersonality(call);
 *   return {
 *     data: result,
 *     counts: { traitsScored: 5 },
 *     recordIds: { scores: result.scores.map(s => s.id) }
 *   };
 * });
 */
export async function traceStep<T>(
  ctx: TraceContext,
  operation: string,
  opts: {
    label?: string;
    specId?: string;
    specSlug?: string;
    inputs?: Record<string, unknown>;
    inputCounts?: Record<string, number>;
  },
  fn: () => Promise<StepResult<T>>
): Promise<T> {
  const step = await prisma.pipelineStep.create({
    data: {
      runId: ctx.runId,
      operation,
      label: opts.label,
      specId: opts.specId,
      specSlug: opts.specSlug,
      sortOrder: ctx.stepIndex,
      status: "RUNNING",
      startedAt: new Date(),
      inputs: toJson(opts.inputs),
      inputCounts: toJson(opts.inputCounts),
    },
  });

  ctx.stepIndex++;
  const startTime = Date.now();

  try {
    const result = await fn();

    await prisma.pipelineStep.update({
      where: { id: step.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        durationMs: Date.now() - startTime,
        outputs: toJson(result.data),
        outputCounts: toJson(result.counts),
        createdRecordIds: toJson(result.recordIds),
      },
    });

    return result.data;
  } catch (error) {
    await prisma.pipelineStep.update({
      where: { id: step.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      },
    });
    throw error;
  }
}

/**
 * Trace a compose step with section-level details
 */
export async function traceComposeStep<T>(
  ctx: TraceContext,
  opts: {
    label?: string;
    specId?: string;
    specSlug?: string;
    inputs?: Record<string, unknown>;
    inputCounts?: Record<string, number>;
  },
  fn: () => Promise<ComposeStepResult<T>>
): Promise<T> {
  const step = await prisma.pipelineStep.create({
    data: {
      runId: ctx.runId,
      operation: "prompt:compose",
      label: opts.label ?? "Compose Prompt",
      specId: opts.specId,
      specSlug: opts.specSlug ?? "compose-prompt",
      sortOrder: ctx.stepIndex,
      status: "RUNNING",
      startedAt: new Date(),
      inputs: toJson(opts.inputs),
      inputCounts: toJson(opts.inputCounts),
    },
  });

  ctx.stepIndex++;
  const startTime = Date.now();

  try {
    const result = await fn();

    await prisma.pipelineStep.update({
      where: { id: step.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        durationMs: Date.now() - startTime,
        outputs: toJson(result.data),
        outputCounts: toJson(result.counts),
        createdRecordIds: toJson(result.recordIds),
        sectionsActivated: result.sectionsActivated ?? [],
        sectionsSkipped: result.sectionsSkipped ?? [],
        sectionTimings: toJson(result.sectionTimings),
      },
    });

    return result.data;
  } catch (error) {
    await prisma.pipelineStep.update({
      where: { id: step.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      },
    });
    throw error;
  }
}

/**
 * Record a skipped step (condition not met)
 */
export async function traceSkippedStep(
  ctx: TraceContext,
  operation: string,
  opts: {
    label?: string;
    reason: string;
  }
): Promise<void> {
  await prisma.pipelineStep.create({
    data: {
      runId: ctx.runId,
      operation,
      label: opts.label,
      sortOrder: ctx.stepIndex,
      status: "SKIPPED",
      startedAt: new Date(),
      finishedAt: new Date(),
      durationMs: 0,
      error: opts.reason,
    },
  });
  ctx.stepIndex++;
}

/**
 * Finish a pipeline run and compute summary stats
 */
export async function finishPipelineRun(ctx: TraceContext): Promise<void> {
  const steps = await prisma.pipelineStep.findMany({
    where: { runId: ctx.runId },
    select: { status: true, durationMs: true, error: true },
  });

  const stats = {
    stepsTotal: steps.length,
    stepsSucceeded: steps.filter((s) => s.status === "SUCCESS").length,
    stepsFailed: steps.filter((s) => s.status === "FAILED").length,
    stepsSkipped: steps.filter((s) => s.status === "SKIPPED").length,
  };

  const failedStep = steps.find((s) => s.status === "FAILED");
  const overallStatus: PipelineStepStatus =
    stats.stepsFailed > 0 ? "FAILED" : "SUCCESS";

  await prisma.pipelineRun.update({
    where: { id: ctx.runId },
    data: {
      status: overallStatus,
      finishedAt: new Date(),
      durationMs: steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0),
      errorSummary: failedStep?.error ?? null,
      ...stats,
    },
  });
}

/**
 * Mark a pipeline run as failed (for top-level errors)
 */
export async function failPipelineRun(
  ctx: TraceContext,
  error: Error | string
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : error;

  await prisma.pipelineRun.update({
    where: { id: ctx.runId },
    data: {
      status: "FAILED",
      finishedAt: new Date(),
      errorSummary: errorMessage,
    },
  });
}

// =============================================================================
// QUERY HELPERS
// =============================================================================

/**
 * Get recent pipeline runs for a caller
 */
export async function getRecentRuns(opts: {
  callerId?: string;
  phase?: PipelinePhase;
  limit?: number;
}) {
  return prisma.pipelineRun.findMany({
    where: {
      ...(opts.callerId && { callerId: opts.callerId }),
      ...(opts.phase && { phase: opts.phase }),
    },
    include: {
      steps: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { startedAt: "desc" },
    take: opts.limit ?? 20,
  });
}

/**
 * Get a single pipeline run with all details
 */
export async function getPipelineRun(runId: string) {
  return prisma.pipelineRun.findUnique({
    where: { id: runId },
    include: {
      steps: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

/**
 * Get pipeline runs for a specific call
 */
export async function getRunsForCall(callId: string) {
  return prisma.pipelineRun.findMany({
    where: { callId },
    include: {
      steps: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { startedAt: "desc" },
  });
}
