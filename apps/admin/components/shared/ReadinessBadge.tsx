"use client";

import { useState, useEffect } from "react";

// =====================================================
// TYPES
// =====================================================

interface ReadinessCheckResult {
  id: string;
  name: string;
  description: string;
  severity: "critical" | "recommended" | "optional";
  passed: boolean;
  detail: string;
  fixAction?: { label: string; href: string };
}

interface ReadinessData {
  ready: boolean;
  score: number;
  level: "ready" | "almost" | "incomplete";
  checks: ReadinessCheckResult[];
  criticalPassed: number;
  criticalTotal: number;
  recommendedPassed: number;
  recommendedTotal: number;
}

// =====================================================
// BADGE STYLES
// =====================================================

const levelConfig: Record<string, {
  bg: string;
  text: string;
  border: string;
  label: string;
  icon: string;
}> = {
  ready: {
    bg: "var(--status-success-bg, #ecfdf5)",
    text: "var(--status-success-text, #065f46)",
    border: "var(--status-success-border, #a7f3d0)",
    label: "Ready",
    icon: "\u2713", // checkmark
  },
  almost: {
    bg: "var(--status-warning-bg, #fffbeb)",
    text: "var(--status-warning-text, #92400e)",
    border: "var(--status-warning-border, #fde68a)",
    label: "Almost Ready",
    icon: "\u25CB", // circle
  },
  incomplete: {
    bg: "var(--status-error-bg, #fef2f2)",
    text: "var(--status-error-text, #991b1b)",
    border: "var(--status-error-border, #fecaca)",
    label: "Not Ready",
    icon: "\u2717", // x mark
  },
};

const severityIcons: Record<string, { icon: string; color: string }> = {
  critical: { icon: "\u25CF", color: "var(--status-error-text)" },
  recommended: { icon: "\u25CF", color: "var(--status-warning-text)" },
  optional: { icon: "\u25CF", color: "var(--text-muted)" },
};

// =====================================================
// READINESS BADGE
// =====================================================

export function ReadinessBadge({
  domainId,
  size = "default",
  showChecklist = false,
  onScaffold,
}: {
  domainId: string;
  size?: "compact" | "default";
  showChecklist?: boolean;
  onScaffold?: () => void;
}) {
  const [data, setData] = useState<ReadinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(showChecklist);
  const [scaffolding, setScaffolding] = useState(false);

  const fetchReadiness = () => {
    setLoading(true);
    fetch(`/api/domains/${domainId}/readiness`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) setData(res);
      })
      .catch((e) => console.warn("[Readiness] Failed to load readiness:", e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/domains/${domainId}/readiness`)
      .then((r) => r.json())
      .then((res) => {
        if (!cancelled && res.ok) {
          setData(res);
        }
      })
      .catch((e) => console.warn("[Readiness] Failed to load readiness:", e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [domainId]);

  const handleQuickSetup = async () => {
    setScaffolding(true);
    try {
      // Step 1: scaffold (identity spec, playbook, publish, onboarding)
      await fetch(`/api/domains/${domainId}/scaffold`, { method: "POST" });
      // Step 2: generate content spec from assertions (if any exist)
      await fetch(`/api/domains/${domainId}/generate-content-spec`, { method: "POST" });
      // Step 3: refresh
      fetchReadiness();
      onScaffold?.();
    } catch {
      // Best-effort — user can still use manual fix links
    } finally {
      setScaffolding(false);
    }
  };

  if (loading) {
    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        padding: size === "compact" ? "2px 8px" : "4px 12px",
        fontSize: size === "compact" ? "11px" : "12px",
        borderRadius: "12px",
        backgroundColor: "var(--surface-secondary)",
        color: "var(--text-muted)",
      }}>
        Checking...
      </span>
    );
  }

  if (!data) return null;

  const config = levelConfig[data.level] || levelConfig.incomplete;

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: "4px" }}>
      {/* Badge pill */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: size === "compact" ? "2px 8px" : "4px 12px",
          fontSize: size === "compact" ? "11px" : "12px",
          fontWeight: 500,
          borderRadius: "12px",
          backgroundColor: config.bg,
          color: config.text,
          border: `1px solid ${config.border}`,
          cursor: "pointer",
          transition: "opacity 0.15s",
        }}
        title={`${data.criticalPassed}/${data.criticalTotal} critical, ${data.recommendedPassed}/${data.recommendedTotal} recommended`}
      >
        <span>{config.icon}</span>
        <span>{config.label}</span>
        {size !== "compact" && (
          <span style={{ opacity: 0.7, fontSize: "10px" }}>
            {data.score}%
          </span>
        )}
      </button>

      {/* Quick Setup button — shown when incomplete and expanded */}
      {expanded && data.level === "incomplete" && (
        <button
          onClick={handleQuickSetup}
          disabled={scaffolding}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 8,
            border: "none",
            background: scaffolding
              ? "var(--border-default)"
              : "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary, #8b5cf6) 100%)",
            color: scaffolding ? "var(--text-muted)" : "var(--surface-primary)",
            cursor: scaffolding ? "default" : "pointer",
            boxShadow: scaffolding ? "none" : "0 2px 8px rgba(99, 102, 241, 0.3)",
            transition: "all 0.2s",
            alignSelf: "flex-start",
          }}
        >
          {scaffolding ? "Setting up..." : "Quick Setup"}
        </button>
      )}

      {/* Expandable checklist */}
      {expanded && (
        <ReadinessChecklist checks={data.checks} level={data.level} />
      )}
    </div>
  );
}

// =====================================================
// READINESS CHECKLIST (expandable detail)
// =====================================================

export function ReadinessChecklist({
  checks,
  level,
}: {
  checks: ReadinessCheckResult[];
  level: string;
}) {
  const config = levelConfig[level] || levelConfig.incomplete;

  return (
    <div style={{
      border: `1px solid ${config.border}`,
      borderRadius: "8px",
      backgroundColor: "var(--surface-primary)",
      overflow: "hidden",
      fontSize: "13px",
    }}>
      {/* Group by severity */}
      {(["critical", "recommended", "optional"] as const).map((severity) => {
        const group = checks.filter((c) => c.severity === severity);
        if (group.length === 0) return null;

        return (
          <div key={severity}>
            <div style={{
              padding: "6px 12px",
              fontSize: "10px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: severityIcons[severity].color,
              backgroundColor: "var(--surface-secondary)",
              borderBottom: "1px solid var(--border-default)",
            }}>
              {severity} ({group.filter((c) => c.passed).length}/{group.length})
            </div>

            {group.map((check) => (
              <div
                key={check.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  padding: "8px 12px",
                  borderBottom: "1px solid var(--border-subtle, #f5f5f5)",
                }}
              >
                {/* Pass/fail icon */}
                <span style={{
                  fontSize: "14px",
                  lineHeight: "20px",
                  color: check.passed ? "var(--status-success-text)" : "var(--status-error-text)",
                  flexShrink: 0,
                }}>
                  {check.passed ? "\u2713" : "\u2717"}
                </span>

                {/* Check info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                    {check.name}
                  </div>
                  <div style={{
                    fontSize: "11px",
                    color: check.passed ? "var(--text-muted)" : "var(--status-error-text)",
                    marginTop: "1px",
                  }}>
                    {check.detail}
                  </div>
                </div>

                {/* Fix action link */}
                {!check.passed && check.fixAction && (
                  <a
                    href={check.fixAction.href}
                    style={{
                      fontSize: "11px",
                      color: "var(--accent-primary)",
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      alignSelf: "center",
                    }}
                  >
                    {check.fixAction.label} &rarr;
                  </a>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
