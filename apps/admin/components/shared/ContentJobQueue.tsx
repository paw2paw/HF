"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

// ── Types (mirrors server-side ExtractionJob shape) ──

type JobStatus = "pending" | "extracting" | "importing" | "done" | "error";

interface JobProgress {
  status: JobStatus;
  currentChunk: number;
  totalChunks: number;
  extractedCount: number;
  importedCount?: number;
  duplicatesSkipped?: number;
  warnings: string[];
  error?: string;
}

export interface QueuedJob {
  jobId: string;
  sourceId: string;
  sourceName: string;
  fileName: string;
  startedAt: number;
  progress: JobProgress;
}

// ── Context ──

interface ContentJobQueueContextValue {
  jobs: QueuedJob[];
  addJob: (jobId: string, sourceId: string, sourceName: string, fileName: string) => void;
  dismissJob: (jobId: string) => void;
  activeCount: number;
}

const ContentJobQueueContext = createContext<ContentJobQueueContextValue>({
  jobs: [],
  addJob: () => {},
  dismissJob: () => {},
  activeCount: 0,
});

export function useContentJobQueue() {
  return useContext(ContentJobQueueContext);
}

// ── localStorage key ──

const STORAGE_KEY = "hf.extraction-jobs";
const POLL_INTERVAL_MS = 3000;
const DONE_TTL_MS = 30_000;
const ERROR_TTL_MS = 60_000;
const MAX_STORED_JOBS = 50;

function loadJobs(): QueuedJob[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedJob[];
    // Prune old jobs (> 1 hour)
    const cutoff = Date.now() - 60 * 60 * 1000;
    return parsed.filter((j) => j.startedAt > cutoff).slice(0, MAX_STORED_JOBS);
  } catch {
    return [];
  }
}

function saveJobs(jobs: QueuedJob[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.slice(0, MAX_STORED_JOBS)));
  } catch {
    // localStorage full — silently fail
  }
}

// ── Provider ──

export function ContentJobQueueProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<QueuedJob[]>([]);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    setJobs(loadJobs());
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (jobs.length > 0 || localStorage.getItem(STORAGE_KEY)) {
      saveJobs(jobs);
    }
  }, [jobs]);

  // Auto-prune completed/error jobs after TTL
  useEffect(() => {
    const interval = setInterval(() => {
      setJobs((prev) => {
        const now = Date.now();
        const filtered = prev.filter((j) => {
          if (j.progress.status === "done") {
            // Find when it finished — approximate via last poll
            return true; // keep for now, remove via dismissJob or age
          }
          return true;
        });
        return filtered;
      });
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  // Poll active jobs
  useEffect(() => {
    async function pollJobs() {
      const current = jobsRef.current;
      const active = current.filter(
        (j) => j.progress.status === "pending" || j.progress.status === "extracting" || j.progress.status === "importing"
      );
      if (active.length === 0) return;

      const updates = await Promise.allSettled(
        active.map(async (j) => {
          const res = await fetch(`/api/content-sources/${j.sourceId}/import?jobId=${j.jobId}`);
          if (!res.ok) return null;
          const data = await res.json();
          if (!data.ok || !data.job) return null;
          return { jobId: j.jobId, progress: data.job as JobProgress };
        })
      );

      setJobs((prev) => {
        let changed = false;
        const next = prev.map((j) => {
          const result = updates.find(
            (u) => u.status === "fulfilled" && u.value?.jobId === j.jobId
          );
          if (result?.status === "fulfilled" && result.value) {
            changed = true;
            return { ...j, progress: result.value.progress };
          }
          return j;
        });
        return changed ? next : prev;
      });
    }

    pollRef.current = setInterval(pollJobs, POLL_INTERVAL_MS);
    // Also poll immediately
    pollJobs();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const addJob = useCallback(
    (jobId: string, sourceId: string, sourceName: string, fileName: string) => {
      setJobs((prev) => {
        // Deduplicate
        if (prev.some((j) => j.jobId === jobId)) return prev;
        return [
          {
            jobId,
            sourceId,
            sourceName,
            fileName,
            startedAt: Date.now(),
            progress: {
              status: "extracting" as JobStatus,
              currentChunk: 0,
              totalChunks: 0,
              extractedCount: 0,
              warnings: [],
            },
          },
          ...prev,
        ];
      });
    },
    []
  );

  const dismissJob = useCallback((jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.jobId !== jobId));
  }, []);

  const activeCount = jobs.filter(
    (j) => j.progress.status === "pending" || j.progress.status === "extracting" || j.progress.status === "importing"
  ).length;

  return (
    <ContentJobQueueContext.Provider value={{ jobs, addJob, dismissJob, activeCount }}>
      {children}
    </ContentJobQueueContext.Provider>
  );
}

// ── UI Component ──

export function ContentJobQueue() {
  const { jobs, dismissJob, activeCount } = useContentJobQueue();
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  // Nothing to show
  if (jobs.length === 0) return null;

  const elapsed = (startedAt: number) => {
    const s = Math.floor((Date.now() - startedAt) / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };

  const pct = (p: JobProgress) =>
    p.totalChunks > 0 ? Math.round((p.currentChunk / p.totalChunks) * 100) : 0;

  const statusColor = (s: JobStatus) => {
    switch (s) {
      case "done": return "#16a34a";
      case "error": return "#B71C1C";
      default: return "var(--accent-primary)";
    }
  };

  const statusLabel = (p: JobProgress) => {
    switch (p.status) {
      case "pending": return "Queued";
      case "extracting": return `Extracting${p.extractedCount > 0 ? ` (${p.extractedCount})` : ""}`;
      case "importing": return "Saving...";
      case "done": return `${p.importedCount ?? p.extractedCount ?? 0} imported`;
      case "error": return p.error || "Failed";
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 9999,
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      {/* Collapsed badge */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: 12,
            border: "1px solid var(--border-primary)",
            background: "var(--surface-primary)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          {activeCount > 0 && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--accent-primary)",
                animation: "cjq-pulse 1.5s ease-in-out infinite",
              }}
            />
          )}
          <span>
            {activeCount > 0
              ? `${activeCount} extraction${activeCount > 1 ? "s" : ""} running`
              : `${jobs.length} extraction${jobs.length > 1 ? "s" : ""}`}
          </span>
          <style>{`@keyframes cjq-pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
        </button>
      )}

      {/* Expanded panel */}
      {expanded && (
        <div
          style={{
            width: 360,
            maxHeight: 400,
            borderRadius: 12,
            border: "1px solid var(--border-primary)",
            background: "var(--surface-primary)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid var(--border-secondary)",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
              Content Extractions
            </span>
            <button
              onClick={() => setExpanded(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 18,
                color: "var(--text-muted)",
                lineHeight: 1,
                padding: "2px 4px",
              }}
              aria-label="Minimize"
            >
              &minus;
            </button>
          </div>

          {/* Job list */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {jobs.map((job) => (
              <div
                key={job.jobId}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border-secondary)",
                  cursor: job.progress.status === "done" ? "pointer" : "default",
                }}
                onClick={() => {
                  if (job.progress.status === "done") {
                    router.push("/x/content-sources");
                    setExpanded(false);
                  }
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {job.sourceName}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {job.fileName}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: statusColor(job.progress.status), fontWeight: 600 }}>
                      {statusLabel(job.progress)}
                    </span>
                    {(job.progress.status === "done" || job.progress.status === "error") && (
                      <button
                        onClick={(e) => { e.stopPropagation(); dismissJob(job.jobId); }}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 14,
                          color: "var(--text-muted)",
                          padding: "0 2px",
                          lineHeight: 1,
                        }}
                        aria-label="Dismiss"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar for active jobs */}
                {(job.progress.status === "extracting" || job.progress.status === "importing") && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ height: 3, borderRadius: 2, background: "var(--surface-tertiary)", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          borderRadius: 2,
                          background: "linear-gradient(90deg, var(--accent-primary), #6366f1)",
                          width: `${pct(job.progress)}%`,
                          transition: "width 0.5s ease-out",
                          minWidth: job.progress.totalChunks === 0 ? "30%" : undefined,
                          animation: job.progress.totalChunks === 0 ? "cjq-indeterminate 1.5s ease-in-out infinite" : undefined,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 10,
                        color: "var(--text-muted)",
                        marginTop: 2,
                      }}
                    >
                      <span>
                        {job.progress.totalChunks > 0
                          ? `chunk ${job.progress.currentChunk}/${job.progress.totalChunks}`
                          : "starting..."}
                      </span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{elapsed(job.startedAt)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <style>{`@keyframes cjq-indeterminate { 0% { margin-left:0 } 50% { margin-left:70% } 100% { margin-left:0 } }`}</style>
        </div>
      )}
    </div>
  );
}
