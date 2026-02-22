"use client";

import { useState, useEffect, useCallback } from "react";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";
import "./ai-errors.css";

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
  if (rate >= 0.2) return "var(--status-error-text)";
  if (rate >= 0.1) return "var(--status-warning-text)";
  if (rate > 0) return "var(--status-warning-text)";
  return "var(--status-success-text)";
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
    <div className="aie-page">
      <AdvancedBanner />
      {/* Header */}
      <div className="aie-header">
        <div>
          <h1 className="hf-page-title">
            AI Error Monitor
          </h1>
          <p className="aie-subtitle">
            Pipeline LLM failures and fallback tracking
          </p>
        </div>
        <a href="/x/ai-knowledge" className="aie-nav-link">
          AI Knowledge
        </a>
      </div>

      {/* Alert Banner */}
      {data?.stats.alertThresholdExceeded && (
        <div className="aie-alert-banner">
          <span className="aie-alert-icon">!!</span>
          <div>
            <div className="aie-alert-title">
              High failure rate detected
            </div>
            <div className="aie-alert-desc">
              One or more pipeline call points exceed 20% failure rate. Check AI configuration at /x/ai-config
            </div>
          </div>
        </div>
      )}

      {loading && !data ? (
        <div className="aie-center-block">
          <div className="aie-spinner-lg" />
          <p className="hf-text-muted">Loading error data...</p>
        </div>
      ) : data ? (
        <>
          {/* Stats Cards */}
          <div className="aie-stats-grid">
            <div className="hf-card hf-mb-0">
              <div className="aie-stat-label">
                FAILURES ({hours}h)
              </div>
              <div className="aie-stat-value" style={{ color: data.stats.totalFailures > 0 ? "var(--status-error-text)" : "var(--status-success-text)" }}>
                {data.stats.totalFailures.toLocaleString()}
              </div>
            </div>

            <div className="hf-card hf-mb-0">
              <div className="aie-stat-label">
                FAILURE RATE
              </div>
              <div className="aie-stat-value" style={{ color: rateColor(data.stats.failureRate) }}>
                {(data.stats.failureRate * 100).toFixed(1)}%
              </div>
            </div>

            <div className="hf-card hf-mb-0">
              <div className="aie-stat-label">
                TOTAL INTERACTIONS ({hours}h)
              </div>
              <div className="aie-stat-value aie-stat-value-accent">
                {data.stats.totalInteractions.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Controls: Time Range + Call Point Filter + Refresh */}
          <div className="aie-controls">
            <div>
              <label className="hf-label hf-text-muted">
                TIME RANGE
              </label>
              <div className="hf-flex hf-gap-sm">
                {[1, 6, 24, 168].map((h) => (
                  <button
                    key={h}
                    onClick={() => setHours(h)}
                    className={`aie-time-btn ${hours === h ? "aie-time-btn-active" : "aie-time-btn-inactive"}`}
                  >
                    {h === 168 ? "7d" : `${h}h`}
                  </button>
                ))}
              </div>
            </div>

            <div className="aie-filter-field">
              <label className="hf-label hf-text-muted">
                CALL POINT
              </label>
              <select
                value={selectedCallPoint}
                onChange={(e) => setSelectedCallPoint(e.target.value)}
                className="aie-select"
              >
                {uniqueCallPoints.map((cp) => (
                  <option key={cp} value={cp}>
                    {cp === "all" ? "All Call Points" : cp}
                  </option>
                ))}
              </select>
            </div>

            <button onClick={loadErrors} className="aie-refresh-btn">
              Refresh
            </button>
          </div>

          {/* Failure Rate by Call Point */}
          {data.stats.byCallPoint.length > 0 && (
            <div className="hf-card">
              <h2 className="aie-section-heading">
                Failure Rate by Call Point
              </h2>
              <div className="hf-flex-col hf-gap-sm">
                {data.stats.byCallPoint.map((cp) => (
                  <div key={cp.callPoint} className="aie-cp-row">
                    <div className="aie-dot" style={{ backgroundColor: rateColor(cp.rate) }} />
                    <div className="aie-cp-name">
                      {cp.callPoint}
                    </div>
                    <div className="aie-cp-fraction">
                      {cp.failures} / {cp.total}
                    </div>
                    <div className="aie-cp-rate" style={{ color: rateColor(cp.rate) }}>
                      {(cp.rate * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Failures */}
          <div className="aie-failures-card">
            <div className="aie-failures-header">
              <h2 className="aie-failures-title">
                Recent Failures ({data.total})
              </h2>
              <div className="aie-failures-subtitle">
                Auto-refreshes every 30s
              </div>
            </div>

            {data.failures.length > 0 ? (
              <div className="aie-failures-list">
                {data.failures.map((f) => (
                  <div
                    key={f.id}
                    className="aie-failure-row"
                    onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                  >
                    <div className="aie-failure-summary">
                      <div className="aie-dot aie-dot-error" />
                      <span className="aie-callpoint-badge">
                        {f.callPoint}
                      </span>
                      <div className="aie-error-preview">
                        {f.aiResponse}
                      </div>
                      <div className="aie-timestamp">
                        {relativeTime(f.createdAt)}
                      </div>
                    </div>

                    {expandedId === f.id && (
                      <div className="aie-detail">
                        <div className="aie-detail-row">
                          <strong>Operation:</strong> {f.userMessage}
                        </div>
                        <div className="aie-detail-row">
                          <strong>Error:</strong>{" "}
                          <span className="hf-text-error">{f.aiResponse}</span>
                        </div>
                        {f.metadata && (
                          <div className="aie-detail-row">
                            <strong>Metadata:</strong>{" "}
                            <code className="aie-metadata-code">
                              {JSON.stringify(f.metadata)}
                            </code>
                          </div>
                        )}
                        <div className="aie-detail-time">
                          {new Date(f.createdAt).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="aie-center-block">
                <div className="aie-center-icon">
                  {data.stats.totalInteractions > 0 ? "\u2705" : "\uD83D\uDCED"}
                </div>
                <p className="aie-center-text">
                  {data.stats.totalInteractions > 0
                    ? "No failures in this time range"
                    : "No AI interactions recorded yet"}
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="aie-center-block">
          <div className="aie-center-icon">!!</div>
          <p className="aie-center-text">Failed to load error data</p>
        </div>
      )}
    </div>
  );
}
