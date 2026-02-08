"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

const mono =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

type AgentConfig = {
  agentId: string;
  enabled: boolean;
  title: string;
  description: string;
  settings: Record<string, any>;
  schema?: any;
};

type ResolvedPayload = {
  env?: Record<string, any>;
  layout?: Record<string, any>;
  kbRoot?: string;
  effectiveAgents?: Array<AgentConfig & { resolvedSettings?: Record<string, any> }>;
};

type PathOverride = {
  sourceDir?: string;
  outputDir?: string;
};

function PathRow({
  label,
  value,
  isOverridden,
  onEdit,
  editing,
  editValue,
  onEditChange,
  onEditSave,
  onEditCancel,
}: {
  label: string;
  value: string;
  isOverridden?: boolean;
  onEdit?: () => void;
  editing?: boolean;
  editValue?: string;
  onEditChange?: (v: string) => void;
  onEditSave?: () => void;
  onEditCancel?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 0",
        borderBottom: "1px solid #f3f4f6",
      }}
    >
      <div
        style={{
          width: 80,
          fontSize: 10,
          fontWeight: 600,
          color: "#6b7280",
          flexShrink: 0,
        }}
      >
        {label}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <div style={{ display: "flex", gap: 4 }}>
            <input
              type="text"
              value={editValue || ""}
              onChange={(e) => onEditChange?.(e.target.value)}
              style={{
                flex: 1,
                fontSize: 10,
                fontFamily: mono,
                padding: "4px 6px",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                outline: "none",
              }}
              autoFocus
            />
            <button
              onClick={onEditSave}
              style={{
                fontSize: 10,
                padding: "2px 8px",
                background: "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Save
            </button>
            <button
              onClick={onEditCancel}
              style={{
                fontSize: 10,
                padding: "2px 8px",
                background: "#f3f4f6",
                color: "#374151",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: 10,
                fontFamily: mono,
                color: isOverridden ? "#2563eb" : "#374151",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={value}
            >
              {value || "—"}
            </span>
            {isOverridden && (
              <span
                style={{
                  fontSize: 9,
                  padding: "1px 4px",
                  background: "#dbeafe",
                  color: "#2563eb",
                  borderRadius: 3,
                }}
              >
                override
              </span>
            )}
            {onEdit && (
              <button
                onClick={onEdit}
                style={{
                  fontSize: 9,
                  padding: "1px 6px",
                  background: "#f9fafb",
                  color: "#6b7280",
                  border: "1px solid #e5e7eb",
                  borderRadius: 3,
                  cursor: "pointer",
                  marginLeft: "auto",
                }}
              >
                Edit
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentPathsRow({
  agent,
  kbRoot,
  overrides,
  onOverrideChange,
}: {
  agent: AgentConfig & { resolvedSettings?: Record<string, any> };
  kbRoot: string;
  overrides: PathOverride;
  onOverrideChange: (patch: PathOverride) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingSource, setEditingSource] = useState(false);
  const [editingOutput, setEditingOutput] = useState(false);
  const [editSourceValue, setEditSourceValue] = useState("");
  const [editOutputValue, setEditOutputValue] = useState("");

  // Get paths from settings/schema
  const resolvedSettings = agent.resolvedSettings || {};
  const settings = agent.settings || {};
  const schema = agent.schema?.properties || {};

  // Get source/output dirs - check resolved first, then settings, then schema defaults
  const defaultSourceDir =
    settings.sourceDir ||
    schema.sourceDir?.default ||
    "";
  const defaultOutputDir =
    settings.outputDir ||
    schema.outputDir?.default ||
    "";

  // Effective values (override or default)
  const effectiveSourceDir = overrides.sourceDir ?? defaultSourceDir;
  const effectiveOutputDir = overrides.outputDir ?? defaultOutputDir;

  // Resolved paths (full paths from server)
  const resolvedSourceDir =
    resolvedSettings.sourceDirResolved ||
    (effectiveSourceDir && kbRoot
      ? `${kbRoot}/${effectiveSourceDir}`.replace(/\/+/g, "/")
      : effectiveSourceDir);
  const resolvedOutputDir =
    resolvedSettings.outputDirResolved ||
    (effectiveOutputDir && kbRoot
      ? `${kbRoot}/${effectiveOutputDir}`.replace(/\/+/g, "/")
      : effectiveOutputDir);

  const hasSourceDir = !!schema.sourceDir || !!defaultSourceDir;
  const hasOutputDir = !!schema.outputDir || !!defaultOutputDir;

  if (!hasSourceDir && !hasOutputDir) {
    return null; // Skip agents without path settings
  }

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        marginBottom: 8,
        background: agent.enabled ? "#fff" : "#f9fafb",
        opacity: agent.enabled ? 1 : 0.7,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          cursor: "pointer",
          borderBottom: expanded ? "1px solid #e5e7eb" : "none",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: agent.enabled ? "#10b981" : "#9ca3af",
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
            {agent.title}
          </span>
          <span style={{ fontSize: 10, color: "#9ca3af", fontFamily: mono }}>
            {agent.agentId}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {(overrides.sourceDir || overrides.outputDir) && (
            <span
              style={{
                fontSize: 9,
                padding: "2px 6px",
                background: "#dbeafe",
                color: "#2563eb",
                borderRadius: 4,
              }}
            >
              Overrides
            </span>
          )}
          <span style={{ fontSize: 11, color: "#9ca3af" }}>
            {expanded ? "▼" : "▶"}
          </span>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: "8px 12px" }}>
          {hasSourceDir && (
            <PathRow
              label="Source"
              value={resolvedSourceDir || effectiveSourceDir}
              isOverridden={!!overrides.sourceDir}
              onEdit={() => {
                setEditSourceValue(overrides.sourceDir || defaultSourceDir);
                setEditingSource(true);
              }}
              editing={editingSource}
              editValue={editSourceValue}
              onEditChange={setEditSourceValue}
              onEditSave={() => {
                onOverrideChange({
                  ...overrides,
                  sourceDir: editSourceValue || undefined,
                });
                setEditingSource(false);
              }}
              onEditCancel={() => setEditingSource(false)}
            />
          )}
          {hasOutputDir && (
            <PathRow
              label="Output"
              value={resolvedOutputDir || effectiveOutputDir}
              isOverridden={!!overrides.outputDir}
              onEdit={() => {
                setEditOutputValue(overrides.outputDir || defaultOutputDir);
                setEditingOutput(true);
              }}
              editing={editingOutput}
              editValue={editOutputValue}
              onEditChange={setEditOutputValue}
              onEditSave={() => {
                onOverrideChange({
                  ...overrides,
                  outputDir: editOutputValue || undefined,
                });
                setEditingOutput(false);
              }}
              onEditCancel={() => setEditingOutput(false)}
            />
          )}
          {/* Show schema defaults */}
          <div
            style={{
              marginTop: 8,
              fontSize: 9,
              color: "#9ca3af",
              display: "flex",
              gap: 12,
            }}
          >
            {schema.sourceDir?.default && (
              <span>
                Default source: <code>{schema.sourceDir.default}</code>
              </span>
            )}
            {schema.outputDir?.default && (
              <span>
                Default output: <code>{schema.outputDir.default}</code>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentPathsCard() {
  const [agents, setAgents] = useState<
    Array<AgentConfig & { resolvedSettings?: Record<string, any> }>
  >([]);
  const [resolved, setResolved] = useState<ResolvedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pathOverrides, setPathOverrides] = useState<
    Record<string, PathOverride>
  >({});
  const [hasChanges, setHasChanges] = useState(false);

  const kbRoot = useMemo(
    () => resolved?.kbRoot || resolved?.layout?.root || "",
    [resolved]
  );

  const status = useMemo(() => {
    if (error) return { color: "#ef4444", text: "Error" };
    if (loading) return { color: "#9ca3af", text: "Loading" };
    if (hasChanges) return { color: "#f59e0b", text: "Unsaved" };
    return { color: "#10b981", text: "Synced" };
  }, [error, loading, hasChanges]);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/agents");
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "Failed to load agents");
      }

      // Use effective agents if available (includes resolved settings)
      const effectiveAgents = data.resolved?.effectiveAgents || data.agents || [];
      setAgents(effectiveAgents);
      setResolved(data.resolved || null);

      // Initialize overrides from current settings
      const initialOverrides: Record<string, PathOverride> = {};
      for (const agent of effectiveAgents) {
        const settings = agent.settings || {};
        const schema = agent.schema?.properties || {};
        const defaultSourceDir = schema.sourceDir?.default || "";
        const defaultOutputDir = schema.outputDir?.default || "";

        // Only set override if it differs from default
        if (settings.sourceDir && settings.sourceDir !== defaultSourceDir) {
          initialOverrides[agent.agentId] = {
            ...initialOverrides[agent.agentId],
            sourceDir: settings.sourceDir,
          };
        }
        if (settings.outputDir && settings.outputDir !== defaultOutputDir) {
          initialOverrides[agent.agentId] = {
            ...initialOverrides[agent.agentId],
            outputDir: settings.outputDir,
          };
        }
      }
      setPathOverrides(initialOverrides);
      setHasChanges(false);
    } catch (e: any) {
      setError(e?.message || "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleOverrideChange = useCallback(
    (agentId: string, patch: PathOverride) => {
      setPathOverrides((prev) => ({
        ...prev,
        [agentId]: patch,
      }));
      setHasChanges(true);
    },
    []
  );

  const saveOverrides = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      // Build agents payload with updated settings
      const updatedAgents = agents.map((agent) => {
        const override = pathOverrides[agent.agentId] || {};
        return {
          ...agent,
          settings: {
            ...agent.settings,
            ...(override.sourceDir !== undefined
              ? { sourceDir: override.sourceDir }
              : {}),
            ...(override.outputDir !== undefined
              ? { outputDir: override.outputDir }
              : {}),
          },
        };
      });

      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agents: updatedAgents }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "Failed to save");
      }

      setHasChanges(false);
      await loadAgents(); // Reload to get updated resolved paths
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [agents, pathOverrides, loadAgents]);

  // Filter to agents that have path settings
  const agentsWithPaths = useMemo(() => {
    return agents.filter((agent) => {
      const schema = agent.schema?.properties || {};
      const settings = agent.settings || {};
      return schema.sourceDir || schema.outputDir || settings.sourceDir || settings.outputDir;
    });
  }, [agents]);

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 20,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: status.color,
            }}
          />
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            Agent Paths
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 4,
              background:
                status.color === "#10b981"
                  ? "#ecfdf5"
                  : status.color === "#ef4444"
                  ? "#fef2f2"
                  : status.color === "#f59e0b"
                  ? "#fffbeb"
                  : "#f9fafb",
              color: status.color,
            }}
          >
            {status.text}
          </span>
          {hasChanges && (
            <button
              onClick={saveOverrides}
              disabled={saving}
              style={{
                fontSize: 11,
                padding: "4px 12px",
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      </div>

      {/* KB Root Info */}
      <div
        style={{
          marginBottom: 12,
          padding: "8px 12px",
          background: "#f9fafb",
          borderRadius: 6,
          fontSize: 11,
        }}
      >
        <span style={{ color: "#6b7280", fontWeight: 600 }}>KB Root:</span>{" "}
        <code
          style={{ fontFamily: mono, color: "#374151" }}
          title={kbRoot}
        >
          {kbRoot || "$HF_KB_PATH"}
        </code>
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            fontSize: 11,
            color: "#ef4444",
            marginBottom: 12,
            padding: 8,
            background: "#fef2f2",
            borderRadius: 4,
          }}
        >
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>
          Loading agents...
        </div>
      ) : agentsWithPaths.length === 0 ? (
        <div
          style={{
            padding: 20,
            textAlign: "center",
            color: "#6b7280",
            background: "#f9fafb",
            borderRadius: 8,
          }}
        >
          No agents with path settings found.
        </div>
      ) : (
        <div>
          {agentsWithPaths.map((agent) => (
            <AgentPathsRow
              key={agent.agentId}
              agent={agent}
              kbRoot={kbRoot}
              overrides={pathOverrides[agent.agentId] || {}}
              onOverrideChange={(patch) =>
                handleOverrideChange(agent.agentId, patch)
              }
            />
          ))}
        </div>
      )}

      {/* Footer note */}
      <div style={{ marginTop: 12, fontSize: 10, color: "#9ca3af" }}>
        Paths are relative to KB Root. Edit to override defaults for runtime.
        View <a href="/agents" style={{ color: "#2563eb" }}>Agents</a> for full configuration.
      </div>
    </section>
  );
}
