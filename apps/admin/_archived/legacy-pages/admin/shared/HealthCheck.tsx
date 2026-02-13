// apps/admin/app/admin/shared/HealthCheck.tsx
"use client";

import { useState, useEffect } from "react";

type HealthStatus = "ok" | "error" | "warning";

interface HealthCheckDetail {
  status: HealthStatus;
  message: string;
  details?: any;
}

interface HealthCheckResponse {
  ok: boolean;
  status: HealthStatus;
  checks: {
    database: HealthCheckDetail;
    kbPath: HealthCheckDetail;
    env: HealthCheckDetail;
    fsPermissions?: HealthCheckDetail;
  };
  timestamp: string;
}

const uiColors = {
  statusOk: "#10b981",      // green-500
  statusWarning: "#f59e0b", // amber-500
  statusError: "#ef4444",   // red-500
  bg: "#ffffff",
  border: "#e5e7eb",        // gray-200
  textLabel: "#6b7280",     // gray-500
  textValue: "#111827",     // gray-900
};

export default function HealthCheck() {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/health");
      if (!res.ok) {
        throw new Error(`Health check failed: ${res.status}`);
      }
      const data = await res.json();
      setHealth(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: HealthStatus) => {
    switch (status) {
      case "ok":
        return uiColors.statusOk;
      case "warning":
        return uiColors.statusWarning;
      case "error":
        return uiColors.statusError;
      default:
        return uiColors.textLabel;
    }
  };

  const getStatusIcon = (status: HealthStatus) => {
    switch (status) {
      case "ok":
        return "●"; // Green circle
      case "warning":
        return "●"; // Yellow circle
      case "error":
        return "●"; // Red circle
      default:
        return "○";
    }
  };

  if (loading && !health) {
    return (
      <div style={{ padding: "12px 16px", fontSize: 14, color: uiColors.textLabel }}>
        Loading health status...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "12px 16px",
          fontSize: 14,
          color: uiColors.statusError,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 18 }}>●</span>
        <span>Health check unavailable: {error}</span>
      </div>
    );
  }

  if (!health) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "16px",
        background: uiColors.bg,
        border: `1px solid ${uiColors.border}`,
        borderRadius: 8,
      }}
    >
      {/* Overall status */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            fontSize: 24,
            color: getStatusColor(health.status),
          }}
        >
          {getStatusIcon(health.status)}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: uiColors.textValue }}>
            System Health
          </div>
          <div style={{ fontSize: 12, color: uiColors.textLabel }}>
            {health.ok ? "All systems operational" : "Issues detected"}
          </div>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            color: uiColors.textLabel,
            background: "transparent",
            border: `1px solid ${uiColors.border}`,
            borderRadius: 4,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? "Checking..." : "Refresh"}
        </button>
      </div>

      {/* Individual checks */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Object.entries(health.checks).map(([key, check]) => (
          <CheckItem
            key={key}
            label={formatCheckLabel(key)}
            check={check}
          />
        ))}
      </div>

      {/* Timestamp */}
      <div style={{ fontSize: 11, color: uiColors.textLabel, textAlign: "right" }}>
        Last checked: {new Date(health.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}

function CheckItem({ label, check }: { label: string; check: HealthCheckDetail }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        padding: "8px 12px",
        background: "#f9fafb",
        borderRadius: 6,
        borderLeft: `3px solid ${getStatusColor(check.status)}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: check.details ? "pointer" : "default",
        }}
        onClick={() => check.details && setExpanded(!expanded)}
      >
        <span
          style={{
            fontSize: 14,
            color: getStatusColor(check.status),
          }}
        >
          ●
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: uiColors.textValue }}>
            {label}
          </div>
          <div style={{ fontSize: 12, color: uiColors.textLabel }}>
            {check.message}
          </div>
        </div>
        {check.details && (
          <span style={{ fontSize: 12, color: uiColors.textLabel }}>
            {expanded ? "▼" : "▶"}
          </span>
        )}
      </div>

      {expanded && check.details && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            background: "#fff",
            borderRadius: 4,
            fontSize: 11,
            fontFamily: "monospace",
            color: uiColors.textLabel,
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(check.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function formatCheckLabel(key: string): string {
  const labels: Record<string, string> = {
    database: "Database",
    kbPath: "Knowledge Base Path",
    env: "Environment Variables",
    fsPermissions: "File System Permissions",
  };
  return labels[key] || key;
}

function getStatusColor(status: HealthStatus): string {
  switch (status) {
    case "ok":
      return uiColors.statusOk;
    case "warning":
      return uiColors.statusWarning;
    case "error":
      return uiColors.statusError;
    default:
      return uiColors.textLabel;
  }
}
