"use client";

import { useState, useEffect, useCallback } from "react";

type LogType = "ai" | "api" | "system" | "user";

interface LogEntry {
  timestamp: string;
  type: LogType;
  stage: string;
  message?: string;
  promptLength?: number;
  promptPreview?: string;
  responseLength?: number;
  responsePreview?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

const LOG_TYPE_COLORS: Record<LogType, { bg: string; text: string }> = {
  ai: { bg: "#dbeafe", text: "#1e40af" },
  api: { bg: "#dcfce7", text: "#166534" },
  system: { bg: "#fef3c7", text: "#92400e" },
  user: { bg: "#f3e8ff", text: "#6b21a8" },
};

const ALL_TYPES: LogType[] = ["ai", "api", "system", "user"];

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loggingEnabled, setLoggingEnabled] = useState(true);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<LogType[]>(ALL_TYPES);
  const [copied, setCopied] = useState<string | null>(null); // "all" or log index

  const fetchLogs = useCallback(async () => {
    try {
      const filterParam = typeFilter.length < ALL_TYPES.length ? `?type=${typeFilter.join(",")}` : "";
      const res = await fetch(`/api/logs/ai-calls${filterParam}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        if (typeof data.loggingEnabled === "boolean") {
          setLoggingEnabled(data.loggingEnabled);
        }
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  const toggleLogging = async (enabled: boolean) => {
    setLoggingEnabled(enabled);
    try {
      await fetch("/api/logs/ai-calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
    } catch (err) {
      console.error("Failed to toggle logging:", err);
    }
  };

  const toggleTypeFilter = (type: LogType) => {
    setTypeFilter((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  const copyAllLogs = async () => {
    try {
      const text = logs.map((log) => JSON.stringify(log)).join("\n");
      await navigator.clipboard.writeText(text);
      setCopied("all");
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const copyLog = async (idx: number, log: LogEntry) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(log, null, 2));
      setCopied(String(idx));
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const totalTokens = logs.reduce((sum, log) => {
    return sum + (log.usage?.inputTokens || 0) + (log.usage?.outputTokens || 0);
  }, 0);

  const aiLogs = logs.filter((l) => l.type === "ai");
  const estimatedCost = (totalTokens / 1000000) * 3; // ~$3 per 1M tokens for Sonnet

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Logs</h1>
          <p style={{ color: "var(--text-secondary)", margin: "4px 0 0" }}>
            {logs.length} entries
            {aiLogs.length > 0 && ` | ${totalTokens.toLocaleString()} tokens | ~$${estimatedCost.toFixed(4)}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={loggingEnabled}
              onChange={(e) => toggleLogging(e.target.checked)}
            />
            Logging {loggingEnabled ? "ON" : "OFF"}
          </label>
          <span style={{ color: "var(--border-default)" }}>|</span>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button
            onClick={fetchLogs}
            style={{
              padding: "8px 16px",
              background: "var(--button-primary-bg)",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
          <button
            onClick={copyAllLogs}
            disabled={logs.length === 0}
            style={{
              padding: "8px 16px",
              background: copied === "all" ? "var(--status-success-text)" : "var(--text-muted)",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: logs.length === 0 ? "not-allowed" : "pointer",
              opacity: logs.length === 0 ? 0.5 : 1,
            }}
          >
            {copied === "all" ? "Copied!" : "Copy All"}
          </button>
          <button
            onClick={async () => {
              await fetch("/api/logs/ai-calls", { method: "DELETE" });
              fetchLogs();
            }}
            style={{
              padding: "8px 16px",
              background: "var(--status-error-text)",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Type filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {ALL_TYPES.map((type) => {
          const isActive = typeFilter.includes(type);
          const colors = LOG_TYPE_COLORS[type];
          return (
            <button
              key={type}
              onClick={() => toggleTypeFilter(type)}
              style={{
                padding: "4px 12px",
                background: isActive ? colors.bg : "transparent",
                color: isActive ? colors.text : "var(--text-muted)",
                border: `1px solid ${isActive ? colors.text : "var(--border-default)"}`,
                borderRadius: 16,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              {type}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading...</div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          No logs yet. Activity will appear here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {logs.map((log, idx) => {
            const isExpanded = expandedLog === idx;
            const inputTokens = log.usage?.inputTokens || 0;
            const outputTokens = log.usage?.outputTokens || 0;
            const logType = log.type || "ai";
            const colors = LOG_TYPE_COLORS[logType] || LOG_TYPE_COLORS.ai;

            return (
              <div
                key={idx}
                style={{
                  background: "var(--background-secondary, #f9fafb)",
                  border: "1px solid var(--border-default, #e5e7eb)",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <div
                  onClick={() => setExpandedLog(isExpanded ? null : idx)}
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        background: colors.bg,
                        color: colors.text,
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                      }}
                    >
                      {logType}
                    </span>
                    <span
                      style={{
                        padding: "2px 8px",
                        background: "var(--surface-secondary)",
                        color: "var(--text-primary)",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {log.stage}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    {log.message && (
                      <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
                        {log.message.slice(0, 50)}
                        {log.message.length > 50 ? "..." : ""}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13 }}>
                    {logType === "ai" && (
                      <>
                        <span title="Input tokens">
                          <strong>{inputTokens.toLocaleString()}</strong> in
                        </span>
                        <span title="Output tokens">
                          <strong>{outputTokens.toLocaleString()}</strong> out
                        </span>
                        <span style={{ color: "var(--text-muted)" }}>
                          {(log.promptLength || 0).toLocaleString()} chars
                        </span>
                      </>
                    )}
                    {log.durationMs && (
                      <span style={{ color: "var(--text-muted)" }}>{log.durationMs}ms</span>
                    )}
                    <span>{isExpanded ? "▼" : "▶"}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: "1px solid var(--border-default, #e5e7eb)" }}>
                    <div style={{ padding: 16 }}>
                      {/* Copy button for this log entry */}
                      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyLog(idx, log);
                          }}
                          style={{
                            padding: "4px 12px",
                            background: copied === String(idx) ? "var(--status-success-text)" : "var(--border-default)",
                            color: copied === String(idx) ? "white" : "var(--text-primary)",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          {copied === String(idx) ? "Copied!" : "Copy Entry"}
                        </button>
                      </div>
                      {/* AI-specific: prompt and response */}
                      {logType === "ai" && log.promptPreview && (
                        <div style={{ marginBottom: 12 }}>
                          <strong style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            PROMPT ({log.promptLength || 0} chars)
                          </strong>
                          <pre
                            style={{
                              background: "var(--code-block-bg)",
                              color: "var(--code-block-text)",
                              padding: 12,
                              borderRadius: 6,
                              fontSize: 11,
                              overflow: "auto",
                              maxHeight: 300,
                              marginTop: 6,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {log.promptPreview}
                          </pre>
                        </div>
                      )}
                      {logType === "ai" && log.responsePreview && (
                        <div style={{ marginBottom: 12 }}>
                          <strong style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            RESPONSE ({log.responseLength || 0} chars)
                          </strong>
                          <pre
                            style={{
                              background: "var(--code-block-bg)",
                              color: "var(--code-block-text)",
                              padding: 12,
                              borderRadius: 6,
                              fontSize: 11,
                              overflow: "auto",
                              maxHeight: 200,
                              marginTop: 6,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {log.responsePreview}
                          </pre>
                        </div>
                      )}

                      {/* Metadata for all types */}
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div>
                          <strong style={{ fontSize: 12, color: "var(--text-muted)" }}>METADATA</strong>
                          <pre
                            style={{
                              background: "var(--code-block-bg)",
                              color: "var(--code-block-text)",
                              padding: 12,
                              borderRadius: 6,
                              fontSize: 11,
                              overflow: "auto",
                              maxHeight: 200,
                              marginTop: 6,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
