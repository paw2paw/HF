"use client";

import { useState, useEffect } from "react";

interface RunningAgent {
  id: string;
  agentId: string;
  name?: string;
  status: "QUEUED" | "RUNNING" | "OK" | "ERROR";
  startedAt: string;
  finishedAt?: string;
  progress?: {
    phase: string;
    currentFile?: string;
    currentFileIndex?: number;
    totalFiles?: number;
    docsProcessed?: number;
    chunksCreated?: number;
  };
}

export default function RunningAgentsCard() {
  const [runs, setRuns] = useState<RunningAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = async () => {
    try {
      const res = await fetch("/api/agents/runs?status=RUNNING,QUEUED&limit=10");
      if (!res.ok) {
        throw new Error("Failed to fetch running agents");
      }
      const data = await res.json();
      setRuns(data.runs || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
    // Poll every 5 seconds for updates
    const interval = setInterval(fetchRuns, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (startedAt: string, finishedAt?: string) => {
    const start = new Date(startedAt).getTime();
    const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
    const seconds = Math.floor((end - start) / 1000);

    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "RUNNING": return "#3b82f6";
      case "QUEUED": return "#f59e0b";
      case "OK": return "#10b981";
      case "ERROR": return "#ef4444";
      default: return "#6b7280";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "RUNNING": return "#dbeafe";
      case "QUEUED": return "#fef3c7";
      case "OK": return "#d1fae5";
      case "ERROR": return "#fee2e2";
      default: return "#f3f4f6";
    }
  };

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          Running Agents
        </h3>
        <button
          onClick={fetchRuns}
          style={{
            background: "none",
            border: "none",
            color: "#6b7280",
            cursor: "pointer",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {loading && (
        <div style={{ padding: 20, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
          Loading...
        </div>
      )}

      {error && (
        <div style={{ padding: 12, background: "#fee2e2", borderRadius: 6, color: "#dc2626", fontSize: 12 }}>
          {error}
        </div>
      )}

      {!loading && !error && runs.length === 0 && (
        <div style={{ padding: 20, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
          No agents currently running
        </div>
      )}

      {!loading && !error && runs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {runs.map((run) => (
            <div
              key={run.id}
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 12,
              }}
            >
              {/* Header row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      background: getStatusBg(run.status),
                      color: getStatusColor(run.status),
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                    }}
                  >
                    {run.status}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    {run.name || run.agentId}
                  </span>
                </div>
                <span style={{ color: "#6b7280", fontSize: 11, fontFamily: "monospace" }}>
                  {formatDuration(run.startedAt)}
                </span>
              </div>

              {/* Progress info */}
              {run.progress && run.status === "RUNNING" && (
                <div style={{ fontSize: 12, color: "#4b5563" }}>
                  {run.progress.phase === "scanning" && (
                    <span>Scanning for documents...</span>
                  )}
                  {run.progress.phase === "processing" && run.progress.currentFile && (
                    <div>
                      <div style={{ marginBottom: 4 }}>
                        Processing: <span style={{ fontFamily: "monospace" }}>{run.progress.currentFile}</span>
                      </div>
                      {run.progress.totalFiles && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              flex: 1,
                              height: 4,
                              background: "#e5e7eb",
                              borderRadius: 2,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${((run.progress.currentFileIndex || 0) / run.progress.totalFiles) * 100}%`,
                                height: "100%",
                                background: "#3b82f6",
                                transition: "width 0.3s ease",
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 11, color: "#6b7280" }}>
                            {run.progress.currentFileIndex}/{run.progress.totalFiles}
                          </span>
                        </div>
                      )}
                      {run.progress.docsProcessed !== undefined && (
                        <div style={{ marginTop: 4, fontSize: 11, color: "#6b7280" }}>
                          {run.progress.docsProcessed} docs, {run.progress.chunksCreated || 0} chunks
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
