/**
 * Shared types for domain setup workflows (quick-launch, course-setup, community-setup).
 */

/**
 * Progress event emitted during multi-step setup workflows.
 * Consumed by API routes to stream status updates to the client.
 */
export interface ProgressEvent {
  phase: string;
  message: string;
  stepIndex?: number;
  totalSteps?: number;
  detail?: Record<string, any>;
  /** Structured data payload for progressive UI updates */
  data?: Record<string, any>;
}

/**
 * Callback for reporting progress during setup workflows.
 */
export type ProgressCallback = (event: ProgressEvent) => void;
