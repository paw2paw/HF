"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";

// ── Types ──────────────────────────────────────────────

type ParameterStatus = "INHERITED" | "OVERRIDDEN" | "NEW";

interface LayerParameter {
  id: string;
  name: string;
  section: string;
  status: ParameterStatus;
  config: Record<string, any>;
  baseConfig?: Record<string, any>;
}

interface LayerConstraint {
  id: string;
  rule: string;
  source: "BASE" | "OVERLAY";
}

interface LayerDiffResult {
  base: { slug: string; name: string; description: string | null; parameterCount: number; constraintCount: number };
  overlay: { slug: string; name: string; description: string | null; extendsAgent: string; parameterCount: number; constraintCount: number };
  parameters: LayerParameter[];
  constraints: LayerConstraint[];
  stats: { inherited: number; overridden: number; new: number; totalMerged: number; baseConstraints: number; overlayConstraints: number };
}

interface OverlayOption {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  extendsAgent: string;
}

interface BaseGroup {
  extendsAgent: string;
  slug: string;
  name: string;
  baseId: string | null;
  overlays: OverlayOption[];
}

// ── Badge Colors ───────────────────────────────────────

const STATUS_COLORS: Record<ParameterStatus, { bg: string; text: string; label: string }> = {
  INHERITED: { bg: "#dcfce7", text: "#14532d", label: "Inherited" },
  OVERRIDDEN: { bg: "#fef3c7", text: "#78350f", label: "Overridden" },
  NEW: { bg: "#dbeafe", text: "#1e3a8a", label: "New" },
};

const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  BASE: { bg: "#e5e7eb", text: "#374151" },
  OVERLAY: { bg: "#e0e7ff", text: "#4338ca" },
};

// ── Status Badge ───────────────────────────────────────

function StatusBadge({ status }: { status: ParameterStatus }) {
  const colors = STATUS_COLORS[status];
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 4,
        background: colors.bg,
        color: colors.text,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}
    >
      {colors.label}
    </span>
  );
}

function SourceBadge({ source }: { source: "BASE" | "OVERLAY" }) {
  const colors = SOURCE_COLORS[source];
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 600,
        padding: "1px 6px",
        borderRadius: 3,
        background: colors.bg,
        color: colors.text,
        textTransform: "uppercase",
      }}
    >
      {source}
    </span>
  );
}

// ── Config Value Renderer ──────────────────────────────

function ConfigValue({ value, dimmed }: { value: any; dimmed?: boolean }) {
  const style: React.CSSProperties = {
    fontSize: 11,
    fontFamily: "monospace",
    color: dimmed ? "var(--text-muted)" : "var(--text-primary)",
    textDecoration: dimmed ? "line-through" : "none",
    opacity: dimmed ? 0.6 : 1,
  };

  if (value === null || value === undefined) {
    return <span style={{ ...style, fontStyle: "italic" }}>null</span>;
  }

  if (typeof value === "string") {
    return (
      <span style={style}>
        {value.length > 120 ? `${value.slice(0, 120)}...` : value}
      </span>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ ...style, fontStyle: "italic" }}>[] (empty)</span>;
    if (value.length <= 5 && value.every((v) => typeof v === "string")) {
      return <span style={style}>[{value.join(", ")}]</span>;
    }
    return <span style={style}>[{value.length} items]</span>;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length <= 3) {
      return (
        <span style={style}>
          {"{"}
          {keys.map((k, i) => (
            <React.Fragment key={k}>
              {i > 0 && ", "}
              <span style={{ color: "var(--text-muted)" }}>{k}</span>: {JSON.stringify(value[k]).slice(0, 40)}
            </React.Fragment>
          ))}
          {"}"}
        </span>
      );
    }
    return <span style={style}>{`{${keys.length} keys}`}</span>;
  }

  return <span style={style}>{String(value)}</span>;
}

// ── Parameter Card ─────────────────────────────────────

function ParameterCard({
  param,
  expanded,
  onToggle,
}: {
  param: LayerParameter;
  expanded: boolean;
  onToggle: () => void;
}) {
  const borderColors: Record<ParameterStatus, string> = {
    INHERITED: "var(--border-default)",
    OVERRIDDEN: "#f59e0b",
    NEW: "#3b82f6",
  };

  return (
    <div
      style={{
        marginBottom: 8,
        border: `1px solid ${borderColors[param.status]}`,
        borderRadius: 8,
        overflow: "hidden",
        borderLeft: `3px solid ${borderColors[param.status]}`,
        background: param.status === "INHERITED"
          ? "var(--surface-secondary)"
          : "var(--surface-primary)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
          {expanded ? "\u25BC" : "\u25B6"}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          {param.name}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            fontFamily: "monospace",
          }}
        >
          {param.section}
        </span>
        <StatusBadge status={param.status} />
      </button>

      {expanded && (
        <div style={{ padding: "0 14px 12px" }}>
          {param.status === "OVERRIDDEN" && param.baseConfig && (
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  marginBottom: 4,
                  textTransform: "uppercase",
                }}
              >
                Base (replaced)
              </div>
              <div
                style={{
                  padding: 8,
                  borderRadius: 6,
                  background: "color-mix(in srgb, var(--surface-secondary) 80%, transparent)",
                  border: "1px dashed var(--border-default)",
                }}
              >
                {Object.entries(param.baseConfig).map(([key, val]) => (
                  <div key={key} style={{ marginBottom: 3, display: "flex", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 100, fontWeight: 500 }}>
                      {key}:
                    </span>
                    <ConfigValue value={val} dimmed />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            {param.status === "OVERRIDDEN" && (
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#f59e0b",
                  marginBottom: 4,
                  textTransform: "uppercase",
                }}
              >
                Overlay (active)
              </div>
            )}
            <div
              style={{
                padding: 8,
                borderRadius: 6,
                background: "var(--surface-secondary)",
              }}
            >
              {Object.keys(param.config).length === 0 ? (
                <span style={{ fontSize: 11, fontStyle: "italic", color: "var(--text-muted)" }}>
                  No config values
                </span>
              ) : (
                Object.entries(param.config).map(([key, val]) => (
                  <div key={key} style={{ marginBottom: 3, display: "flex", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--text-secondary)", minWidth: 100, fontWeight: 500 }}>
                      {key}:
                    </span>
                    <ConfigValue value={val} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Layer Stack Visualization ──────────────────────────

function LayerStack({
  base,
  overlay,
}: {
  base: { name: string; slug: string } | null;
  overlay: { name: string; slug: string } | null;
}) {
  if (!base && !overlay) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "var(--text-muted)",
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Layer Stack
      </div>

      {/* Overlay (top) */}
      {overlay && (
        <div
          style={{
            padding: "10px 12px",
            marginBottom: -1,
            borderRadius: "8px 8px 0 0",
            border: "1px solid #818cf8",
            background: "color-mix(in srgb, var(--surface-primary) 85%, transparent)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: "#6366f1", textTransform: "uppercase" }}>
            Overlay
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginTop: 2 }}>
            {overlay.name}
          </div>
          <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)" }}>
            {overlay.slug}
          </div>
        </div>
      )}

      {/* Base (bottom) */}
      {base && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: overlay ? "0 0 8px 8px" : "8px",
            border: "1px solid var(--border-default)",
            background: "var(--surface-secondary)",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Base Archetype
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginTop: 2 }}>
            {base.name}
          </div>
          <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)" }}>
            {base.slug}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stats Panel ────────────────────────────────────────

function StatsPanel({ stats }: { stats: LayerDiffResult["stats"] }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "var(--text-muted)",
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Parameter Breakdown
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <StatRow label="Inherited" count={stats.inherited} colors={STATUS_COLORS.INHERITED} />
        <StatRow label="Overridden" count={stats.overridden} colors={STATUS_COLORS.OVERRIDDEN} />
        <StatRow label="New" count={stats.new} colors={STATUS_COLORS.NEW} />
      </div>

      <div
        style={{
          marginTop: 8,
          paddingTop: 8,
          borderTop: "1px solid var(--border-default)",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--text-secondary)",
        }}
      >
        <span>Total merged</span>
        <span style={{ fontWeight: 600, fontFamily: "monospace" }}>{stats.totalMerged}</span>
      </div>

      {(stats.baseConstraints > 0 || stats.overlayConstraints > 0) && (
        <div
          style={{
            marginTop: 12,
            fontSize: 10,
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Constraints
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)", fontWeight: 400 }}>
              <span>Base</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{stats.baseConstraints}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)", fontWeight: 400 }}>
              <span>Overlay</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{stats.overlayConstraints}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, count, colors }: { label: string; count: number; colors: { bg: string; text: string } }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 10px",
        borderRadius: 6,
        background: colors.bg,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 500, color: colors.text }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: colors.text }}>{count}</span>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────

export default function LayersPage() {
  const searchParams = useSearchParams();
  const urlOverlayId = searchParams.get("overlayId");

  const [bases, setBases] = useState<BaseGroup[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string>(urlOverlayId || "");
  const [diff, setDiff] = useState<LayerDiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [specsLoading, setSpecsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedParams, setExpandedParams] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<ParameterStatus | "ALL">("ALL");

  // Fetch overlay specs on mount
  useEffect(() => {
    setSpecsLoading(true);
    fetch("/api/layers/specs")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setBases(data.bases || []);
          // If no URL param, auto-select first overlay
          if (!urlOverlayId) {
            const firstOverlay = data.bases?.[0]?.overlays?.[0];
            if (firstOverlay) setSelectedOverlayId(firstOverlay.id);
          }
        }
      })
      .catch(() => setError("Failed to load specs"))
      .finally(() => setSpecsLoading(false));
  }, []);

  // Fetch diff when overlay changes
  useEffect(() => {
    if (!selectedOverlayId) {
      setDiff(null);
      return;
    }

    setLoading(true);
    setError(null);
    fetch(`/api/layers/diff?overlayId=${selectedOverlayId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setDiff(data.diff);
          setExpandedParams(new Set());
        } else {
          setError(data.error || "Failed to load diff");
          setDiff(null);
        }
      })
      .catch(() => setError("Failed to load diff"))
      .finally(() => setLoading(false));
  }, [selectedOverlayId]);

  // All overlays flat for the selector
  const allOverlays = useMemo(() => {
    return bases.flatMap((b) =>
      b.overlays.map((o) => ({ ...o, baseName: b.name })),
    );
  }, [bases]);

  // Filtered parameters
  const filteredParams = useMemo(() => {
    if (!diff) return [];
    if (filterStatus === "ALL") return diff.parameters;
    return diff.parameters.filter((p) => p.status === filterStatus);
  }, [diff, filterStatus]);

  const toggleParam = useCallback((id: string) => {
    setExpandedParams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (diff) setExpandedParams(new Set(diff.parameters.map((p) => p.id)));
  }, [diff]);

  const collapseAll = useCallback(() => {
    setExpandedParams(new Set());
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <AdvancedBanner />
      {/* Header */}
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border-default)",
          background: "var(--surface-primary)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          Identity Layers
        </h1>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            padding: "2px 8px",
            borderRadius: 4,
            background: "var(--surface-secondary)",
          }}
        >
          Base + Overlay Visualization
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left Panel */}
        <div
          style={{
            width: 300,
            minWidth: 300,
            borderRight: "1px solid var(--border-default)",
            background: "var(--surface-primary)",
            overflow: "auto",
            padding: 16,
          }}
        >
          {/* Overlay Selector */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "block",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--text-muted)",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Select Overlay Spec
            </label>
            <select
              value={selectedOverlayId}
              onChange={(e) => setSelectedOverlayId(e.target.value)}
              disabled={specsLoading}
              style={{
                width: "100%",
                padding: "8px 10px",
                fontSize: 12,
                borderRadius: 6,
                border: "1px solid var(--border-default)",
                background: "var(--surface-primary)",
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              {specsLoading ? (
                <option>Loading specs...</option>
              ) : allOverlays.length === 0 ? (
                <option value="">No overlay specs found</option>
              ) : (
                <>
                  <option value="">Choose an overlay...</option>
                  {bases.map((base) => (
                    <optgroup key={base.extendsAgent} label={`Extends: ${base.name}`}>
                      {base.overlays.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Layer Stack + Stats */}
          {diff && (
            <>
              <LayerStack
                base={{ name: diff.base.name, slug: diff.base.slug }}
                overlay={{ name: diff.overlay.name, slug: diff.overlay.slug }}
              />
              <StatsPanel stats={diff.stats} />
            </>
          )}

          {!diff && !loading && !error && (
            <div
              style={{
                marginTop: 40,
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: 12,
              }}
            >
              Select an overlay spec to see the layer diff.
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            background: "var(--surface-secondary)",
            padding: 20,
          }}
        >
          {loading && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: 200,
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              Computing layer diff...
            </div>
          )}

          {error && (
            <div
              style={{
                padding: 16,
                borderRadius: 8,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          {diff && !loading && (
            <>
              {/* Filter + controls bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", gap: 4 }}>
                  {(["ALL", "INHERITED", "OVERRIDDEN", "NEW"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setFilterStatus(status)}
                      style={{
                        padding: "4px 10px",
                        fontSize: 11,
                        fontWeight: filterStatus === status ? 600 : 400,
                        borderRadius: 4,
                        border: `1px solid ${filterStatus === status ? "var(--text-secondary)" : "var(--border-default)"}`,
                        background: filterStatus === status ? "var(--surface-primary)" : "transparent",
                        color: filterStatus === status ? "var(--text-primary)" : "var(--text-muted)",
                        cursor: "pointer",
                      }}
                    >
                      {status === "ALL" ? `All (${diff.parameters.length})` : `${status_COLORS_LABEL[status]} (${diff.parameters.filter((p) => p.status === status).length})`}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={expandAll}
                    style={controlButtonStyle}
                  >
                    Expand All
                  </button>
                  <button
                    type="button"
                    onClick={collapseAll}
                    style={controlButtonStyle}
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              {/* Parameters */}
              <div style={{ marginBottom: 24 }}>
                <h2
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Parameters ({filteredParams.length})
                </h2>
                {filteredParams.length === 0 ? (
                  <div
                    style={{
                      padding: 20,
                      textAlign: "center",
                      color: "var(--text-muted)",
                      fontSize: 12,
                      background: "var(--surface-primary)",
                      borderRadius: 8,
                    }}
                  >
                    No parameters match the current filter.
                  </div>
                ) : (
                  filteredParams.map((param) => (
                    <ParameterCard
                      key={param.id}
                      param={param}
                      expanded={expandedParams.has(param.id)}
                      onToggle={() => toggleParam(param.id)}
                    />
                  ))
                )}
              </div>

              {/* Constraints */}
              {diff.constraints.length > 0 && (
                <div>
                  <h2
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginBottom: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Constraints (stacked: {diff.constraints.length})
                  </h2>
                  {diff.constraints.map((constraint, i) => (
                    <div
                      key={constraint.id + i}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        marginBottom: 6,
                        padding: "8px 12px",
                        borderRadius: 6,
                        background: "var(--surface-primary)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      <SourceBadge source={constraint.source} />
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--text-primary)",
                          flex: 1,
                        }}
                      >
                        {constraint.rule}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!diff && !loading && !error && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--text-muted)",
                gap: 8,
              }}
            >
              <div style={{ fontSize: 40, opacity: 0.3 }}>&#x1F5C3;</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Select an overlay to visualize layers</div>
              <div style={{ fontSize: 12 }}>
                Choose a domain overlay from the left panel to see how it extends its base archetype.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────

const controlButtonStyle: React.CSSProperties = {
  padding: "4px 10px",
  fontSize: 11,
  borderRadius: 4,
  border: "1px solid var(--border-default)",
  background: "var(--surface-primary)",
  color: "var(--text-secondary)",
  cursor: "pointer",
};

const status_COLORS_LABEL: Record<ParameterStatus, string> = {
  INHERITED: "Inherited",
  OVERRIDDEN: "Overridden",
  NEW: "New",
};
