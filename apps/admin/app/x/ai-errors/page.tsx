"use client";

import { useState, useEffect, useCallback } from "react";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";

interface Failure {
  id: string;
  callPoint: string;
  userMessage: string;
  aiResponse: string;
  metadata: any;
  createdAt: string;
}

interface CallPointStats {
  callPoint: string;
  failures: number;
  total: number;
  rate: number;
}

interface FailureStats {
  totalFailures: number;
  totalInteractions: number;
  failureRate: number;
  byCallPoint: CallPointStats[];
  alertThresholdExceeded: boolean;
}

interface ErrorData {
  failures: Failure[];
  total: number;
  stats: FailureStats;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function rateColor(rate: number): string {
  if (rate >= 0.2) return "#ef4444";
  if (rate >= 0.1) return "#f59e0b";
  if (rate > 0) return "#f97316";
  return "#10b981";
}

export default function AIErrorsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ErrorData | null>(null);
  const [hours, setHours] = useState(24);
  const [selectedCallPoint, setSelectedCallPoint] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadErrors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ hours: String(hours), limit: "100" });
      if (selectedCallPoint !== "all") params.set("callPoint", selectedCallPoint);
      const res = await fetch(`/api/ai/errors?${params}`);
      const json = await res.json();
      if (json.ok) {
        setData(json);
      }
    } catch (error) {
      console.error("Failed to load AI errors:", error);
    } finally {
      setLoading(false);
    }
  }, [hours, selectedCallPoint]);

  useEffect(() => {
    loadErrors();
  }, [loadErrors]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(loadErrors, 30000);
    return () => clearInterval(interval);
  }, [loadErrors]);

  const callPoints = data?.stats.byCallPoint.map((cp) => cp.callPoint) || [];
  const uniqueCallPoints = ["all", ...new Set(callPoints)];

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-secondary)", padding: 24 }}>
      <AdvancedBanner />
      {/* Header */}
      <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            AI Error Monitor
          </h1>
          <p style={{ fontSize: 16, color: "var(--text-secondary)", marginTop: 8 }}>
            Pipeline LLM failures and fallback tracking
          </p>
        </div>
        <a
          href="/x/ai-knowledge"
          style={{
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 10,
            border: "1px solid var(--border-default)",
            background: "var(--surface-primary)",
            color: "var(--text-primary)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--surface-secondary)";
            e.currentTarget.style.borderColor = "var(--accent-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--surface-primary)";
            e.currentTarget.style.borderColor = "var(--border-default)";
          }}
        >
          AI Knowledge
        </a>
      </div>

      {/* Alert Banner */}
      {data?.stats.alertThresholdExceeded && (
        <div
          style={{
            background: "var(--status-error-bg)",
            border: "1px solid var(--status-error-text)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 20 }}>!!</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--status-error-text)" }}>
              High failure rate detected
            </div>
            <div style={{ fontSize: 13, color: "var(--status-error-text)", marginTop: 2 }}>
              One or more pipeline call points exceed 20% failure rate. Check AI configuration at /x/ai-config
            </div>
          </div>
        </div>
      )}

      {loading && !data ? (
        <div style={{ textAlign: "center", padding: 80 }}>
          <div
            style={{
              width: 60,
              height: 60,
              margin: "0 auto 24px",
              border: "4px solid var(--border-default)",
              borderTopColor: "var(--accent-primary)",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <p style={{ color: "var(--text-muted)" }}>Loading error data...</p>
        </div>
      ) : data ? (
        <>
          {/* Stats Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 32 }}>
            <div
              style={{
                background: "var(--surface-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: 16,
                padding: 24,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
                FAILURES ({hours}h)
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: data.stats.totalFailures > 0 ? "var(--status-error-text)" : "var(--status-success-text)" }}>
                {data.stats.totalFailures.toLocaleString()}
              </div>
            </div>

            <div
              style={{
                background: "var(--surface-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: 16,
                padding: 24,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
                FAILURE RATE
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: rateColor(data.stats.failureRate) }}>
                {(data.stats.failureRate * 100).toFixed(1)}%
              </div>
            </div>

            <div
              style={{
                background: "var(--surface-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: 16,
                padding: 24,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
                TOTAL INTERACTIONS ({hours}h)
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "var(--accent-primary)" }}>
                {data.stats.totalInteractions.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Controls: Time Range + Call Point Filter + Refresh */}
          <div
            style={{
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              display: "flex",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                TIME RANGE
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                {[1, 6, 24, 168].map((h) => (
                  <button
                    key={h}
                    onClick={() => setHours(h)}
                    style={{
                      padding: "6px 14px",
                      fontSize: 13,
                      fontWeight: hours === h ? 700 : 400,
                      borderRadius: 8,
                      border: hours === h ? "2px solid var(--accent-primary)" : "1px solid var(--border-default)",
                      background: hours === h ? "color-mix(in srgb, var(--accent-primary) 10%, transparent)" : "var(--surface-secondary)",
                      color: hours === h ? "var(--accent-primary)" : "var(--text-primary)",
                      cursor: "pointer",
                    }}
                  >
                    {h === 168 ? "7d" : `${h}h`}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                CALL POINT
              </label>
              <select
                value={selectedCallPoint}
                onChange={(e) => setSelectedCallPoint(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 14,
                  borderRadius: 8,
                  border: "1px solid var(--border-default)",
                  background: "var(--surface-secondary)",
                  color: "var(--text-primary)",
                }}
              >
                {uniqueCallPoints.map((cp) => (
                  <option key={cp} value={cp}>
                    {cp === "all" ? "All Call Points" : cp}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={loadErrors}
              style={{
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: "var(--surface-secondary)",
                color: "var(--text-primary)",
                cursor: "pointer",
                alignSelf: "flex-end",
              }}
            >
              Refresh
            </button>
          </div>

          {/* Failure Rate by Call Point */}
          {data.stats.byCallPoint.length > 0 && (
            <div
              style={{
                background: "var(--surface-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: 16,
                padding: 24,
                marginBottom: 20,
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
                Failure Rate by Call Point
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.stats.byCallPoint.map((cp) => (
                  <div
                    key={cp.callPoint}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      background: "var(--surface-secondary)",
                      borderRadius: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: rateColor(cp.rate),
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                      {cp.callPoint}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", minWidth: 100, textAlign: "right" }}>
                      {cp.failures} / {cp.total}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: rateColor(cp.rate),
                        minWidth: 60,
                        textAlign: "right",
                      }}
                    >
                      {(cp.rate * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Failures */}
          <div
            style={{
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 24, borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                Recent Failures ({data.total})
              </h2>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Auto-refreshes every 30s
              </div>
            </div>

            {data.failures.length > 0 ? (
              <div style={{ maxHeight: 600, overflowY: "auto" }}>
                {data.failures.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      padding: "14px 24px",
                      borderBottom: "1px solid var(--border-default)",
                      cursor: "pointer",
                    }}
                    onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          backgroundColor: "var(--status-error-text)",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: "var(--surface-tertiary)",
                          color: "var(--text-muted)",
                          flexShrink: 0,
                        }}
                      >
                        {f.callPoint}
                      </span>
                      <div style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {f.aiResponse}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>
                        {relativeTime(f.createdAt)}
                      </div>
                    </div>

                    {expandedId === f.id && (
                      <div style={{ marginTop: 12, paddingLeft: 20, borderLeft: "2px solid var(--border-default)" }}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                          <strong>Operation:</strong> {f.userMessage}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                          <strong>Error:</strong>{" "}
                          <span style={{ color: "var(--status-error-text)" }}>{f.aiResponse}</span>
                        </div>
                        {f.metadata && (
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                            <strong>Metadata:</strong>{" "}
                            <code style={{ fontSize: 11, background: "var(--surface-tertiary)", padding: "1px 4px", borderRadius: 3 }}>
                              {JSON.stringify(f.metadata)}
                            </code>
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {new Date(f.createdAt).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 80, textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>
                  {data.stats.totalInteractions > 0 ? "✅" : "📭"}
                </div>
                <p style={{ fontSize: 16, color: "var(--text-muted)" }}>
                  {data.stats.totalInteractions > 0
                    ? "No failures in this time range"
                    : "No AI interactions recorded yet"}
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>!!</div>
          <p style={{ fontSize: 16, color: "var(--text-muted)" }}>Failed to load error data</p>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
