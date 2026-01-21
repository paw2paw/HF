"use client";

import { Node } from "reactflow";
import { useState, useEffect, useCallback } from "react";
import type { RagStatus, NodeStats } from "@/lib/flow/status-manifest";
import { SettingsForm } from "./SettingsForm";
import { CompactEqualizer } from "@/components/equalizer/CompactEqualizer";
import { PathSettings } from "./PathSettings";

interface NodeDetailPanelProps {
  node: Node;
  onClose: () => void;
  onRunAgent: (agentId: string, settings?: Record<string, any>) => Promise<any>;
}

type AgentSchema = {
  type?: string;
  properties?: Record<string, any>;
};

interface PrerequisiteCheck {
  prerequisite: {
    type: string;
    table?: string;
    path?: string;
    min: number;
    required: boolean;
    message?: string;
  };
  passed: boolean;
  actual: number;
  message: string;
}

interface PreflightResult {
  ok: boolean;
  canRun: boolean;
  hasWarnings: boolean;
  checks: PrerequisiteCheck[];
  summary: {
    passed: number;
    failed: number;
    warnings: number;
  };
}

const ragColors: Record<RagStatus, { bg: string; text: string; label: string }> = {
  red: { bg: "#fee2e2", text: "#dc2626", label: "Not Ready" },
  amber: { bg: "#fef3c7", text: "#d97706", label: "In Progress" },
  green: { bg: "#d1fae5", text: "#059669", label: "Ready" },
};

export function NodeDetailPanel({ node, onClose, onRunAgent }: NodeDetailPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [agentSchema, setAgentSchema] = useState<AgentSchema | null>(null);
  const [agentDefaults, setAgentDefaults] = useState<Record<string, any>>({});
  const [customSettings, setCustomSettings] = useState<Record<string, any>>({});
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);

  // Preflight state
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [isLoadingPreflight, setIsLoadingPreflight] = useState(false);

  // Path settings state
  const [showPathSettings, setShowPathSettings] = useState(false);

  // Get the agent ID (works for both agent nodes and source nodes with linkedAgentId)
  const agentId = node.data.agentId || node.data.linkedAgentId;

  // Fetch agent schema when showing settings
  const fetchAgentSchema = useCallback(async () => {
    if (!agentId) return;
    setIsLoadingSchema(true);
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      if (data.ok && data.agents) {
        const agent = data.agents.find((a: any) => a.agentId === agentId);
        if (agent?.schema) {
          setAgentSchema(agent.schema);
          setAgentDefaults(agent.settings || {});
          // Initialize custom settings with current values
          setCustomSettings(agent.settings || {});
        }
      }
    } catch (err) {
      console.error("Failed to fetch agent schema:", err);
    } finally {
      setIsLoadingSchema(false);
    }
  }, [agentId]);

  // Fetch schema when settings panel is opened
  useEffect(() => {
    if (showSettings && !agentSchema && agentId) {
      fetchAgentSchema();
    }
  }, [showSettings, agentSchema, agentId, fetchAgentSchema]);

  // Fetch preflight check for agent nodes
  const fetchPreflight = useCallback(async () => {
    if (!agentId) return;
    setIsLoadingPreflight(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/preflight`);
      const data = await res.json();
      if (data.ok) {
        setPreflight(data);
      }
    } catch (err) {
      console.error("Failed to fetch preflight:", err);
    } finally {
      setIsLoadingPreflight(false);
    }
  }, [agentId]);

  // Fetch preflight on mount for agent nodes
  useEffect(() => {
    if ((node.type === "agent" || node.data.linkedAgentId) && agentId) {
      fetchPreflight();
    }
  }, [node.type, node.data.linkedAgentId, agentId, fetchPreflight]);

  const handleRunAgent = async () => {
    if (!agentId) return;
    setIsRunning(true);
    setLastResult(null);
    try {
      // Pass custom settings if they differ from defaults
      const settingsToUse = showSettings ? customSettings : undefined;
      const result = await onRunAgent(agentId, settingsToUse);
      setLastResult(result);
    } finally {
      setIsRunning(false);
    }
  };

  const resetSettings = () => {
    setCustomSettings(agentDefaults);
  };

  const getNodeTypeLabel = () => {
    switch (node.type) {
      case "data":
        // Unified data node - show role-based label
        switch (node.data.role) {
          case "source":
            return "Data Source";
          case "output":
            return "Data Output";
          case "both":
            return "Data (In/Out)";
          default:
            return "Data Node";
        }
      case "agent":
        return "Agent";
      default:
        return "Node";
    }
  };

  const getNodeColor = () => {
    switch (node.type) {
      case "data":
        // Unified data node - color based on role
        switch (node.data.role) {
          case "source":
            return "#3b82f6"; // blue
          case "output":
            return "#14b8a6"; // teal
          case "both":
            return "#8b5cf6"; // purple
          default:
            return "#6b7280";
        }
      case "agent":
        return node.data.isPublished ? "#10b981" : "#8b5cf6";
      default:
        return "#6b7280";
    }
  };

  const stats = node.data.stats as NodeStats | undefined;
  const ragStatus = node.data.ragStatus as RagStatus | undefined;

  return (
    <div
      style={{
        width: 320,
        background: "white",
        borderLeft: "1px solid #e5e7eb",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        color: "#1f2937", // Ensure dark text color throughout panel
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              color: getNodeColor(),
              marginBottom: 4,
            }}
          >
            {getNodeTypeLabel()}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{node.data.label}</div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: 20,
            cursor: "pointer",
            color: "#6b7280",
            padding: 0,
            lineHeight: 1,
          }}
        >
          &times;
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
        {/* Unified Data node details */}
        {node.type === "data" && (
          <div>
            {/* Storage Type and Role badges */}
            <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {node.data.storageType && (
                <span
                  style={{
                    fontSize: 10,
                    padding: "4px 8px",
                    borderRadius: 4,
                    background: node.data.storageType === "table" ? "#dbeafe" : "#e0e7ff",
                    color: node.data.storageType === "table" ? "#1e40af" : "#3730a3",
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  {node.data.storageType}
                </span>
              )}
              {node.data.role && (
                <span
                  style={{
                    fontSize: 10,
                    padding: "4px 8px",
                    borderRadius: 4,
                    background: getNodeColor(),
                    color: "white",
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  {node.data.role === "both" ? "IN/OUT" : node.data.role}
                </span>
              )}
            </div>

            {/* RAG Status Badge */}
            {ragStatus && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>
                  Status
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 6,
                    background: ragColors[ragStatus].bg,
                    color: ragColors[ragStatus].text,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: ragColors[ragStatus].text,
                    }}
                  />
                  {stats?.statusLabel || ragColors[ragStatus].label}
                </div>
              </div>
            )}

            {/* Path (for path-based storage) */}
            {node.data.storageType === "path" && node.data.path && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>
                  Path
                </div>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 12,
                    background: "#f3f4f6",
                    padding: "8px 12px",
                    borderRadius: 4,
                    wordBreak: "break-all",
                  }}
                >
                  {node.data.path}
                </div>
              </div>
            )}

            {/* Table (for table-based storage) */}
            {node.data.storageType === "table" && node.data.table && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>
                  Primary Table
                </div>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 12,
                    background: "#f3f4f6",
                    padding: "8px 12px",
                    borderRadius: 4,
                  }}
                >
                  {node.data.table}
                </div>
              </div>
            )}

            {/* Filesystem Stats */}
            {stats && (stats.directories !== undefined || stats.files !== undefined) && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>
                  Filesystem
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  {stats.directories !== undefined && (
                    <div
                      style={{
                        background: "#f3f4f6",
                        padding: "10px 12px",
                        borderRadius: 6,
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#374151" }}>
                        {stats.directories}
                      </div>
                      <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>Directories</div>
                    </div>
                  )}
                  {stats.files !== undefined && (
                    <div
                      style={{
                        background: "#f3f4f6",
                        padding: "10px 12px",
                        borderRadius: 6,
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#374151" }}>
                        {stats.files}
                      </div>
                      <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>Files</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Processing Progress */}
            {stats && stats.total !== undefined && stats.total > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>
                  Processing
                </div>
                <div
                  style={{
                    background: "#f3f4f6",
                    borderRadius: 6,
                    padding: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: "#374151" }}>
                      {stats.processed || 0} of {stats.total} processed
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
                      {stats.percentComplete}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      background: "#e5e7eb",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${stats.percentComplete || 0}%`,
                        background:
                          (stats.percentComplete || 0) === 100 ? "#10b981" : "#3b82f6",
                        borderRadius: 3,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Derived Items / Related Records */}
            {stats?.derived && stats.derived.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>
                  Related Records
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {stats.derived.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "#f3f4f6",
                        padding: "8px 12px",
                        borderRadius: 6,
                      }}
                    >
                      <span style={{ fontSize: 12, color: "#374151" }}>{item.label}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: item.count > 0 ? "#374151" : "#9ca3af",
                          }}
                        >
                          {item.count}
                        </span>
                        {item.link && (
                          <a
                            href={item.link}
                            style={{
                              fontSize: 11,
                              color: "#2563eb",
                              textDecoration: "none",
                            }}
                          >
                            View →
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last Updated */}
            {stats?.lastUpdated && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>
                  Last Updated
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {new Date(stats.lastUpdated).toLocaleString()}
                </div>
              </div>
            )}

            {/* Run Linked Agent (if data node has one) */}
            {node.data.linkedAgentId && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>
                  Process Data
                </div>

                {/* Settings Toggle */}
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: showSettings ? "#ede9fe" : "#f3f4f6",
                    color: showSettings ? "#7c3aed" : "#374151",
                    border: "1px solid",
                    borderColor: showSettings ? "#c4b5fd" : "#e5e7eb",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>Custom Settings</span>
                  <span>{showSettings ? "▲" : "▼"}</span>
                </button>

                {/* Settings Form */}
                {showSettings && (
                  <div
                    style={{
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      padding: 12,
                      marginBottom: 12,
                    }}
                  >
                    {isLoadingSchema ? (
                      <div style={{ fontSize: 12, color: "#6b7280", textAlign: "center", padding: 12 }}>
                        Loading settings...
                      </div>
                    ) : (
                      <>
                        <SettingsForm
                          schema={agentSchema}
                          values={customSettings}
                          onChange={setCustomSettings}
                          disabled={isRunning}
                        />
                        {Object.keys(agentDefaults).length > 0 && (
                          <button
                            onClick={resetSettings}
                            style={{
                              marginTop: 12,
                              padding: "6px 10px",
                              background: "transparent",
                              color: "#6b7280",
                              border: "1px solid #d1d5db",
                              borderRadius: 4,
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            Reset to defaults
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                <button
                  onClick={() => handleRunAgent()}
                  disabled={isRunning}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    background: isRunning ? "#9ca3af" : "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: isRunning ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {isRunning ? (
                    "Running..."
                  ) : (
                    <>
                      Run {node.data.linkedAgentLabel || node.data.linkedAgentId}
                    </>
                  )}
                </button>

                {/* Last result */}
                {lastResult && (
                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: 4,
                        background: lastResult.ok ? "#d1fae5" : "#fee2e2",
                        color: lastResult.ok ? "#059669" : "#dc2626",
                        fontSize: 12,
                      }}
                    >
                      {lastResult.ok ? "Success" : "Error"}
                      {lastResult.run?.summary && (
                        <div style={{ marginTop: 4, color: "#374151" }}>
                          {lastResult.run.summary}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <a
                  href={`/agents#${node.data.linkedAgentId}`}
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: "#2563eb",
                    textDecoration: "none",
                    marginTop: 12,
                  }}
                >
                  Configure agent settings →
                </a>
              </div>
            )}
          </div>
        )}

        {/* Agent node details */}
        {node.type === "agent" && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>
                Agent ID
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  background: "#f3f4f6",
                  padding: "8px 12px",
                  borderRadius: 4,
                }}
              >
                {node.data.agentId || "—"}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>
                Status
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    padding: "4px 8px",
                    borderRadius: 4,
                    background: node.data.isPublished ? "#d1fae5" : "#ede9fe",
                    color: node.data.isPublished ? "#059669" : "#7c3aed",
                    fontWeight: 600,
                  }}
                >
                  {node.data.isPublished ? "Published" : node.data.hasDraft ? "Draft" : "Not Configured"}
                </span>
                {node.data.version && (
                  <span
                    style={{
                      fontSize: 11,
                      padding: "4px 8px",
                      borderRadius: 4,
                      background: "#f3f4f6",
                      color: "#374151",
                    }}
                  >
                    {node.data.version}
                  </span>
                )}
              </div>
            </div>

            {/* Settings Toggle */}
            <div style={{ marginBottom: 16 }}>
              <button
                onClick={() => setShowSettings(!showSettings)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: showSettings ? "#ede9fe" : "#f3f4f6",
                  color: showSettings ? "#7c3aed" : "#374151",
                  border: "1px solid",
                  borderColor: showSettings ? "#c4b5fd" : "#e5e7eb",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>Custom Settings</span>
                <span>{showSettings ? "▲" : "▼"}</span>
              </button>

              {/* Settings Form */}
              {showSettings && (
                <div
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    padding: 12,
                    marginBottom: 12,
                  }}
                >
                  {isLoadingSchema ? (
                    <div style={{ fontSize: 12, color: "#6b7280", textAlign: "center", padding: 12 }}>
                      Loading settings...
                    </div>
                  ) : (
                    <>
                      <SettingsForm
                        schema={agentSchema}
                        values={customSettings}
                        onChange={setCustomSettings}
                        disabled={isRunning}
                      />
                      {Object.keys(agentDefaults).length > 0 && (
                        <button
                          onClick={resetSettings}
                          style={{
                            marginTop: 12,
                            padding: "6px 10px",
                            background: "transparent",
                            color: "#6b7280",
                            border: "1px solid #d1d5db",
                            borderRadius: 4,
                            fontSize: 11,
                            cursor: "pointer",
                          }}
                        >
                          Reset to defaults
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Path Configuration Toggle */}
              <button
                onClick={() => setShowPathSettings(!showPathSettings)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: showPathSettings ? "#dbeafe" : "#f3f4f6",
                  color: showPathSettings ? "#1d4ed8" : "#374151",
                  border: "1px solid",
                  borderColor: showPathSettings ? "#93c5fd" : "#e5e7eb",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>Path Configuration</span>
                <span>{showPathSettings ? "▲" : "▼"}</span>
              </button>

              {/* Path Settings Panel */}
              {showPathSettings && agentId && (
                <div
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    padding: 12,
                    marginBottom: 12,
                  }}
                >
                  <PathSettings
                    agentId={agentId}
                    onSave={() => {
                      // Refresh preflight after saving path settings
                      fetchPreflight();
                    }}
                  />
                </div>
              )}

              {/* Prerequisites Status */}
              {isLoadingPreflight ? (
                <div
                  style={{
                    padding: "10px 12px",
                    background: "#f3f4f6",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "#6b7280",
                    marginBottom: 12,
                    textAlign: "center",
                  }}
                >
                  Checking prerequisites...
                </div>
              ) : preflight && preflight.checks.length > 0 ? (
                <div
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    background: preflight.canRun
                      ? preflight.hasWarnings
                        ? "#fef3c7"
                        : "#d1fae5"
                      : "#fee2e2",
                    borderRadius: 6,
                    border: `1px solid ${
                      preflight.canRun
                        ? preflight.hasWarnings
                          ? "#fcd34d"
                          : "#86efac"
                        : "#fca5a5"
                    }`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      marginBottom: 8,
                      color: preflight.canRun
                        ? preflight.hasWarnings
                          ? "#92400e"
                          : "#166534"
                        : "#991b1b",
                    }}
                  >
                    {preflight.canRun
                      ? preflight.hasWarnings
                        ? "Ready with Warnings"
                        : "All Prerequisites Met"
                      : "Prerequisites Not Met"}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {preflight.checks.map((check, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          fontSize: 11,
                        }}
                      >
                        <span
                          style={{
                            flexShrink: 0,
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: check.passed
                              ? "#22c55e"
                              : check.prerequisite.required
                              ? "#ef4444"
                              : "#f59e0b",
                            color: "white",
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          {check.passed ? "✓" : check.prerequisite.required ? "✗" : "!"}
                        </span>
                        <span
                          style={{
                            color: check.passed
                              ? "#166534"
                              : check.prerequisite.required
                              ? "#991b1b"
                              : "#92400e",
                          }}
                        >
                          {check.message}
                          {!check.prerequisite.required && !check.passed && (
                            <span style={{ fontStyle: "italic", opacity: 0.8 }}>
                              {" "}(optional)
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  {!preflight.canRun && (
                    <div
                      style={{
                        marginTop: 8,
                        paddingTop: 8,
                        borderTop: "1px solid #fca5a5",
                        fontSize: 11,
                        color: "#991b1b",
                      }}
                    >
                      Complete required prerequisites before running this agent.
                    </div>
                  )}
                </div>
              ) : null}

              {/* Run button */}
              <button
                onClick={handleRunAgent}
                disabled={isRunning || (preflight !== null && !preflight.canRun)}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  background:
                    isRunning || (preflight && !preflight.canRun)
                      ? "#9ca3af"
                      : "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor:
                    isRunning || (preflight && !preflight.canRun)
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {isRunning
                  ? "Running..."
                  : preflight && !preflight.canRun
                  ? "Prerequisites Required"
                  : showSettings
                  ? "Run with Custom Settings"
                  : "Run Agent"}
              </button>
            </div>

            {/* Last result */}
            {lastResult && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>
                  Last Run Result
                </div>
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 4,
                    background: lastResult.ok ? "#d1fae5" : "#fee2e2",
                    color: lastResult.ok ? "#059669" : "#dc2626",
                    fontSize: 12,
                  }}
                >
                  {lastResult.ok ? "Success" : "Error"}
                  {lastResult.run?.summary && (
                    <div style={{ marginTop: 4, color: "#374151" }}>
                      {lastResult.run.summary}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Parameter Equalizer for personality-related agents */}
            {(node.data.agentId?.includes("personality") ||
              node.data.agentId?.includes("analyzer") ||
              node.data.agentId?.includes("scoring")) && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>
                  Parameter Configuration
                </div>
                <CompactEqualizer agentId={node.data.agentId} />
              </div>
            )}

            {/* Links */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
              <a
                href={`/agents#${node.data.agentId}`}
                style={{
                  display: "block",
                  fontSize: 13,
                  color: "#2563eb",
                  textDecoration: "none",
                  marginBottom: 8,
                }}
              >
                Edit Agent Settings →
              </a>
              {(node.data.agentId?.includes("personality") ||
                node.data.agentId?.includes("analyzer")) && (
                <a
                  href="/analyzer-config"
                  style={{
                    display: "block",
                    fontSize: 13,
                    color: "#2563eb",
                    textDecoration: "none",
                    marginBottom: 8,
                  }}
                >
                  Full Analyzer Configurator →
                </a>
              )}
              <a
                href={`/api/agents/${node.data.agentId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  fontSize: 13,
                  color: "#2563eb",
                  textDecoration: "none",
                }}
              >
                View API Response →
              </a>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
