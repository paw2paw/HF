"use client";

import { useState } from "react";

function ControlBox({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#374151",
          marginBottom: 10,
          borderBottom: "1px solid #e5e7eb",
          paddingBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

export default function EnvironmentControlsCard() {
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [output, setOutput] = useState<string | null>(null);

  const runServiceOp = async (opid: string) => {
    setOutput(null);
    try {
      const res = await fetch(`/api/ops/${opid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      setOutput(data.stdout || data.output || data.message || JSON.stringify(data, null, 2));
    } catch (error: any) {
      setOutput(`Error: ${error.message}`);
    }
  };

  const startEnvironment = async (mode: "colima" | "docker") => {
    setIsStarting(true);
    const opid = mode === "colima" ? "service:start" : "service:start:docker";
    await runServiceOp(opid);
    setIsStarting(false);
  };

  const stopEnvironment = async () => {
    setIsStopping(true);
    await runServiceOp("service:stop");
    setIsStopping(false);
  };

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
        Controls
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Development Environment Box */}
        <ControlBox title="Development Environment">
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button
              onClick={() => startEnvironment("colima")}
              disabled={isStarting || isStopping}
              style={{
                flex: 1,
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: "#fff",
                background: isStarting ? "#9ca3af" : "#2563eb",
                border: "none",
                borderRadius: 6,
                cursor: isStarting || isStopping ? "not-allowed" : "pointer",
              }}
            >
              Start Colima
            </button>
            <button
              onClick={() => startEnvironment("docker")}
              disabled={isStarting || isStopping}
              style={{
                flex: 1,
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
                background: "#fff",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                cursor: isStarting || isStopping ? "not-allowed" : "pointer",
              }}
            >
              Start Docker Desktop
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={stopEnvironment}
              disabled={isStarting || isStopping}
              style={{
                flex: 1,
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: "#fff",
                background: isStopping ? "#9ca3af" : "#dc2626",
                border: "none",
                borderRadius: 6,
                cursor: isStarting || isStopping ? "not-allowed" : "pointer",
              }}
            >
              {isStopping ? "Stopping..." : "Stop All"}
            </button>
            <button
              onClick={() => runServiceOp("service:status")}
              style={{
                flex: 1,
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
                background: "#fff",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Check Status
            </button>
          </div>
          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 8 }}>
            Colima recommended (less RAM/disk usage)
          </div>
        </ControlBox>

        {/* Database Container Box */}
        <ControlBox title="Database Container">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button
              onClick={() => runServiceOp("service:db:status")}
              style={{
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: 500,
                color: "#374151",
                background: "#fff",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Status
            </button>
            <button
              onClick={() => runServiceOp("service:db:start")}
              style={{
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: "#fff",
                background: "#10b981",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Start
            </button>
            <button
              onClick={() => runServiceOp("service:db:stop")}
              style={{
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: "#fff",
                background: "#ef4444",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Stop
            </button>
            <button
              onClick={() => runServiceOp("service:db:restart")}
              style={{
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
                background: "#fbbf24",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Restart
            </button>
          </div>
        </ControlBox>

        {/* Database Data Box */}
        <ControlBox title="Database Data (CI)">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button
              onClick={() => runServiceOp("db:check")}
              title="Quick health check: verifies DB connection and counts rows in key tables"
              style={{
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: 500,
                color: "#374151",
                background: "#fff",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Check Data
            </button>
            <button
              onClick={() => runServiceOp("prisma:migrate:deploy")}
              title="Apply pending schema migrations. Use after pulling new code with DB changes."
              style={{
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: "#fff",
                background: "#2563eb",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Migrate
            </button>
            <button
              onClick={() => runServiceOp("prisma:seed")}
              title="Load initial data (parameters from CSV). Use after fresh DB setup."
              style={{
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: "#fff",
                background: "#10b981",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Seed
            </button>
            <button
              onClick={() => {
                if (window.confirm("This will DROP ALL DATA and recreate tables. Continue?")) {
                  runServiceOp("prisma:migrate:reset");
                }
              }}
              title="DESTRUCTIVE: Drops all tables and recreates them. Use to start completely fresh."
              style={{
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: "#fff",
                background: "#dc2626",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Reset
            </button>
          </div>
          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 8 }}>
            Data persisted in Docker volume <code>hf-postgres-data</code>
          </div>
        </ControlBox>
      </div>

      {/* Output */}
      {output && (
        <div
          style={{
            marginTop: 16,
            background: "#1f2937",
            color: "#e5e7eb",
            padding: 12,
            borderRadius: 6,
            fontFamily: "monospace",
            fontSize: 10,
            whiteSpace: "pre-wrap",
            maxHeight: 150,
            overflow: "auto",
          }}
        >
          {output}
        </div>
      )}
    </section>
  );
}
