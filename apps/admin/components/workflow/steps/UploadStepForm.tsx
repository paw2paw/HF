"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { StepFormProps } from "@/lib/workflow/types";
import { useContentJobQueue } from "@/components/shared/ContentJobQueue";
import "./upload-step-form.css";

// ── Types ────────────────────────────────────────────────

type Phase = "upload" | "running" | "done" | "error";

interface JobProgress {
  status: string;
  currentChunk: number;
  totalChunks: number;
  extractedCount: number;
  importedCount?: number;
  duplicatesSkipped?: number;
  warnings: string[];
  error?: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Starting...",
  extracting: "Extracting teaching points",
  importing: "Saving to database",
  done: "Complete",
  error: "Failed",
};

// ── Component ────────────────────────────────────────────

export function UploadStepForm({
  step,
  prefilled,
  collectedData,
  onComplete,
  onSkip,
  onError,
}: StepFormProps) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const tickRef = useRef<NodeJS.Timeout | null>(null);
  const { addJob } = useContentJobQueue();

  // Resolve which content source to use — from a previous step or prefilled
  const sourceId =
    prefilled?.sourceId ||
    collectedData?.create_content_source?.id ||
    collectedData?.register_source?.id ||
    step.dependsOn?.reduce<string>((found, depId) => found || collectedData?.[depId]?.id || "", "") ||
    Object.values(collectedData || {}).find((d) => d?.id && d?.trustLevel)?.id ||
    "";
  const sourceName =
    prefilled?.sourceName ||
    collectedData?.create_content_source?.name ||
    collectedData?.register_source?.name ||
    step.dependsOn?.reduce<string>((found, depId) => found || collectedData?.[depId]?.name || "", "") ||
    Object.values(collectedData || {}).find((d) => d?.id && d?.trustLevel)?.name ||
    "Content Source";

  // ── Cleanup ─────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  // ── File handling ───────────────────────────────────

  const ACCEPTED = [".pdf", ".txt", ".md", ".markdown", ".json"];

  const handleFile = useCallback((f: File) => {
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      setError(`Unsupported file type: ${ext}. Accepted: ${ACCEPTED.join(", ")}`);
      return;
    }
    setFile(f);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile]
  );

  // ── Poll job status ─────────────────────────────────

  const startPolling = useCallback(
    (jid: string) => {
      // Elapsed timer
      setElapsed(0);
      tickRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

      const startedAt = Date.now();
      const TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

      // Poll every 2s
      pollRef.current = setInterval(async () => {
        if (Date.now() - startedAt > TIMEOUT_MS) {
          if (pollRef.current) clearInterval(pollRef.current);
          if (tickRef.current) clearInterval(tickRef.current);
          setError("Extraction timed out. Please try again.");
          setPhase("error");
          return;
        }
        try {
          const res = await fetch(
            `/api/content-sources/${sourceId}/import?jobId=${jid}`
          );
          const data = await res.json();
          if (!data.ok) return;

          const job = data.job as JobProgress;
          setProgress(job);

          if (job.status === "done") {
            if (pollRef.current) clearInterval(pollRef.current);
            if (tickRef.current) clearInterval(tickRef.current);
            setPhase("done");
          } else if (job.status === "error") {
            if (pollRef.current) clearInterval(pollRef.current);
            if (tickRef.current) clearInterval(tickRef.current);
            setError(job.error || "Extraction failed");
            setPhase("error");
          }
        } catch {
          // Network blip — keep polling
        }
      }, 2000);
    },
    [sourceId]
  );

  // ── Start background extraction ─────────────────────

  const handleStart = async () => {
    if (!file || !sourceId) {
      setError(
        sourceId
          ? "No file selected"
          : "No content source linked — complete the content source step first"
      );
      return;
    }

    setPhase("running");
    setError(null);
    setProgress(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", "background");
      formData.append("maxAssertions", "500");

      const res = await fetch(`/api/content-sources/${sourceId}/import`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.ok && data.jobId) {
        setJobId(data.jobId);
        setProgress({
          status: "extracting",
          currentChunk: 0,
          totalChunks: data.totalChunks || 0,
          extractedCount: 0,
          warnings: [],
        });
        addJob(data.jobId, sourceId, sourceName, file.name);
        startPolling(data.jobId);
      } else {
        setError(data.error || "Failed to start extraction");
        setPhase("upload");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setPhase("upload");
    }
  };

  // ── Complete step (can be called while still running) ─

  const handleContinue = () => {
    onComplete({
      sourceId,
      fileName: file?.name,
      jobId,
      backgroundExtraction: phase === "running",
      assertionsImported: progress?.importedCount || 0,
      extractedCount: progress?.extractedCount || 0,
      duplicatesSkipped: progress?.duplicatesSkipped || 0,
    });
  };

  // ── Progress helpers ────────────────────────────────

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const chunkPct =
    progress && progress.totalChunks > 0
      ? Math.round((progress.currentChunk / progress.totalChunks) * 100)
      : 0;

  const isDone = phase === "done";
  const isRunning = phase === "running";

  // ── Render ──────────────────────────────────────────

  return (
    <div className="hf-card">
      <h3 className="usf-title">{step.title}</h3>
      <p className="usf-desc">{step.description}</p>

      {sourceId && (
        <p className="usf-source-label">
          Uploading to: <strong>{sourceName}</strong>
        </p>
      )}

      {/* ─── Upload Phase ─── */}
      {phase === "upload" && (
        <>
          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`usf-dropzone${dragOver ? " usf-dropzone--active" : ""}`}
          >
            <div className="usf-dropzone-icon">
              {file ? "\u2705" : "\u{1F4C4}"}
            </div>
            {file ? (
              <>
                <p className="usf-dropzone-filename">{file.name}</p>
                <p className="usf-dropzone-hint">
                  {(file.size / 1024).toFixed(1)} KB — Click to change
                </p>
              </>
            ) : (
              <>
                <p className="usf-dropzone-filename">
                  Drop a document here or click to browse
                </p>
                <p className="usf-dropzone-hint">Supports PDF, TXT, MD, JSON</p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="usf-file-input-hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFile(e.target.files[0]);
            }}
          />

          {/* Actions */}
          <div className="usf-actions">
            {/* Upload is always skippable — docs can be added later via /x/content-sources */}
            <button onClick={onSkip} className="usf-btn-skip">
              Skip — upload later
            </button>
            <button
              onClick={handleStart}
              disabled={!file}
              className="usf-btn-upload"
            >
              Upload &amp; Extract Teaching Points
            </button>
          </div>
        </>
      )}

      {/* ─── Running / Done Phase ─── */}
      {(isRunning || isDone) && (
        <div className="usf-phase-body">
          {/* Status header */}
          <div className="usf-status-header">
            {isRunning && (
              <span className="usf-pulse-dot" />
            )}
            {isDone && (
              <span className="usf-done-badge">{"\u2713"}</span>
            )}
            <span className={`usf-status-text${isDone ? " usf-status-text--done" : ""}`}>
              {isDone
                ? `${progress?.importedCount ?? progress?.extractedCount ?? 0} teaching points imported`
                : progress
                  ? (STATUS_LABELS[progress.status] || progress.status)
                  : "Starting extraction..."}
            </span>
            {isRunning && (
              <span className="usf-elapsed">{timeStr}</span>
            )}
          </div>

          {/* Progress bar */}
          {progress && progress.totalChunks > 0 && (
            <div className="usf-progress-wrap">
              <div className="usf-progress-track">
                <div
                  className={`usf-progress-fill${isDone ? " usf-progress-fill--done" : ""}`}
                  style={isDone ? undefined : { width: `${chunkPct}%` }}
                />
              </div>
              <div className="usf-progress-labels">
                <span>
                  {progress.currentChunk} / {progress.totalChunks} chunks
                </span>
                <span>{progress.extractedCount} teaching points found</span>
              </div>
            </div>
          )}

          {/* Indeterminate bar when starting (no progress yet) */}
          {!progress && isRunning && (
            <div className="usf-progress-wrap">
              <div className="usf-progress-track">
                <div className="usf-progress-fill usf-progress-fill--indeterminate" />
              </div>
              <p className="usf-preparing-text">
                Reading document and preparing chunks...
              </p>
            </div>
          )}

          {/* File name */}
          <p className="usf-filename">{file?.name}</p>

          {/* Extraction details */}
          {isDone && (() => {
            const w = progress?.warnings || [];
            const dupes = progress?.duplicatesSkipped ?? 0;
            const skipped = w.filter((s) => s.startsWith("Skipped "));
            const linked = w.filter((s) => s.startsWith("Linked "));
            const reference = w.filter((s) => s.includes("reference content"));
            const orphaned = w.filter((s) => s.includes("could not be linked"));
            const other = w.filter(
              (s) => !skipped.includes(s) && !linked.includes(s) &&
                     !reference.includes(s) && !orphaned.includes(s)
            );
            const hasDetails = dupes > 0 || w.length > 0;

            if (!hasDetails) return null;

            return (
              <div className="usf-details-box">
                {dupes > 0 && (
                  <div className="usf-detail-muted">
                    {dupes} duplicate{dupes !== 1 ? "s" : ""} skipped
                  </div>
                )}
                {skipped.map((s, i) => (
                  <div key={`s-${i}`} className="usf-detail-muted">{s}</div>
                ))}
                {reference.map((s, i) => (
                  <div key={`r-${i}`} className="usf-detail-muted">{s}</div>
                ))}
                {linked.map((s, i) => (
                  <div key={`l-${i}`} className="usf-detail-success">{s}</div>
                ))}
                {orphaned.map((s, i) => (
                  <div key={`o-${i}`} className="usf-detail-muted">{s}</div>
                ))}
                {other.map((s, i) => (
                  <div key={`w-${i}`} className="usf-detail-muted">{s}</div>
                ))}
              </div>
            );
          })()}

          {/* Actions — ALWAYS visible so user can continue */}
          <div className="usf-actions">
            <button onClick={handleContinue} className="usf-btn-continue">
              {isRunning ? "Continue (runs in background)" : "Continue"}
            </button>
          </div>
        </div>
      )}

      {/* ─── Error Phase ─── */}
      {phase === "error" && (
        <div className="usf-phase-body">
          <div className="usf-error-box">
            <p className="usf-error-title">Extraction failed</p>
            {error && (
              <p className="usf-error-detail">{error}</p>
            )}
          </div>
          <div className="usf-actions usf-actions--flush">
            <button
              onClick={() => {
                setPhase("upload");
                setError(null);
                setJobId(null);
                setProgress(null);
              }}
              className="usf-btn-skip"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Inline error for upload phase */}
      {phase === "upload" && error && (
        <div className="usf-inline-error">{error}</div>
      )}
    </div>
  );
}
