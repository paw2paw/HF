"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { StepFormProps } from "@/lib/workflow/types";
import { useContentJobQueue } from "@/components/shared/ContentJobQueue";

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
    <div
      style={{
        background: "var(--surface-primary)",
        border: "1px solid var(--border-default)",
        borderRadius: 16,
        padding: 24,
      }}
    >
      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text-primary)",
          margin: "0 0 4px",
        }}
      >
        {step.title}
      </h3>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 8px" }}>
        {step.description}
      </p>

      {sourceId && (
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 20px" }}>
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
            style={{
              padding: 40,
              borderRadius: 12,
              border: `2px dashed ${dragOver ? "var(--accent-primary)" : "var(--border-default)"}`,
              background: dragOver
                ? "color-mix(in srgb, var(--accent-primary) 8%, transparent)"
                : "var(--surface-secondary)",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>
              {file ? "\u2705" : "\u{1F4C4}"}
            </div>
            {file ? (
              <>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                  {file.name}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  {(file.size / 1024).toFixed(1)} KB — Click to change
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                  Drop a document here or click to browse
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Supports PDF, TXT, MD, JSON
                </p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files?.[0]) handleFile(e.target.files[0]);
            }}
          />

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
            {/* Upload is always skippable — docs can be added later via /x/content-sources */}
            <button
              onClick={onSkip}
              style={{
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 10,
                border: "1px solid var(--border-default)",
                background: "var(--surface-secondary)",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              Skip — upload later
            </button>
            <button
              onClick={handleStart}
              disabled={!file}
              style={{
                padding: "10px 24px",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 10,
                border: "none",
                background: file
                  ? "var(--accent-primary)"
                  : "var(--surface-tertiary)",
                color: file ? "var(--button-primary-text, var(--surface-primary))" : "var(--text-muted)",
                cursor: file ? "pointer" : "default",
                boxShadow: file ? "0 4px 12px color-mix(in srgb, var(--accent-primary) 30%, transparent)" : "none",
              }}
            >
              Upload &amp; Extract Teaching Points
            </button>
          </div>
        </>
      )}

      {/* ─── Running / Done Phase ─── */}
      {(isRunning || isDone) && (
        <div style={{ padding: "12px 0" }}>
          {/* Status header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
            }}
          >
            {isRunning && (
              <>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "var(--accent-primary)",
                    animation: "pulse 1.5s ease-in-out infinite",
                    flexShrink: 0,
                  }}
                />
                <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>
              </>
            )}
            {isDone && (
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  background: "var(--success-text)",
                  color: "var(--surface-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {"\u2713"}
              </span>
            )}
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: isDone ? "var(--success-text)" : "var(--text-primary)",
              }}
            >
              {isDone
                ? `${progress?.importedCount ?? progress?.extractedCount ?? 0} teaching points imported`
                : progress
                  ? (STATUS_LABELS[progress.status] || progress.status)
                  : "Starting extraction..."}
            </span>
            {isRunning && (
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginLeft: "auto",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {timeStr}
              </span>
            )}
          </div>

          {/* Progress bar */}
          {progress && progress.totalChunks > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: "var(--surface-tertiary)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 3,
                    background: isDone
                      ? "var(--success-text)"
                      : "linear-gradient(90deg, var(--accent-primary), var(--accent-primary))",
                    width: isDone ? "100%" : `${chunkPct}%`,
                    transition: "width 0.5s ease-out",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 4,
                  fontSize: 11,
                  color: "var(--text-muted)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span>
                  {progress.currentChunk} / {progress.totalChunks} chunks
                </span>
                <span>{progress.extractedCount} teaching points found</span>
              </div>
            </div>
          )}

          {/* Indeterminate bar when starting (no progress yet) */}
          {!progress && isRunning && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: "var(--surface-tertiary)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 3,
                    width: "30%",
                    background: "linear-gradient(90deg, var(--accent-primary), var(--accent-primary))",
                    animation: "indeterminate 1.5s ease-in-out infinite",
                  }}
                />
              </div>
              <style>{`@keyframes indeterminate { 0% { margin-left: 0; } 50% { margin-left: 70%; } 100% { margin-left: 0; } }`}</style>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                Reading document and preparing chunks...
              </p>
            </div>
          )}

          {/* File name */}
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 4px" }}>
            {file?.name}
          </p>

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
              <div style={{
                marginTop: 12, padding: "10px 14px", borderRadius: 8,
                background: "var(--surface-secondary)", fontSize: 12, lineHeight: 1.7,
              }}>
                {dupes > 0 && (
                  <div style={{ color: "var(--text-muted)" }}>
                    {dupes} duplicate{dupes !== 1 ? "s" : ""} skipped
                  </div>
                )}
                {skipped.map((s, i) => (
                  <div key={`s-${i}`} style={{ color: "var(--text-muted)" }}>{s}</div>
                ))}
                {reference.map((s, i) => (
                  <div key={`r-${i}`} style={{ color: "var(--text-muted)" }}>{s}</div>
                ))}
                {linked.map((s, i) => (
                  <div key={`l-${i}`} style={{ color: "var(--status-success-text)" }}>{s}</div>
                ))}
                {orphaned.map((s, i) => (
                  <div key={`o-${i}`} style={{ color: "var(--text-muted)" }}>{s}</div>
                ))}
                {other.map((s, i) => (
                  <div key={`w-${i}`} style={{ color: "var(--text-muted)" }}>{s}</div>
                ))}
              </div>
            );
          })()}

          {/* Actions — ALWAYS visible so user can continue */}
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "flex-end",
              marginTop: 20,
            }}
          >
            <button
              onClick={handleContinue}
              style={{
                padding: "10px 24px",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 10,
                border: "none",
                background:
                  "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary) 100%)",
                color: "var(--surface-primary)",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
              }}
            >
              {isRunning ? "Continue (runs in background)" : "Continue"}
            </button>
          </div>
        </div>
      )}

      {/* ─── Error Phase ─── */}
      {phase === "error" && (
        <div style={{ padding: "12px 0" }}>
          <div
            style={{
              padding: "16px 20px",
              borderRadius: 10,
              background: "var(--error-bg)",
              border: "1px solid var(--error-border)",
              marginBottom: 16,
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--error-text)", margin: 0 }}>
              Extraction failed
            </p>
            {error && (
              <p style={{ fontSize: 13, color: "var(--error-text)", margin: "6px 0 0", opacity: 0.8 }}>
                {error}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button
              onClick={() => {
                setPhase("upload");
                setError(null);
                setJobId(null);
                setProgress(null);
              }}
              style={{
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 10,
                border: "1px solid var(--border-default)",
                background: "var(--surface-secondary)",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Inline error for upload phase */}
      {phase === "upload" && error && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--error-bg)",
            border: "1px solid var(--error-border)",
            color: "var(--error-text)",
            fontSize: 13,
            marginTop: 16,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
