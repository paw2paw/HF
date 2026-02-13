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
    bg: "#ecfdf5",
    text: "#065f46",
    border: "#a7f3d0",
    label: "Ready",
    icon: "\u2713", // checkmark
  },
  almost: {
    bg: "#fffbeb",
    text: "#92400e",
    border: "#fde68a",
    label: "Almost Ready",
    icon: "\u25CB", // circle
  },
  incomplete: {
    bg: "#fef2f2",
    text: "#991b1b",
    border: "#fecaca",
    label: "Not Ready",
    icon: "\u2717", // x mark
  },
};

const severityIcons: Record<string, { icon: string; color: string }> = {
  critical: { icon: "\u25CF", color: "#dc2626" },
  recommended: { icon: "\u25CF", color: "#f59e0b" },
  optional: { icon: "\u25CF", color: "#6b7280" },
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
      .catch(() => {})
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
      .catch(() => {})
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
        backgroundColor: "#f3f4f6",
        color: "#9ca3af",
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
              ? "#e5e7eb"
              : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            color: scaffolding ? "#9ca3af" : "#fff",
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
      backgroundColor: "#ffffff",
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
              backgroundColor: "#fafafa",
              borderBottom: "1px solid #f0f0f0",
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
                  borderBottom: "1px solid #f5f5f5",
                }}
              >
                {/* Pass/fail icon */}
                <span style={{
                  fontSize: "14px",
                  lineHeight: "20px",
                  color: check.passed ? "#16a34a" : "#dc2626",
                  flexShrink: 0,
                }}>
                  {check.passed ? "\u2713" : "\u2717"}
                </span>

                {/* Check info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: "#1f2937" }}>
                    {check.name}
                  </div>
                  <div style={{
                    fontSize: "11px",
                    color: check.passed ? "#6b7280" : "#dc2626",
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
                      color: "#2563eb",
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
