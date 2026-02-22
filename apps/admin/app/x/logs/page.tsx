"use client";

import { useState, useEffect, useCallback } from "react";
import { Copy, FileText, ClipboardCopy } from "lucide-react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

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
  ai: { bg: "var(--badge-blue-bg)", text: "var(--badge-blue-text, #1e40af)" },
  api: { bg: "var(--badge-green-bg)", text: "var(--badge-green-text, #166534)" },
  system: { bg: "var(--badge-amber-bg, #fef3c7)", text: "var(--badge-amber-text, #92400e)" },
  user: { bg: "var(--badge-purple-bg, #f3e8ff)", text: "var(--badge-purple-text, #6b21a8)" },
};

const DEEP_BADGE = { bg: "var(--status-error-text)", text: "var(--surface-primary)" };

const ALL_TYPES: LogType[] = ["ai", "api", "system", "user"];

function isDeepEntry(log: LogEntry): boolean {
  return log.metadata?.deep === true;
}

/**
 * Format a log entry as a structured markdown block for pasting into Claude.
 */
function formatForClaude(log: LogEntry): string {
  const lines: string[] = [];
  lines.push(`## AI Call: ${log.stage}`);
  if (log.metadata?.model || log.metadata?.engine || log.durationMs) {
    const parts: string[] = [];
    if (log.metadata?.model) parts.push(`**Model:** ${log.metadata.model}`);
    if (log.metadata?.engine) parts.push(`**Engine:** ${log.metadata.engine}`);
    if (log.durationMs) parts.push(`**Duration:** ${log.durationMs}ms`);
    lines.push(parts.join(" | "));
  }
  if (log.usage) {
    lines.push(`**Tokens:** ${log.usage.inputTokens ?? 0} in / ${log.usage.outputTokens ?? 0} out`);
  }
  lines.push(`**Time:** ${log.timestamp}`);
  lines.push("");
  if (log.promptPreview) {
    lines.push("### Prompt");
    lines.push(log.promptPreview);
    lines.push("");
  }
  if (log.responsePreview) {
    lines.push("### Response");
    lines.push(log.responsePreview);
    lines.push("");
  }
  if (log.metadata?.error) {
    lines.push("### Error");
    lines.push(String(log.metadata.error));
    lines.push("");
  }
  return lines.join("\n");
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loggingEnabled, setLoggingEnabled] = useState(true);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<LogType[]>(ALL_TYPES);
  const [deepOnly, setDeepOnly] = useState(false);
  const { copiedKey: copied, copy: copyToClipboard } = useCopyToClipboard();

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

  const copyAllLogs = () => copyToClipboard(logs.map((log) => JSON.stringify(log)).join("\n"), "all");

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const filteredLogs = deepOnly ? logs.filter(isDeepEntry) : logs;

  const totalTokens = filteredLogs.reduce((sum, log) => {
    return sum + (log.usage?.inputTokens || 0) + (log.usage?.outputTokens || 0);
  }, 0);

  const aiLogs = filteredLogs.filter((l) => l.type === "ai");
  const deepCount = logs.filter(isDeepEntry).length;
  const estimatedCost = (totalTokens / 1000000) * 3;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 className="hf-page-title">Logs</h1>
          <p style={{ color: "var(--text-secondary)", margin: "4px 0 0" }}>
            {filteredLogs.length} entries{deepOnly ? ` (${deepCount} deep)` : ""}
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
            disabled={filteredLogs.length === 0}
            style={{
              padding: "8px 16px",
              background: copied === "all" ? "var(--status-success-text)" : "var(--text-muted)",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: filteredLogs.length === 0 ? "not-allowed" : "pointer",
              opacity: filteredLogs.length === 0 ? 0.5 : 1,
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

      {/* Type filters + Deep filter */}
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
        <span style={{ color: "var(--border-default)", lineHeight: "30px" }}>|</span>
        <button
          onClick={() => setDeepOnly((v) => !v)}
          style={{
            padding: "4px 12px",
            background: deepOnly ? DEEP_BADGE.bg : "transparent",
            color: deepOnly ? DEEP_BADGE.text : "var(--text-muted)",
            border: `1px solid ${deepOnly ? DEEP_BADGE.bg : "var(--border-default)"}`,
            borderRadius: 16,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            textTransform: "uppercase",
          }}
        >
          DEEP {deepCount > 0 ? `(${deepCount})` : ""}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading...</div>
      ) : filteredLogs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          {deepOnly ? "No deep log entries. Toggle deep logging ON in the status bar, then run a wizard or pipeline." : "No logs yet. Activity will appear here."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredLogs.map((log, idx) => {
            const isExpanded = expandedLog === idx;
            const inputTokens = log.usage?.inputTokens || 0;
            const outputTokens = log.usage?.outputTokens || 0;
            const logType = log.type || "ai";
            const colors = LOG_TYPE_COLORS[logType] || LOG_TYPE_COLORS.ai;
            const isDeep = isDeepEntry(log);

            return (
              <div
                key={idx}
                style={{
                  background: "var(--background-secondary, #f9fafb)",
                  border: `1px solid ${isDeep ? "var(--status-error-text)" : "var(--border-default, #e5e7eb)"}`,
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                    {isDeep && (
                      <span
                        style={{
                          padding: "2px 6px",
                          background: DEEP_BADGE.bg,
                          color: DEEP_BADGE.text,
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        DEEP
                      </span>
                    )}
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
                      {/* Copy buttons */}
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
                        {logType === "ai" && log.promptPreview && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(log.promptPreview!, `prompt-${idx}`);
                            }}
                            className="hf-btn hf-btn-secondary"
                            style={{ padding: "4px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                          >
                            <Copy size={12} />
                            {copied === `prompt-${idx}` ? "Copied!" : "Copy Prompt"}
                          </button>
                        )}
                        {logType === "ai" && log.responsePreview && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(log.responsePreview!, `response-${idx}`);
                            }}
                            className="hf-btn hf-btn-secondary"
                            style={{ padding: "4px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                          >
                            <FileText size={12} />
                            {copied === `response-${idx}` ? "Copied!" : "Copy Response"}
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(formatForClaude(log), `full-${idx}`);
                          }}
                          className="hf-btn hf-btn-secondary"
                          style={{ padding: "4px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                        >
                          <ClipboardCopy size={12} />
                          {copied === `full-${idx}` ? "Copied!" : "Copy Full"}
                        </button>
                      </div>

                      {/* AI-specific: prompt and response */}
                      {logType === "ai" && log.promptPreview && (
                        <div style={{ marginBottom: 12 }}>
                          <strong style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            PROMPT ({(log.promptLength || 0).toLocaleString()} chars)
                            {isDeep && <span style={{ color: "var(--status-error-text)", marginLeft: 6 }}>FULL</span>}
                          </strong>
                          <pre
                            style={{
                              background: "var(--code-block-bg)",
                              color: "var(--code-block-text)",
                              padding: 12,
                              borderRadius: 6,
                              fontSize: 11,
                              overflow: "auto",
                              maxHeight: isDeep ? 600 : 300,
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
                            RESPONSE ({(log.responseLength || 0).toLocaleString()} chars)
                            {isDeep && <span style={{ color: "var(--status-error-text)", marginLeft: 6 }}>FULL</span>}
                          </strong>
                          <pre
                            style={{
                              background: "var(--code-block-bg)",
                              color: "var(--code-block-text)",
                              padding: 12,
                              borderRadius: 6,
                              fontSize: 11,
                              overflow: "auto",
                              maxHeight: isDeep ? 600 : 200,
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
