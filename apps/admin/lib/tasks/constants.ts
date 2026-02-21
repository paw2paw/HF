/**
 * Task Status Constants
 *
 * Single source of truth for task terminal states, polling intervals,
 * and status checks. All polling loops and status comparisons should
 * import from here — never use raw status strings.
 *
 * Prisma enum: TaskStatus { in_progress, completed, abandoned }
 */

export const TASK_STATUS = {
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
} as const;

export type TaskStatusValue = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

/** All statuses where polling should stop. */
export const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  TASK_STATUS.COMPLETED,
  TASK_STATUS.ABANDONED,
]);

/** Returns true if the status is terminal (polling should stop). */
export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Returns true if the status represents a failure. */
export function isFailure(status: string): boolean {
  return status === TASK_STATUS.ABANDONED;
}

/** Default polling interval (ms). */
export const POLL_INTERVAL_MS = 3_000;

/** Default polling timeout (ms). After this, client-side marks as timed out. */
export const POLL_TIMEOUT_MS = 3 * 60 * 1_000;
