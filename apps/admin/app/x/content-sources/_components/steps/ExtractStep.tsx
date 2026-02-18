"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { DOCUMENT_TYPES } from "../shared/badges";

interface StepProps {
  setData: (key: string, value: unknown) => void;
  getData: <T = unknown>(key: string) => T | undefined;
  onNext: () => void;
  onPrev: () => void;
  endFlow: () => void;
}

export default function ExtractStep({ setData, getData, onNext, onPrev }: StepProps) {
  const sourceId = getData<string>("sourceId");
  const sourceName = getData<string>("sourceName");
  const hasFile = getData<boolean>("hasFile");

  const [phase, setPhase] = useState<"confirm" | "extracting" | "done" | "error">("confirm");
  const [documentType, setDocumentType] = useState("");
  const [extractedCount, setExtractedCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [chunkProgress, setChunkProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  // Skip this step if no file was uploaded
  useEffect(() => {
    if (!hasFile) {
      onNext();
    }
  }, [hasFile, onNext]);

  // Check for active extraction jobs on mount (re-entry)
  useEffect(() => {
    async function checkActiveJobs() {
      try {
        const res = await fetch("/api/tasks?status=in_progress");
        const data = await res.json();
        if (!data.ok) return;
        const job = (data.tasks || []).find(
          (t: any) => t.taskType === "extraction" && t.context?.sourceId === sourceId
        );
        if (job) {
          setPhase("extracting");
          startTracking();
        }
      } catch {}
    }
    if (sourceId) checkActiveJobs();
  }, [sourceId]);

  // Load source to get document type
  useEffect(() => {
    if (!sourceId) return;
    fetch(`/api/content-sources/${sourceId}`).then((r) => r.json()).then((data) => {
      if (data.source?.documentType) setDocumentType(data.source.documentType);
    }).catch(() => {});
  }, [sourceId]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  function startTracking() {
    setElapsed(0);
    tickRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/tasks?status=in_progress");
        const data = await res.json();
        if (!data.ok) return;
        const job = (data.tasks || []).find(
          (t: any) => t.taskType === "extraction" && t.context?.sourceId === sourceId
        );
        if (job) {
          const ctx = job.context || {};
          setExtractedCount(ctx.extractedCount || 0);
          setChunkProgress({ current: ctx.currentChunk || 0, total: ctx.totalChunks || 0 });
        } else {
          // Job finished — fetch final assertion count
          if (pollRef.current) clearInterval(pollRef.current);
          if (tickRef.current) clearInterval(tickRef.current);
          const countRes = await fetch(`/api/content-sources/${sourceId}/assertions?limit=1`);
          const countData = await countRes.json();
          const finalCount = countData.total || extractedCount;
          setExtractedCount(finalCount);
          setData("assertionCount", finalCount);
          setPhase("done");
        }
      } catch {}
    }, 3000);
  }

  async function handleExtract() {
    setPhase("extracting");
    setError(null);
    try {
      const res = await fetch(`/api/content-sources/${sourceId}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      startTracking();
    } catch (err: any) {
      setError(err.message);
      setPhase("error");
    }
  }

  async function handleChangeType(newType: string) {
    setDocumentType(newType);
    await fetch(`/api/content-sources/${sourceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentType: newType }),
    });
  }

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  const pct = chunkProgress.total > 0 ? Math.round((chunkProgress.current / chunkProgress.total) * 100) : 0;

  if (!hasFile) return null;

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
        Let the AI read your document
      </h2>
      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 24px" }}>
        Confirm the document type, then extract teaching assertions from <strong>{sourceName}</strong>.
      </p>

      {phase === "confirm" && (
        <div style={{
          padding: 24, borderRadius: 12, border: "1px solid var(--border-default)",
          background: "var(--surface-secondary)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Document Type:</span>
            <select
              value={documentType}
              onChange={(e) => handleChangeType(e.target.value)}
              style={{
                padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-default)",
                backgroundColor: "var(--surface-primary)", color: "var(--text-primary)", fontSize: 14,
              }}
            >
              {DOCUMENT_TYPES.map((d) => (
                <option key={d.value} value={d.value}>{d.icon} {d.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={handleExtract}
              style={{
                padding: "12px 32px", borderRadius: 8, border: "none",
                background: "var(--accent-primary)", color: "#fff",
                fontSize: 15, fontWeight: 700, cursor: "pointer",
              }}
            >
              Extract Assertions
            </button>
            <button onClick={onPrev}
              style={{
                padding: "12px 24px", borderRadius: 8, border: "1px solid var(--border-default)",
                background: "transparent", color: "var(--text-secondary)", fontSize: 14, cursor: "pointer",
              }}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {phase === "extracting" && (
        <div style={{
          padding: 24, borderRadius: 12, border: "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)",
          background: "color-mix(in srgb, var(--accent-primary) 4%, transparent)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <span style={{
              width: 10, height: 10, borderRadius: "50%", background: "var(--accent-primary)",
              animation: "extract-pulse 1.5s ease-in-out infinite",
            }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
              Extracting... {extractedCount > 0 ? `${extractedCount} assertions found` : ""}
            </span>
            <span style={{ marginLeft: "auto", fontSize: 14, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
              {timeStr}
            </span>
          </div>
          {chunkProgress.total > 0 && (
            <>
              <div style={{ height: 6, borderRadius: 3, background: "var(--surface-tertiary)", overflow: "hidden", marginBottom: 8 }}>
                <div style={{
                  height: "100%", borderRadius: 3,
                  background: "linear-gradient(90deg, var(--accent-primary), #6366f1)",
                  width: `${pct}%`, transition: "width 0.5s ease-out",
                }} />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Chunk {chunkProgress.current}/{chunkProgress.total} ({pct}%)
              </div>
            </>
          )}
          <style>{`@keyframes extract-pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
        </div>
      )}

      {phase === "done" && (
        <div style={{
          padding: 24, borderRadius: 12, border: "2px solid var(--status-success-text, #16a34a)",
          background: "var(--status-success-bg, #dcfce7)", textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>{"\u2705"}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            {extractedCount} assertions extracted
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
            Ready for review.
          </div>
          <button onClick={onNext}
            style={{
              padding: "12px 32px", borderRadius: 8, border: "none",
              background: "var(--accent-primary)", color: "#fff",
              fontSize: 15, fontWeight: 700, cursor: "pointer",
            }}
          >
            Continue to Review
          </button>
        </div>
      )}

      {phase === "error" && (
        <div style={{
          padding: 24, borderRadius: 12, border: "1px solid #FFCDD2",
          background: "var(--status-error-bg)",
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--status-error-text)", marginBottom: 12 }}>
            Extraction failed: {error}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => { setPhase("confirm"); setError(null); }}
              style={{
                padding: "10px 24px", borderRadius: 6, border: "none",
                background: "var(--accent-primary)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              Try Again
            </button>
            <button onClick={onPrev}
              style={{
                padding: "10px 24px", borderRadius: 6, border: "1px solid var(--border-default)",
                background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer",
              }}
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
