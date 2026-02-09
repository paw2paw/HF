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
  requiresMode?: boolean;
};

type PlaybookOption = {
  id: string;
  name: string;
  description: string;
  domain: {
    slug: string;
    name: string;
    description: string;
  };
  status: string;
  specCount: number;
  behaviorTargetCount: number;
  identitySpecs: string[];
  contentSpecs: string[];
  requiredSpecs: string[];
  optionalSpecs: string[];
  systemDomains: string[];
};

const OPERATIONS: Operation[] = [
  {
    id: "transcripts",
    title: "Import Transcripts from Raw",
    description: "Scans HF_KB_PATH/sources/transcripts/raw for .json and .txt files. Creates Callers (by phone) and Calls. Updates caller names if better data is found.",
    icon: "📞",
    warning: "Choose whether to REPLACE all existing callers/calls (fresh start) or KEEP existing data (skip duplicates). Run 'Sync All BDD Specs' first for proper domain assignment.",
    endpoint: "/api/x/seed-transcripts",
    method: "POST",
    requiresMode: true,
  },
  {
    id: "cleanup",
    title: "Cleanup Orphaned Callers",
    description: "Deletes callers that have 0 calls. These are typically created during failed imports or testing.",
    icon: "🧹",
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
    "sync-specs": "idle",
    "create-domains": "idle",
    transcripts: "idle",
    cleanup: "idle",
  });

  const [operationResults, setOperationResults] = useState<Record<string, OperationResult>>({});
  const [showModal, setShowModal] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<"replace" | "keep" | null>(null);
  const [showAIModels, setShowAIModels] = useState(false);

  // Playbook selection for create-domains
  const [availablePlaybooks, setAvailablePlaybooks] = useState<PlaybookOption[]>([]);
  const [selectedPlaybooks, setSelectedPlaybooks] = useState<Set<string>>(new Set());
  const [loadingPlaybooks, setLoadingPlaybooks] = useState(false);

  // Sync status for specs
  const [syncStatus, setSyncStatus] = useState<{
    totalFiles: number;
    syncedFiles: number;
    unsyncedFiles: number;
  } | null>(null);
  const [loadingSyncStatus, setLoadingSyncStatus] = useState(false);

  // Load current stats
  useEffect(() => {
    loadStats();
    loadAvailablePlaybooks();
    loadSyncStatus();
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

  async function loadAvailablePlaybooks() {
    setLoadingPlaybooks(true);
    try {
      const res = await fetch("/api/x/create-domains");
      const data = await res.json();
      if (data.ok) {
        setAvailablePlaybooks(data.playbooks);
      }
    } catch (e) {
      console.error("Failed to load available playbooks:", e);
    } finally {
      setLoadingPlaybooks(false);
    }
  }

  async function loadSyncStatus() {
    setLoadingSyncStatus(true);
    try {
      const res = await fetch("/api/x/sync-specs");
      const data = await res.json();
      if (data.ok) {
        setSyncStatus({
          totalFiles: data.totalFiles,
          syncedFiles: data.syncedFiles,
          unsyncedFiles: data.unsyncedFiles,
        });
      }
    } catch (e) {
      console.error("Failed to load sync status:", e);
    } finally {
      setLoadingSyncStatus(false);
    }
  }

  async function executeSyncSpecs() {
    setShowModal(null);
    setOperationStatus((prev) => ({ ...prev, "sync-specs": "running" }));
    setOperationResults((prev) => ({ ...prev, "sync-specs": {} }));

    try {
      const res = await fetch("/api/x/sync-specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (data.ok) {
        setOperationStatus((prev) => ({ ...prev, "sync-specs": "success" }));
        setOperationResults((prev) => ({
          ...prev,
          "sync-specs": { message: data.message, details: data },
        }));
        loadStats();
        loadSyncStatus(); // Refresh sync status after syncing
      } else {
        setOperationStatus((prev) => ({ ...prev, "sync-specs": "error" }));
        setOperationResults((prev) => ({
          ...prev,
          "sync-specs": { error: data.error || "Sync failed" },
        }));
      }
    } catch (e: any) {
      setOperationStatus((prev) => ({ ...prev, "sync-specs": "error" }));
      setOperationResults((prev) => ({
        ...prev,
        "sync-specs": { error: e.message || "Network error" },
      }));
    }
  }

  async function executeCreateDomains() {
    setShowModal(null);
    setOperationStatus((prev) => ({ ...prev, "create-domains": "running" }));
    setOperationResults((prev) => ({ ...prev, "create-domains": {} }));

    try {
      const res = await fetch("/api/x/create-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playbookIds: Array.from(selectedPlaybooks),
        }),
      });
      const data = await res.json();

      if (data.ok) {
        setOperationStatus((prev) => ({ ...prev, "create-domains": "success" }));
        setOperationResults((prev) => ({
          ...prev,
          "create-domains": { message: data.message, details: data },
        }));
        loadStats();
        setSelectedPlaybooks(new Set()); // Clear selection after success
      } else {
        setOperationStatus((prev) => ({ ...prev, "create-domains": "error" }));
        setOperationResults((prev) => ({
          ...prev,
          "create-domains": { error: data.error || "Create failed" },
        }));
      }
    } catch (e: any) {
      setOperationStatus((prev) => ({ ...prev, "create-domains": "error" }));
      setOperationResults((prev) => ({
        ...prev,
        "create-domains": { error: e.message || "Network error" },
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
          Initialize system from source files (specs, domains, playbooks, transcripts)
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
            <strong>Sync All BDD Specs</strong> - Import all spec files from /bdd-specs directory (parameters, analysis specs, anchors)
          </li>
          <li>
            <strong>Create Domains & Playbooks</strong> - Select and create domains with playbooks and behavior targets (requires specs to exist)
          </li>
          <li>
            <strong>Import Transcripts</strong> - Create callers and calls from raw transcripts (requires domains for assignment)
          </li>
        </ol>
      </div>

      {/* Operation Cards */}
      <div style={{ display: "grid", gap: 20 }}>
        {/* Sync All BDD Specs */}
        <SyncSpecsCard
          status={operationStatus["sync-specs"]}
          result={operationResults["sync-specs"]}
          syncStatus={syncStatus}
          loadingSyncStatus={loadingSyncStatus}
          onExecute={() => setShowModal("sync-specs")}
        />

        {/* Create Domains & Playbooks */}
        <CreateDomainsCard
          status={operationStatus["create-domains"]}
          result={operationResults["create-domains"]}
          availablePlaybooks={availablePlaybooks}
          selectedPlaybooks={selectedPlaybooks}
          onTogglePlaybook={(id) => {
            const newSelection = new Set(selectedPlaybooks);
            if (newSelection.has(id)) {
              newSelection.delete(id);
            } else {
              newSelection.add(id);
            }
            setSelectedPlaybooks(newSelection);
          }}
          onExecute={() => {
            if (selectedPlaybooks.size > 0) {
              setShowModal("create-domains");
            }
          }}
          loadingPlaybooks={loadingPlaybooks}
        />

        {/* Other Operations */}
        {OPERATIONS.map((op) => {
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

      {/* Confirmation Modals */}
      {showModal === "sync-specs" && (
        <ConfirmationModal
          title="Sync All BDD Specs"
          icon="📦"
          warning="This will read all .spec.json files from /bdd-specs directory and create/update Parameters, AnalysisSpecs, Anchors, and PromptSlugs in the database. Existing specs will be updated with new definitions."
          onConfirm={executeSyncSpecs}
          onCancel={() => setShowModal(null)}
        />
      )}

      {showModal === "create-domains" && (
        <ConfirmationModal
          title={`Create ${selectedPlaybooks.size} Playbook(s)`}
          icon="🎯"
          warning={`This will create ${selectedPlaybooks.size} domain(s) and playbook(s) with all required specs, behavior targets, and dependencies. Existing domains with the same slugs will be deleted first. All created playbooks will be set to PUBLISHED status.`}
          details={
            <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}>
              <strong>Selected playbooks:</strong>
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                {Array.from(selectedPlaybooks).map((id) => {
                  const pb = availablePlaybooks.find((p) => p.id === id);
                  return pb ? (
                    <li key={id}>
                      {pb.name} → {pb.domain.name}
                    </li>
                  ) : null;
                })}
              </ul>
            </div>
          }
          onConfirm={executeCreateDomains}
          onCancel={() => setShowModal(null)}
        />
      )}

      {showModal && OPERATIONS.find((op) => op.id === showModal) && (
        <ConfirmationModal
          title={OPERATIONS.find((op) => op.id === showModal)!.title}
          icon={OPERATIONS.find((op) => op.id === showModal)!.icon}
          warning={
            selectedMode === "replace"
              ? "⚠️ DESTRUCTIVE: This will DELETE all existing Callers and Calls from the database, then import fresh from /transcripts directory. All analysis artifacts, behavior targets, and caller histories will be permanently removed. This cannot be undone."
              : OPERATIONS.find((op) => op.id === showModal)!.warning
          }
          destructive={selectedMode === "replace"}
          onConfirm={() =>
            executeOperation(
              OPERATIONS.find((op) => op.id === showModal)!,
              selectedMode || undefined
            )
          }
          onCancel={() => {
            setShowModal(null);
            setSelectedMode(null);
          }}
        />
      )}
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

function SyncSpecsCard({
  status,
  result,
  syncStatus,
  loadingSyncStatus,
  onExecute,
}: {
  status: OperationStatus;
  result?: OperationResult;
  syncStatus: { totalFiles: number; syncedFiles: number; unsyncedFiles: number } | null;
  loadingSyncStatus: boolean;
  onExecute: () => void;
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
        <div style={{ fontSize: 32, lineHeight: 1 }}>📦</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
              Sync All BDD Specs
            </div>
            {/* Sync Status Pills */}
            {!loadingSyncStatus && syncStatus && (
              <div style={{ display: "flex", gap: 8 }}>
                <span
                  style={{
                    padding: "4px 10px",
                    background: "var(--status-success-bg)",
                    border: "1px solid var(--status-success-border)",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--status-success-text)",
                  }}
                >
                  {syncStatus.syncedFiles} synced
                </span>
                {syncStatus.unsyncedFiles > 0 && (
                  <span
                    style={{
                      padding: "4px 10px",
                      background: "var(--status-warning-bg)",
                      border: "1px solid var(--status-warning-border)",
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--status-warning-text)",
                    }}
                  >
                    {syncStatus.unsyncedFiles} unsynced
                  </span>
                )}
              </div>
            )}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 16 }}>
            Reads all .spec.json files from /bdd-specs directory and creates/updates Parameters, AnalysisSpecs,
            Anchors, and PromptSlugs. Run this first to establish the spec foundation.
          </div>

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
              ⏳ Syncing specs...
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

          <button
            onClick={onExecute}
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
            {isRunning ? "Syncing..." : "Sync All Specs"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateDomainsCard({
  status,
  result,
  availablePlaybooks,
  selectedPlaybooks,
  onTogglePlaybook,
  onExecute,
  loadingPlaybooks,
}: {
  status: OperationStatus;
  result?: OperationResult;
  availablePlaybooks: PlaybookOption[];
  selectedPlaybooks: Set<string>;
  onTogglePlaybook: (id: string) => void;
  onExecute: () => void;
  loadingPlaybooks: boolean;
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
        <div style={{ fontSize: 32, lineHeight: 1 }}>🎯</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
            Create Domains & Playbooks
          </div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 16 }}>
            Select playbooks to create with their domains, behavior targets, and all required specs. Each playbook
            will be created as PUBLISHED and ready to use.
          </div>

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
              ⏳ Creating domains and playbooks...
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

          {/* Playbook Selection */}
          {loadingPlaybooks ? (
            <div style={{ padding: 12, fontSize: 14, color: "var(--text-muted)" }}>
              Loading available playbooks...
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12 }}>
                Select playbooks to create:
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                {availablePlaybooks.map((pb) => (
                  <PlaybookCheckbox
                    key={pb.id}
                    playbook={pb}
                    isSelected={selectedPlaybooks.has(pb.id)}
                    onToggle={() => onTogglePlaybook(pb.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={onExecute}
              disabled={isRunning || selectedPlaybooks.size === 0}
              style={{
                padding: "10px 20px",
                background:
                  isRunning || selectedPlaybooks.size === 0
                    ? "var(--button-disabled-bg)"
                    : "var(--button-primary-bg)",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: isRunning || selectedPlaybooks.size === 0 ? "not-allowed" : "pointer",
                opacity: isRunning || selectedPlaybooks.size === 0 ? 0.6 : 1,
              }}
            >
              {isRunning
                ? "Creating..."
                : selectedPlaybooks.size === 0
                ? "Select Playbooks"
                : `Create ${selectedPlaybooks.size} Playbook(s)`}
            </button>
            {selectedPlaybooks.size > 0 && (
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {selectedPlaybooks.size} playbook(s) selected
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaybookCheckbox({
  playbook,
  isSelected,
  onToggle,
}: {
  playbook: PlaybookOption;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: 12,
        background: isSelected ? "var(--status-info-bg)" : "var(--background)",
        border: `1px solid ${isSelected ? "var(--status-info-border)" : "var(--border-default)"}`,
        borderRadius: 8,
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        style={{
          marginTop: 2,
          width: 16,
          height: 16,
          cursor: "pointer",
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
          {playbook.name}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
          {playbook.description}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          <strong>Domain:</strong> {playbook.domain.name} • <strong>Specs:</strong> ~{playbook.specCount} •{" "}
          <strong>Targets:</strong> {playbook.behaviorTargetCount}
        </div>
      </div>
    </label>
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
        <div style={{ fontSize: 32, lineHeight: 1 }}>{operation.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
            {operation.title}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 16 }}>
            {operation.description}
          </div>

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

function ConfirmationModal({
  title,
  icon,
  warning,
  details,
  destructive,
  onConfirm,
  onCancel,
}: {
  title: string;
  icon: string;
  warning: string;
  details?: React.ReactNode;
  destructive?: boolean;
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
          background: "var(--modal-bg)",
          borderRadius: 16,
          padding: 32,
          maxWidth: 500,
          width: "90%",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 48, textAlign: "center", marginBottom: 16 }}>{icon}</div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 12,
            textAlign: "center",
          }}
        >
          {title}
        </div>
        <div
          style={{
            padding: 16,
            background: destructive ? "var(--status-error-bg)" : "var(--status-warning-bg)",
            border: `1px solid ${destructive ? "var(--status-error-border)" : "var(--status-warning-border)"}`,
            borderRadius: 8,
            fontSize: 14,
            color: destructive ? "var(--status-error-text)" : "var(--status-warning-text)",
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          {warning}
          {details}
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
              background: destructive ? "var(--button-destructive-bg)" : "var(--button-primary-bg)",
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
