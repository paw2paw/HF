"use client";

import { useState, useEffect } from "react";
import { AIModelsManager } from "@/components/shared/AIModelsManager";

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
  requiresMode?: boolean; // If true, shows mode selection buttons
};

const OPERATIONS: Operation[] = [
  {
    id: "scan-specs",
    title: "Scan for New Specs",
    description: "Scans /bdd-specs directory for new spec files not yet in the database. Import just new specs without recreating domains or playbooks.",
    icon: "\u{1F50D}",
    warning: "This will import new spec files into the database, creating BDDFeatureSet records, AnalysisSpec records, Parameters, and related entities.",
    endpoint: "/api/admin/spec-sync",
    method: "GET",
  },
  {
    id: "system",
    title: "Initialize System (Domains + Specs)",
    description: "Creates default domains (WNF TUTOR, COMPANION) with playbooks, then syncs all BDD specifications from /bdd-specs directory. This establishes the complete foundation: domains, playbooks, specs, parameters, anchors, and behavior targets.",
    icon: "\u{1F680}",
    warning: "This will create/recreate WNF TUTOR and COMPANION domains AND sync all specs. Existing domains with these slugs will be deleted along with their playbooks. AnalysisSpecs and Parameters from /bdd-specs/*.spec.json will be updated. All behavior targets and runtime spec customizations will be reset.",
    endpoint: "/api/x/seed-system",
    method: "POST",
  },
  {
    id: "transcripts",
    title: "Import Transcripts from Raw",
    description: "Scans HF_KB_PATH/sources/transcripts/raw for .json and .txt files. Creates Callers (by phone) and Calls. Updates caller names if better data is found.",
    icon: "\u{1F4DE}",
    warning: "Choose whether to REPLACE all existing callers/calls (fresh start) or KEEP existing data (skip duplicates). Run 'Initialize System' first for proper domain assignment.",
    endpoint: "/api/x/seed-transcripts",
    method: "POST",
    requiresMode: true,
  },
  {
    id: "cleanup",
    title: "Cleanup Orphaned Callers",
    description: "Deletes callers that have 0 calls. These are typically created during failed imports or testing.",
    icon: "\u{1F9F9}",
    warning: "This will permanently delete all Caller records that have no associated Calls. This is safe and recommended after imports.",
    endpoint: "/api/x/cleanup-callers",
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
    system: "idle",
    "scan-specs": "idle",
    transcripts: "idle",
    cleanup: "idle",
  });

  const [operationResults, setOperationResults] = useState<Record<string, OperationResult>>({});
  const [showModal, setShowModal] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<"replace" | "keep" | null>(null);
  const [showAIModels, setShowAIModels] = useState(false);

  // Scan results for the spec scanner
  const [scanResults, setScanResults] = useState<{
    summary: { totalFiles: number; synced: number; unseeded: number; orphaned: number };
    synced: Array<{ id: string; filename: string; dbSlug: string; specType: string; specRole: string | null }>;
    unseeded: Array<{ id: string; filename: string; title: string; specType: string; specRole: string }>;
    orphaned: Array<{ dbId: string; slug: string; name: string; specType: string; isActive: boolean }>;
  } | null>(null);

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

  async function executeScan() {
    setOperationStatus((prev) => ({ ...prev, "scan-specs": "running" }));
    setOperationResults((prev) => ({ ...prev, "scan-specs": {} }));
    setScanResults(null);

    try {
      const res = await fetch("/api/admin/spec-sync");
      const data = await res.json();

      if (data.ok) {
        setScanResults(data);
        setOperationStatus((prev) => ({ ...prev, "scan-specs": "success" }));
        setOperationResults((prev) => ({
          ...prev,
          "scan-specs": {
            message: `Found ${data.summary.unseeded} new spec(s), ${data.summary.synced} synced, ${data.summary.orphaned} orphaned`,
            details: data,
          },
        }));
      } else {
        setOperationStatus((prev) => ({ ...prev, "scan-specs": "error" }));
        setOperationResults((prev) => ({
          ...prev,
          "scan-specs": { error: data.error || "Scan failed" },
        }));
      }
    } catch (e: any) {
      setOperationStatus((prev) => ({ ...prev, "scan-specs": "error" }));
      setOperationResults((prev) => ({
        ...prev,
        "scan-specs": { error: e.message || "Network error" },
      }));
    }
  }

  async function executeImportNewSpecs() {
    setShowModal(null);
    setOperationStatus((prev) => ({ ...prev, "scan-specs": "running" }));

    try {
      const res = await fetch("/api/admin/spec-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (data.ok) {
        setOperationStatus((prev) => ({ ...prev, "scan-specs": "success" }));
        setOperationResults((prev) => ({
          ...prev,
          "scan-specs": { message: data.message, details: data },
        }));
        setScanResults(null); // Clear scan results after successful import
        loadStats(); // Refresh stats
      } else {
        setOperationStatus((prev) => ({ ...prev, "scan-specs": "error" }));
        setOperationResults((prev) => ({
          ...prev,
          "scan-specs": { error: data.error || "Import failed" },
        }));
      }
    } catch (e: any) {
      setOperationStatus((prev) => ({ ...prev, "scan-specs": "error" }));
      setOperationResults((prev) => ({
        ...prev,
        "scan-specs": { error: e.message || "Network error" },
      }));
    }
  }

  async function executeOperation(op: Operation, mode?: "replace" | "keep") {
    setShowModal(null);
    setSelectedMode(null);
    setOperationStatus((prev) => ({ ...prev, [op.id]: "running" }));
    setOperationResults((prev) => ({ ...prev, [op.id]: {} }));

    try {
      const body = mode ? JSON.stringify({ mode }) : undefined;
      const res = await fetch(op.endpoint, {
        method: op.method || "POST",
        headers: { "Content-Type": "application/json" },
        ...(body && { body }),
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
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          Data Management
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
          Re-load database from source files (transcripts, specs, domains)
        </p>
      </div>

      {/* Current Stats Card */}
      <div
        style={{
          padding: 20,
          background: "var(--background)",
          borderRadius: 12,
          border: "1px solid var(--border-default)",
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12 }}>
          Current Database State
        </div>
        {loadingStats ? (
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading...</div>
        ) : stats ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
            <StatItem label="Domains" value={stats.domains} />
            <StatItem label="Playbooks" value={stats.playbooks} />
            <StatItem label="Specs" value={stats.specs} />
            <StatItem label="Callers" value={stats.callers} />
            <StatItem label="Calls" value={stats.calls} />
          </div>
        ) : (
          <div style={{ fontSize: 14, color: "var(--status-error-text)" }}>Failed to load stats</div>
        )}
      </div>

      {/* Manage AI Models Section */}
      <div
        style={{
          padding: 20,
          background: "var(--background)",
          borderRadius: 12,
          border: "1px solid var(--border-default)",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
          }}
          onClick={() => setShowAIModels(!showAIModels)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>🤖</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                Manage AI Models
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Add, edit, or disable AI models available for pipeline operations
              </div>
            </div>
          </div>
          <span style={{ fontSize: 16, color: "var(--text-muted)" }}>
            {showAIModels ? "▼" : "▶"}
          </span>
        </div>

        {showAIModels && (
          <div style={{ marginTop: 16 }}>
            <AIModelsManager showHeader={false} />
          </div>
        )}
      </div>

      {/* Recommended Order Notice */}
      <div
        style={{
          padding: 16,
          background: "var(--status-info-bg)",
          borderRadius: 8,
          border: "1px solid var(--status-info-border)",
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--status-info-text)", marginBottom: 6 }}>
          💡 Recommended Execution Order
        </div>
        <ol style={{ fontSize: 13, color: "var(--status-info-text)", margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
          <li>
            <strong>Initialize System</strong> - Syncs all BDD specs, then creates WNF TUTOR and COMPANION domains with playbooks and behavior targets
          </li>
          <li>
            <strong>Import Transcripts</strong> - Creates callers and calls, assigns to domains
          </li>
        </ol>
      </div>

      {/* Operation Cards */}
      <div style={{ display: "grid", gap: 20 }}>
        {OPERATIONS.map((op) => {
          // Special handling for scan-specs card
          if (op.id === "scan-specs") {
            return (
              <ScanSpecsCard
                key={op.id}
                operation={op}
                status={operationStatus[op.id]}
                result={operationResults[op.id]}
                scanResults={scanResults}
                onScan={executeScan}
                onImport={() => setShowModal("scan-specs")}
              />
            );
          }

          return (
            <OperationCard
              key={op.id}
              operation={op}
              status={operationStatus[op.id]}
              result={operationResults[op.id]}
              onExecute={(mode) => {
                if (op.requiresMode && mode) {
                  setSelectedMode(mode);
                  setShowModal(op.id);
                } else if (!op.requiresMode) {
                  setShowModal(op.id);
                }
              }}
            />
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {showModal &&
        (showModal === "scan-specs" ? (
          <ConfirmationModal
            operation={{
              id: "scan-specs",
              title: "Import New Specs",
              description: "",
              icon: "📥",
              warning: `This will import ${scanResults?.unseeded.length || 0} new spec(s) into the database. This creates BDDFeatureSet records, AnalysisSpec records, Parameters, and related entities.`,
              endpoint: "/api/admin/spec-sync",
            }}
            mode={null}
            onConfirm={executeImportNewSpecs}
            onCancel={() => setShowModal(null)}
          />
        ) : (
          <ConfirmationModal
            operation={OPERATIONS.find((op) => op.id === showModal)!}
            mode={selectedMode}
            onConfirm={() => executeOperation(OPERATIONS.find((op) => op.id === showModal)!, selectedMode || undefined)}
            onCancel={() => {
              setShowModal(null);
              setSelectedMode(null);
            }}
          />
        ))}
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
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
  onExecute: (mode?: "replace" | "keep") => void;
}) {
  const isRunning = status === "running";
  const isSuccess = status === "success";
  const isError = status === "error";

  return (
    <div
      style={{
        padding: 24,
        background: "var(--surface-primary)",
        borderRadius: 12,
        border: `2px solid ${
          isSuccess ? "var(--status-success-text)" : isError ? "var(--status-error-text)" : "var(--border-default)"
        }`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        {/* Icon */}
        <div style={{ fontSize: 32, lineHeight: 1 }}>{operation.icon}</div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
            {operation.title}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 16 }}>
            {operation.description}
          </div>

          {/* Status/Results */}
          {isRunning && (
            <div
              style={{
                padding: 12,
                background: "var(--status-warning-bg)",
                border: "1px solid var(--status-warning-border)",
                borderRadius: 8,
                fontSize: 14,
                color: "var(--status-warning-text)",
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
                background: "var(--status-success-bg)",
                border: "1px solid var(--status-success-border)",
                borderRadius: 8,
                fontSize: 14,
                color: "var(--status-success-text)",
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
                background: "var(--status-error-bg)",
                border: "1px solid var(--status-error-border)",
                borderRadius: 8,
                fontSize: 14,
                color: "var(--status-error-text)",
                marginBottom: 12,
              }}
            >
              ❌ {result.error}
            </div>
          )}

          {/* Buttons */}
          {operation.requiresMode ? (
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => onExecute("replace")}
                disabled={isRunning}
                style={{
                  padding: "10px 20px",
                  background: isRunning ? "var(--button-disabled-bg)" : "var(--button-destructive-bg)",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: isRunning ? "not-allowed" : "pointer",
                  opacity: isRunning ? 0.6 : 1,
                }}
              >
                🗑️ Replace ALL
              </button>
              <button
                onClick={() => onExecute("keep")}
                disabled={isRunning}
                style={{
                  padding: "10px 20px",
                  background: isRunning ? "var(--button-disabled-bg)" : "var(--button-success-bg)",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: isRunning ? "not-allowed" : "pointer",
                  opacity: isRunning ? 0.6 : 1,
                }}
              >
                📥 Keep ALL (Skip Duplicates)
              </button>
            </div>
          ) : (
            <button
              onClick={() => onExecute()}
              disabled={isRunning}
              style={{
                padding: "10px 20px",
                background: isRunning ? "var(--button-disabled-bg)" : "var(--button-primary-bg)",
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
          )}
        </div>
      </div>
    </div>
  );
}

function ScanSpecsCard({
  operation,
  status,
  result,
  scanResults,
  onScan,
  onImport,
}: {
  operation: Operation;
  status: OperationStatus;
  result?: OperationResult;
  scanResults: {
    summary: { totalFiles: number; synced: number; unseeded: number; orphaned: number };
    unseeded: Array<{ id: string; filename: string; title: string; specType: string; specRole: string }>;
    orphaned: Array<{ dbId: string; slug: string; name: string; specType: string }>;
  } | null;
  onScan: () => void;
  onImport: () => void;
}) {
  const [showUnseeded, setShowUnseeded] = useState(true);
  const [showOrphaned, setShowOrphaned] = useState(false);
  const isRunning = status === "running";
  const isSuccess = status === "success";
  const isError = status === "error";

  return (
    <div
      style={{
        padding: 24,
        background: "var(--surface-primary)",
        borderRadius: 12,
        border: `2px solid ${
          isSuccess ? "var(--status-success-text)" : isError ? "var(--status-error-text)" : "var(--border-default)"
        }`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{ fontSize: 32, lineHeight: 1 }}>{operation.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
            {operation.title}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 16 }}>
            {operation.description}
          </div>

          {/* Status Messages */}
          {isRunning && (
            <div
              style={{
                padding: 12,
                background: "var(--status-warning-bg)",
                border: "1px solid var(--status-warning-border)",
                borderRadius: 8,
                fontSize: 14,
                color: "var(--status-warning-text)",
                marginBottom: 12,
              }}
            >
              Scanning specs directory...
            </div>
          )}

          {isSuccess && result?.message && !scanResults && (
            <div
              style={{
                padding: 12,
                background: "var(--status-success-bg)",
                border: "1px solid var(--status-success-border)",
                borderRadius: 8,
                fontSize: 14,
                color: "var(--status-success-text)",
                marginBottom: 12,
              }}
            >
              {result.message}
            </div>
          )}

          {isError && result?.error && (
            <div
              style={{
                padding: 12,
                background: "var(--status-error-bg)",
                border: "1px solid var(--status-error-border)",
                borderRadius: 8,
                fontSize: 14,
                color: "var(--status-error-text)",
                marginBottom: 12,
              }}
            >
              {result.error}
            </div>
          )}

          {/* Scan Results */}
          {scanResults && (
            <div style={{ marginBottom: 16 }}>
              {/* Summary */}
              <div
                style={{
                  padding: 12,
                  background: "var(--status-info-bg)",
                  border: "1px solid var(--status-info-border)",
                  borderRadius: 8,
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--status-info-text)" }}>
                  Scan Results: {scanResults.summary.totalFiles} files total
                </div>
                <div style={{ fontSize: 13, color: "var(--status-info-text)", marginTop: 4 }}>
                  {scanResults.summary.synced} synced | {scanResults.summary.unseeded} new |{" "}
                  {scanResults.summary.orphaned} orphaned
                </div>
              </div>

              {/* New Specs List */}
              {scanResults.unseeded.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <button
                    onClick={() => setShowUnseeded(!showUnseeded)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                      New Specs ({scanResults.unseeded.length})
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>{showUnseeded ? "▼" : "▶"}</span>
                  </button>
                  {showUnseeded && (
                    <div style={{ paddingLeft: 16, borderLeft: "2px solid var(--status-success-border)" }}>
                      {scanResults.unseeded.map((spec) => (
                        <div key={spec.id} style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{spec.id}</span>
                          <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>
                            ({spec.specType}/{spec.specRole})
                          </span>
                          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{spec.title}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Orphaned Specs Warning */}
              {scanResults.orphaned.length > 0 && (
                <div
                  style={{
                    padding: 12,
                    background: "var(--status-warning-bg)",
                    border: "1px solid var(--status-warning-border)",
                    borderRadius: 8,
                    marginBottom: 12,
                  }}
                >
                  <button
                    onClick={() => setShowOrphaned(!showOrphaned)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--status-warning-text)" }}>
                      Orphaned Specs ({scanResults.orphaned.length}) - in DB but file missing
                    </span>
                    <span style={{ color: "var(--status-warning-text)" }}>{showOrphaned ? "▼" : "▶"}</span>
                  </button>
                  {showOrphaned && (
                    <div style={{ marginTop: 8, paddingLeft: 16 }}>
                      {scanResults.orphaned.map((spec) => (
                        <div key={spec.dbId} style={{ fontSize: 12, color: "var(--status-warning-text)", marginBottom: 4 }}>
                          {spec.slug} ({spec.name})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* All Synced Message */}
              {scanResults.unseeded.length === 0 && (
                <div
                  style={{
                    padding: 12,
                    background: "var(--status-success-bg)",
                    border: "1px solid var(--status-success-border)",
                    borderRadius: 8,
                    fontSize: 14,
                    color: "var(--status-success-text)",
                    marginBottom: 12,
                  }}
                >
                  All specs are synced! No new specs to import.
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={onScan}
              disabled={isRunning}
              style={{
                padding: "10px 20px",
                background: isRunning ? "var(--button-disabled-bg)" : "var(--button-primary-bg)",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: isRunning ? "not-allowed" : "pointer",
                opacity: isRunning ? 0.6 : 1,
              }}
            >
              {isRunning ? "Scanning..." : "Scan for New Specs"}
            </button>

            {scanResults && scanResults.unseeded.length > 0 && (
              <button
                onClick={onImport}
                disabled={isRunning}
                style={{
                  padding: "10px 20px",
                  background: isRunning ? "var(--button-disabled-bg)" : "var(--button-success-bg)",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: isRunning ? "not-allowed" : "pointer",
                  opacity: isRunning ? 0.6 : 1,
                }}
              >
                Import {scanResults.unseeded.length} New Spec(s)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmationModal({
  operation,
  mode,
  onConfirm,
  onCancel,
}: {
  operation: Operation;
  mode: "replace" | "keep" | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Get mode-specific warning if applicable
  const getWarning = () => {
    if (operation.requiresMode && mode) {
      if (mode === "replace") {
        return "⚠️ DESTRUCTIVE: This will DELETE all existing Callers and Calls from the database, then import fresh from /transcripts directory. All analysis artifacts, behavior targets, and caller histories will be permanently removed. This cannot be undone.";
      } else {
        return "This will import transcripts from /transcripts directory. Existing callers/calls will be kept, and only new data will be added. Calls with matching externalId will be skipped.";
      }
    }
    return operation.warning;
  };

  const getButtonColor = () => {
    if (operation.requiresMode && mode === "replace") {
      return "var(--button-destructive-bg)"; // Red for destructive
    }
    return "var(--button-destructive-bg)"; // Red for all confirmations
  };

  const getTitle = () => {
    if (operation.requiresMode && mode) {
      return `${operation.title} - ${mode === "replace" ? "Replace ALL" : "Keep ALL"}`;
    }
    return operation.title;
  };

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
          background: "var(--modal-bg)",
          borderRadius: 16,
          padding: 32,
          maxWidth: 500,
          width: "90%",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 48, textAlign: "center", marginBottom: 16 }}>
          {operation.requiresMode && mode === "replace" ? "🗑️" : "⚠️"}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12, textAlign: "center" }}>
          {getTitle()}
        </div>
        <div
          style={{
            padding: 16,
            background: operation.requiresMode && mode === "replace" ? "var(--status-error-bg)" : "var(--status-warning-bg)",
            border: `1px solid ${operation.requiresMode && mode === "replace" ? "var(--status-error-border)" : "var(--status-warning-border)"}`,
            borderRadius: 8,
            fontSize: 14,
            color: operation.requiresMode && mode === "replace" ? "var(--status-error-text)" : "var(--status-warning-text)",
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          {getWarning()}
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "10px 20px",
              background: "var(--surface-primary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--input-border)",
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
              background: getButtonColor(),
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
