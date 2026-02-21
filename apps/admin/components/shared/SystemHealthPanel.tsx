"use client";

import { useState, useEffect } from "react";

// =====================================================
// Types (mirrors lib/system-ini.ts)
// =====================================================

type CheckStatus = "pass" | "warn" | "fail";
type RagStatus = "green" | "amber" | "red";

interface IniCheck {
  status: CheckStatus;
  label: string;
  message: string;
  severity: "critical" | "recommended" | "optional";
  remediation?: string;
  detail?: unknown;
}

interface IniResult {
  ok: boolean;
  status: RagStatus;
  summary: { pass: number; warn: number; fail: number; total: number };
  checks: Record<string, IniCheck>;
  timestamp: string;
}

// =====================================================
// Styles
// =====================================================

const ragConfig: Record<
  RagStatus,
  { bg: string; text: string; border: string; label: string; icon: string }
> = {
  green: {
    bg: "var(--status-success-bg, #ecfdf5)",
    text: "var(--status-success-text, #065f46)",
    border: "var(--status-success-border, #a7f3d0)",
    label: "All Clear",
    icon: "\u2713",
  },
  amber: {
    bg: "var(--status-warning-bg, #fffbeb)",
    text: "var(--status-warning-text, #92400e)",
    border: "var(--status-warning-border, #fde68a)",
    label: "Warnings",
    icon: "\u25CB",
  },
  red: {
    bg: "var(--status-error-bg, #fef2f2)",
    text: "var(--status-error-text, #991b1b)",
    border: "var(--status-error-border, #fecaca)",
    label: "Issues Found",
    icon: "\u2717",
  },
};

const statusIcon: Record<CheckStatus, { icon: string; color: string }> = {
  pass: { icon: "\u2713", color: "var(--status-success-text)" },
  warn: { icon: "\u25CB", color: "var(--status-warning-text)" },
  fail: { icon: "\u2717", color: "var(--status-error-text)" },
};

const severityOrder = ["critical", "recommended", "optional"] as const;
const severityLabels: Record<string, string> = {
  critical: "Critical",
  recommended: "Recommended",
  optional: "Optional",
};
const severityColors: Record<string, string> = {
  critical: "var(--status-error-text)",
  recommended: "var(--status-warning-text)",
  optional: "var(--text-muted)",
};

// =====================================================
// Component
// =====================================================

export function SystemHealthPanel() {
  const [data, setData] = useState<IniResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchHealth = async () => {
      try {
        const res = await fetch("/api/system/ini");
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            setError("Requires SUPERADMIN access");
          } else {
            setError(`HTTP ${res.status}`);
          }
          return;
        }
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Failed to fetch");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div
        data-testid="system-health-panel"
        style={{
          padding: 20,
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>🏥</span>
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            System Health
          </span>
          <span
            data-testid="system-health-loading"
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginLeft: 8,
            }}
          >
            Checking...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="system-health-panel"
        style={{
          padding: 20,
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>🏥</span>
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            System Health
          </span>
          <span data-testid="system-health-error" style={{ fontSize: 12, color: "var(--status-error-text)", marginLeft: 8 }}>
            {error}
          </span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const rag = ragConfig[data.status];
  const checks = Object.values(data.checks);

  return (
    <div
      data-testid="system-health-panel"
      data-status={data.status}
      style={{
        background: "var(--surface-primary)",
        border: `1px solid ${rag.border}`,
        borderRadius: 12,
        marginBottom: 24,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 20px",
          borderBottom: `1px solid ${rag.border}`,
          background: rag.bg,
        }}
      >
        <span style={{ fontSize: 20 }}>🏥</span>
        <span
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          System Health
        </span>

        {/* RAG badge */}
        <span
          data-testid="system-health-rag-badge"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 10px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 12,
            backgroundColor: rag.bg,
            color: rag.text,
            border: `1px solid ${rag.border}`,
          }}
        >
          <span>{rag.icon}</span>
          <span>{rag.label}</span>
        </span>

        {/* Summary counts */}
        <span
          style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}
        >
          {data.summary.pass} pass
          {data.summary.warn > 0 && `, ${data.summary.warn} warn`}
          {data.summary.fail > 0 && `, ${data.summary.fail} fail`}
        </span>
      </div>

      {/* Check groups by severity */}
      {severityOrder.map((severity) => {
        const group = checks.filter((c) => c.severity === severity);
        if (group.length === 0) return null;

        return (
          <div key={severity} data-testid={`system-health-group-${severity}`}>
            <div
              style={{
                padding: "6px 20px",
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: severityColors[severity],
                backgroundColor: "var(--surface-secondary, #fafafa)",
                borderBottom: "1px solid var(--border-default, #f0f0f0)",
              }}
            >
              {severityLabels[severity]} (
              {group.filter((c) => c.status === "pass").length}/{group.length})
            </div>

            {group.map((check) => (
              <div
                key={check.label}
                data-testid="system-health-check"
                data-check-status={check.status}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "10px 20px",
                  borderBottom: "1px solid var(--border-default, #f5f5f5)",
                }}
              >
                {/* Status icon */}
                <span
                  style={{
                    fontSize: 14,
                    lineHeight: "22px",
                    color: statusIcon[check.status].color,
                    flexShrink: 0,
                  }}
                >
                  {statusIcon[check.status].icon}
                </span>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 500,
                      fontSize: 13,
                      color: "var(--text-primary)",
                    }}
                  >
                    {check.label}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color:
                        check.status === "fail"
                          ? "var(--status-error-text)"
                          : check.status === "warn"
                            ? "var(--status-warning-text, #92400e)"
                            : "var(--text-muted)",
                      marginTop: 1,
                    }}
                  >
                    {check.message}
                  </div>
                  {check.remediation && check.status !== "pass" && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginTop: 3,
                        fontStyle: "italic",
                      }}
                    >
                      Fix: {check.remediation}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
