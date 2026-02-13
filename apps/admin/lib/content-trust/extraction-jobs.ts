/**
 * In-memory extraction job tracker.
 *
 * Tracks background assertion extraction jobs so the UI can poll for progress
 * and the user can continue with other workflow steps while extraction runs.
 *
 * Jobs are kept in memory (single-process). On restart, in-flight jobs are lost
 * but the user can re-upload. For the market test phase this is fine.
 */

export type JobStatus = "pending" | "extracting" | "importing" | "done" | "error";

export interface ExtractionJob {
  id: string;
  sourceId: string;
  fileName: string;
  status: JobStatus;
  /** Current chunk being processed (0-based) */
  currentChunk: number;
  totalChunks: number;
  /** Assertions extracted so far */
  extractedCount: number;
  /** Assertions saved to DB (only set after import) */
  importedCount?: number;
  duplicatesSkipped?: number;
  warnings: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
}

// Simple in-memory store — keyed by job ID
const jobs = new Map<string, ExtractionJob>();

// Auto-clean jobs older than 1 hour
const MAX_AGE_MS = 60 * 60 * 1000;

function cleanup() {
  const cutoff = Date.now() - MAX_AGE_MS;
  for (const [id, job] of jobs) {
    if (new Date(job.createdAt).getTime() < cutoff) {
      jobs.delete(id);
    }
  }
}

export function createJob(sourceId: string, fileName: string): ExtractionJob {
  cleanup();
  const id = `exj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job: ExtractionJob = {
    id,
    sourceId,
    fileName,
    status: "pending",
    currentChunk: 0,
    totalChunks: 0,
    extractedCount: 0,
    warnings: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): ExtractionJob | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<ExtractionJob>) {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
}
