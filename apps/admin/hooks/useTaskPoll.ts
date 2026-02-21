"use client";

import { useEffect, useRef } from "react";
import {
  TASK_STATUS,
  isTerminal,
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
} from "@/lib/tasks/constants";

/**
 * Server task shape returned by /api/tasks.
 * Intentionally loose — the API returns varying shapes.
 */
export interface PollableTask {
  id: string;
  status: string;
  context?: Record<string, any>;
  currentStep?: number;
  totalSteps?: number;
  [key: string]: any;
}

export interface UseTaskPollOptions {
  /** Task ID to poll. Set to null to disable polling. */
  taskId: string | null;
  /** Called on every non-terminal poll response. */
  onProgress?: (task: PollableTask) => void;
  /** Called exactly once when status === "completed". */
  onComplete: (task: PollableTask) => void;
  /** Called when: abandoned, timed out, or in_progress with ctx.error. */
  onError: (message: string, task?: PollableTask) => void;
  /** Override default 3-minute timeout. */
  timeoutMs?: number;
  /** Override default 3-second interval. */
  intervalMs?: number;
}

/**
 * Reusable polling hook for UserTask status.
 *
 * Enforces:
 * - All terminal states are detected (completed + abandoned)
 * - 3-minute timeout (configurable) to prevent infinite spinners
 * - Guards against orphaned error state (in_progress + ctx.error)
 * - Proper cleanup on unmount
 *
 * Modelled on the PlanStep.tsx gold standard implementation.
 */
export function useTaskPoll({
  taskId,
  onProgress,
  onComplete,
  onError,
  timeoutMs = POLL_TIMEOUT_MS,
  intervalMs = POLL_INTERVAL_MS,
}: UseTaskPollOptions): void {
  // Store callbacks in refs so the effect doesn't re-run on callback identity changes
  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onProgressRef.current = onProgress;
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!taskId) return;

    const startedAt = Date.now();
    let stopped = false;

    const interval = setInterval(async () => {
      if (stopped) return;

      // Timeout guard
      if (Date.now() - startedAt > timeoutMs) {
        stopped = true;
        clearInterval(interval);
        onErrorRef.current("Task timed out. Please try again.");
        return;
      }

      try {
        const res = await fetch(`/api/tasks?taskId=${taskId}`);
        if (!res.ok) return; // Network issue — keep polling

        const data = await res.json();
        const task: PollableTask | undefined =
          data.task || data.tasks?.[0] || data.guidance?.task;

        if (!task) return; // Task not found yet — keep polling

        const ctx = task.context || {};

        if (task.status === TASK_STATUS.COMPLETED) {
          stopped = true;
          clearInterval(interval);
          onCompleteRef.current(task);
        } else if (isTerminal(task.status)) {
          // abandoned or any future terminal status
          stopped = true;
          clearInterval(interval);
          onErrorRef.current(ctx.error || "Task failed.", task);
        } else if (
          task.status === TASK_STATUS.IN_PROGRESS &&
          ctx.error
        ) {
          // Orphaned error: backend set ctx.error but didn't change status
          stopped = true;
          clearInterval(interval);
          onErrorRef.current(ctx.error, task);
        } else {
          // Still in progress — report progress
          onProgressRef.current?.(task);
        }
      } catch {
        // Network error — keep polling silently
      }
    }, intervalMs);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [taskId, timeoutMs, intervalMs]);
}
