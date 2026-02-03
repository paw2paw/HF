"use client";

import { useState, useEffect } from "react";

type OperationStatus = "idle" | "running" | "success" | "error";

type OperationResult = {
  message?: string;
  details?: any;
  error?: string;
};

type Operation = {
  id: string;
  title: string;
  description: string;
  icon: string;
  warning: string;
  endpoint: string;
  method?: "GET" | "POST";
};

const OPERATIONS: Operation[] = [
  {
    id: "domains",
    title: "Initialize Default Domains",
    description: "Creates WNF TUTOR and COMPANION domains with all required playbooks, specs, parameters, and behavior targets.",
    icon: "🌐",
    warning: "This will create/recreate WNF TUTOR and COMPANION domains. Existing domains with these slugs will be deleted along with their playbooks. All behavior targets and spec assignments will be reset.",
    endpoint: "/api/x/seed-domains",
    method: "POST",
  },
  {
    id: "specs",
    title: "Sync BDD Specifications",
    description: "Refreshes Feature Sets and Analysis Specs from /bdd-specs directory. Creates parameters, anchors, and prompt slugs.",
    icon: "🎯",
    warning: "This will overwrite AnalysisSpecs and Parameters from /bdd-specs/*.spec.json. Existing specs with matching slugs will be updated. Runtime customizations to specs will be lost.",
    endpoint: "/api/lab/sync-specs",
    method: "POST",
  },
  {
    id: "transcripts",
    title: "Import Transcripts",
    description: "Recursively scans /transcripts directory and all subdirectories. Creates or updates Callers and Calls, establishing proper linkages.",
    icon: "📞",
    warning: "This will create Callers and Calls from all files in /transcripts directory (including subdirectories). Callers will be assigned to domains (default domain if others don't exist). Existing calls with same externalId will be skipped. Run 'Initialize Domains' first for proper caller assignment.",
    endpoint: "/api/x/seed-transcripts",
    method: "POST",
  },
];

export default function DataManagementPage() {
  const [stats, setStats] = useState<{
    domains: number;
    playbooks: number;
    specs: number;
    callers: number;
    calls: number;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [operationStatus, setOperationStatus] = useState<Record<string, OperationStatus>>({
    domains: "idle",
    specs: "idle",
    transcripts: "idle",
  });

  const [operationResults, setOperationResults] = useState<Record<string, OperationResult>>({});
  const [showModal, setShowModal] = useState<string | null>(null);

  // Load current stats
  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/x/data-management/stats");
      const data = await res.json();
      if (data.ok) {
        setStats(data.stats);
      }
    } catch (e) {
      console.error("Failed to load stats:", e);
    } finally {
      setLoadingStats(false);
    }
  }

  async function executeOperation(op: Operation) {
    setShowModal(null);
    setOperationStatus((prev) => ({ ...prev, [op.id]: "running" }));
    setOperationResults((prev) => ({ ...prev, [op.id]: {} }));

    try {
      const res = await fetch(op.endpoint, {
        method: op.method || "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (data.ok) {
        setOperationStatus((prev) => ({ ...prev, [op.id]: "success" }));
        setOperationResults((prev) => ({
          ...prev,
          [op.id]: { message: data.message, details: data },
        }));
        // Reload stats after successful operation
        loadStats();
      } else {
        setOperationStatus((prev) => ({ ...prev, [op.id]: "error" }));
        setOperationResults((prev) => ({
          ...prev,
          [op.id]: { error: data.error || "Operation failed" },
        }));
      }
    } catch (e: any) {
      setOperationStatus((prev) => ({ ...prev, [op.id]: "error" }));
      setOperationResults((prev) => ({
        ...prev,
        [op.id]: { error: e.message || "Network error" },
      }));
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1f2937", margin: 0 }}>
          Data Management
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          Re-load database from source files (transcripts, specs, domains)
        </p>
      </div>

      {/* Current Stats Card */}
      <div
        style={{
          padding: 20,
          background: "#f9fafb",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 12 }}>
          Current Database State
        </div>
        {loadingStats ? (
          <div style={{ fontSize: 14, color: "#6b7280" }}>Loading...</div>
        ) : stats ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
            <StatItem label="Domains" value={stats.domains} />
            <StatItem label="Playbooks" value={stats.playbooks} />
            <StatItem label="Specs" value={stats.specs} />
            <StatItem label="Callers" value={stats.callers} />
            <StatItem label="Calls" value={stats.calls} />
          </div>
        ) : (
          <div style={{ fontSize: 14, color: "#ef4444" }}>Failed to load stats</div>
        )}
      </div>

      {/* Recommended Order Notice */}
      <div
        style={{
          padding: 16,
          background: "#eff6ff",
          borderRadius: 8,
          border: "1px solid #dbeafe",
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e40af", marginBottom: 6 }}>
          💡 Recommended Execution Order
        </div>
        <ol style={{ fontSize: 13, color: "#1e3a8a", margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
          <li>
            <strong>Initialize Default Domains</strong> - Establishes WNF TUTOR and COMPANION with
            their specs
          </li>
          <li>
            <strong>Sync BDD Specifications</strong> - Adds additional specs from file system
          </li>
          <li>
            <strong>Import Transcripts</strong> - Creates callers and calls, assigns to domains
          </li>
        </ol>
      </div>

      {/* Operation Cards */}
      <div style={{ display: "grid", gap: 20 }}>
        {OPERATIONS.map((op) => (
          <OperationCard
            key={op.id}
            operation={op}
            status={operationStatus[op.id]}
            result={operationResults[op.id]}
            onExecute={() => setShowModal(op.id)}
          />
        ))}
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <ConfirmationModal
          operation={OPERATIONS.find((op) => op.id === showModal)!}
          onConfirm={() => executeOperation(OPERATIONS.find((op) => op.id === showModal)!)}
          onCancel={() => setShowModal(null)}
        />
      )}
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1f2937" }}>{value}</div>
    </div>
  );
}

function OperationCard({
  operation,
  status,
  result,
  onExecute,
}: {
  operation: Operation;
  status: OperationStatus;
  result?: OperationResult;
  onExecute: () => void;
}) {
  const isRunning = status === "running";
  const isSuccess = status === "success";
  const isError = status === "error";

  return (
    <div
      style={{
        padding: 24,
        background: "white",
        borderRadius: 12,
        border: `2px solid ${
          isSuccess ? "#10b981" : isError ? "#ef4444" : "#e5e7eb"
        }`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        {/* Icon */}
        <div style={{ fontSize: 32, lineHeight: 1 }}>{operation.icon}</div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1f2937", marginBottom: 6 }}>
            {operation.title}
          </div>
          <div style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.5, marginBottom: 16 }}>
            {operation.description}
          </div>

          {/* Status/Results */}
          {isRunning && (
            <div
              style={{
                padding: 12,
                background: "#fef3c7",
                border: "1px solid #fde047",
                borderRadius: 8,
                fontSize: 14,
                color: "#92400e",
                marginBottom: 12,
              }}
            >
              ⏳ Running operation...
            </div>
          )}

          {isSuccess && result?.message && (
            <div
              style={{
                padding: 12,
                background: "#d1fae5",
                border: "1px solid #86efac",
                borderRadius: 8,
                fontSize: 14,
                color: "#065f46",
                marginBottom: 12,
              }}
            >
              ✅ {result.message}
            </div>
          )}

          {isError && result?.error && (
            <div
              style={{
                padding: 12,
                background: "#fee2e2",
                border: "1px solid #fca5a5",
                borderRadius: 8,
                fontSize: 14,
                color: "#991b1b",
                marginBottom: 12,
              }}
            >
              ❌ {result.error}
            </div>
          )}

          {/* Button */}
          <button
            onClick={onExecute}
            disabled={isRunning}
            style={{
              padding: "10px 20px",
              background: isRunning ? "#d1d5db" : "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: isRunning ? "not-allowed" : "pointer",
              opacity: isRunning ? 0.6 : 1,
            }}
          >
            {isRunning ? "Running..." : `Run ${operation.title}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmationModal({
  operation,
  onConfirm,
  onCancel,
}: {
  operation: Operation;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: 32,
          maxWidth: 500,
          width: "90%",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 48, textAlign: "center", marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", marginBottom: 12, textAlign: "center" }}>
          {operation.title}
        </div>
        <div
          style={{
            padding: 16,
            background: "#fef3c7",
            border: "1px solid #fde047",
            borderRadius: 8,
            fontSize: 14,
            color: "#92400e",
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          {operation.warning}
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "10px 20px",
              background: "white",
              color: "#374151",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "10px 20px",
              background: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Yes, Proceed
          </button>
        </div>
      </div>
    </div>
  );
}
