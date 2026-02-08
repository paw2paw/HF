"use client";

import { useState, useEffect } from "react";

type ServiceStatus = "ok" | "error" | "warning" | "unknown" | "loading";

interface StatusCheck {
  name: string;
  status: ServiceStatus;
  message: string;
  details?: string;
}

export default function SystemStatusCard() {
  const [checks, setChecks] = useState<StatusCheck[]>([
    { name: "Docker Runtime", status: "loading", message: "Checking..." },
    { name: "PostgreSQL Database", status: "loading", message: "Checking..." },
    { name: "Knowledge Base Path", status: "loading", message: "Checking..." },
    { name: "Dev Server", status: "loading", message: "Checking..." },
  ]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();

      const newChecks: StatusCheck[] = [];

      // Docker Runtime
      if (data.checks?.docker) {
        newChecks.push({
          name: "Docker Runtime",
          status: data.checks.docker.status,
          message: data.checks.docker.message,
          details: data.checks.docker.details?.runtime,
        });
      } else {
        newChecks.push({
          name: "Docker Runtime",
          status: "error",
          message: "Docker not available",
        });
      }

      // PostgreSQL
      if (data.checks?.database) {
        newChecks.push({
          name: "PostgreSQL Database",
          status: data.checks.database.status,
          message: data.checks.database.message,
        });
      } else {
        newChecks.push({
          name: "PostgreSQL Database",
          status: "unknown",
          message: "No database check",
        });
      }

      // Knowledge Base Path
      if (data.checks?.hf_kb_path) {
        newChecks.push({
          name: "Knowledge Base Path",
          status: data.checks.hf_kb_path.status,
          message: data.checks.hf_kb_path.message,
          details: data.checks.hf_kb_path.details?.path,
        });
      } else {
        newChecks.push({
          name: "Knowledge Base Path",
          status: "unknown",
          message: "No HF_KB_PATH check",
        });
      }

      // Dev Server (always ok if we got this far)
      newChecks.push({
        name: "Dev Server",
        status: "ok",
        message: "Running on localhost:3000",
      });

      setChecks(newChecks);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      setChecks([
        { name: "Docker Runtime", status: "error", message: "Health check failed" },
        { name: "PostgreSQL Database", status: "error", message: "Health check failed" },
        { name: "Knowledge Base Path", status: "unknown", message: "Health check failed" },
        { name: "Dev Server", status: "ok", message: "Running (health API error)" },
      ]);
      setLastUpdated(new Date().toLocaleTimeString());
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: ServiceStatus) => {
    switch (status) {
      case "ok": return "#10b981";
      case "warning": return "#f59e0b";
      case "error": return "#ef4444";
      case "loading": return "#6b7280";
      default: return "#9ca3af";
    }
  };

  const allOk = checks.every((c) => c.status === "ok");
  const hasErrors = checks.some((c) => c.status === "error");

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 20,
      }}
    >
      {/* Header with overall status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: allOk ? "#10b981" : hasErrors ? "#ef4444" : "#f59e0b",
            }}
          />
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>System Status</h2>
        </div>
        <button
          onClick={fetchStatus}
          style={{
            padding: "4px 10px",
            fontSize: 11,
            background: "#f3f4f6",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {/* Status Items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {checks.map((check) => (
          <div
            key={check.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              background: "#f9fafb",
              borderRadius: 6,
              borderLeft: `3px solid ${getStatusColor(check.status)}`,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: getStatusColor(check.status),
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{check.name}</div>
              <div style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {check.message}
                {check.details && ` - ${check.details}`}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Last updated */}
      {lastUpdated && (
        <div style={{ marginTop: 12, fontSize: 10, color: "#9ca3af", textAlign: "right" }}>
          Last updated: {lastUpdated}
        </div>
      )}
    </section>
  );
}
