"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";
import "./layers.css";

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
  INHERITED: { bg: "var(--status-success-bg)", text: "var(--status-success-text)", label: "Inherited" },
  OVERRIDDEN: { bg: "var(--status-warning-bg)", text: "var(--status-warning-text)", label: "Overridden" },
  NEW: { bg: "var(--status-info-bg)", text: "var(--status-info-text)", label: "New" },
};

const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  BASE: { bg: "var(--status-neutral-bg)", text: "var(--status-neutral-text)" },
  OVERLAY: { bg: "var(--status-info-bg)", text: "var(--status-info-text)" },
};

// ── Status Badge ───────────────────────────────────────

function StatusBadge({ status }: { status: ParameterStatus }) {
  const colors = STATUS_COLORS[status];
  return (
    <span
      className="ly-status-badge"
      style={{ background: colors.bg, color: colors.text }}
    >
      {colors.label}
    </span>
  );
}

function SourceBadge({ source }: { source: "BASE" | "OVERLAY" }) {
  const colors = SOURCE_COLORS[source];
  return (
    <span
      className="ly-source-badge"
      style={{ background: colors.bg, color: colors.text }}
    >
      {source}
    </span>
  );
}

// ── Config Value Renderer ──────────────────────────────

function ConfigValue({ value, dimmed }: { value: any; dimmed?: boolean }) {
  const cls = `ly-config-value${dimmed ? " ly-config-value--dimmed" : ""}`;

  if (value === null || value === undefined) {
    return <span className={`${cls} ly-config-value--null`}>null</span>;
  }

  if (typeof value === "string") {
    return (
      <span className={cls}>
        {value.length > 120 ? `${value.slice(0, 120)}...` : value}
      </span>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className={`${cls} ly-config-value--null`}>[] (empty)</span>;
    if (value.length <= 5 && value.every((v) => typeof v === "string")) {
      return <span className={cls}>[{value.join(", ")}]</span>;
    }
    return <span className={cls}>[{value.length} items]</span>;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length <= 3) {
      return (
        <span className={cls}>
          {"{"}
          {keys.map((k, i) => (
            <React.Fragment key={k}>
              {i > 0 && ", "}
              <span className="ly-config-key">{k}</span>: {JSON.stringify(value[k]).slice(0, 40)}
            </React.Fragment>
          ))}
          {"}"}
        </span>
      );
    }
    return <span className={cls}>{`{${keys.length} keys}`}</span>;
  }

  return <span className={cls}>{String(value)}</span>;
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
    OVERRIDDEN: "var(--status-warning-text)",
    NEW: "var(--status-info-text)",
  };

  const statusClass = param.status === "INHERITED" ? "ly-param-card--inherited" : param.status === "OVERRIDDEN" ? "ly-param-card--overridden" : "ly-param-card--new";

  return (
    <div
      className={`ly-param-card ${statusClass}`}
      style={{
        border: `1px solid ${borderColors[param.status]}`,
        borderLeft: `3px solid ${borderColors[param.status]}`,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="ly-param-toggle"
      >
        <span className="ly-param-arrow">
          {expanded ? "\u25BC" : "\u25B6"}
        </span>
        <span className="ly-param-name">
          {param.name}
        </span>
        <span className="ly-param-section">
          {param.section}
        </span>
        <StatusBadge status={param.status} />
      </button>

      {expanded && (
        <div className="ly-param-body">
          {param.status === "OVERRIDDEN" && param.baseConfig && (
            <div className="ly-base-replaced">
              <div className="ly-config-label">
                Base (replaced)
              </div>
              <div className="ly-config-box--dashed">
                {Object.entries(param.baseConfig).map(([key, val]) => (
                  <div key={key} className="ly-config-entry">
                    <span className="ly-config-entry-key--muted">
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
              <div className="ly-config-label ly-config-label--warning">
                Overlay (active)
              </div>
            )}
            <div className="ly-config-box">
              {Object.keys(param.config).length === 0 ? (
                <span className="ly-config-empty">
                  No config values
                </span>
              ) : (
                Object.entries(param.config).map(([key, val]) => (
                  <div key={key} className="ly-config-entry">
                    <span className="ly-config-entry-key">
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
    <div className="ly-stack">
      <div className="ly-stack-label">
        Layer Stack
      </div>

      {/* Overlay (top) */}
      {overlay && (
        <div className="ly-stack-overlay">
          <div className="ly-stack-overlay-label">
            Overlay
          </div>
          <div className="ly-stack-name">
            {overlay.name}
          </div>
          <div className="ly-stack-slug">
            {overlay.slug}
          </div>
        </div>
      )}

      {/* Base (bottom) */}
      {base && (
        <div className={`ly-stack-base ${overlay ? "ly-stack-base--paired" : "ly-stack-base--solo"}`}>
          <div className="ly-stack-base-label">
            Base Archetype
          </div>
          <div className="ly-stack-name">
            {base.name}
          </div>
          <div className="ly-stack-slug">
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
    <div className="ly-stats">
      <div className="ly-stats-label">
        Parameter Breakdown
      </div>

      <div className="ly-stats-rows">
        <StatRow label="Inherited" count={stats.inherited} colors={STATUS_COLORS.INHERITED} />
        <StatRow label="Overridden" count={stats.overridden} colors={STATUS_COLORS.OVERRIDDEN} />
        <StatRow label="New" count={stats.new} colors={STATUS_COLORS.NEW} />
      </div>

      <div className="ly-stats-total">
        <span>Total merged</span>
        <span className="ly-stats-total-count">{stats.totalMerged}</span>
      </div>

      {(stats.baseConstraints > 0 || stats.overlayConstraints > 0) && (
        <div className="ly-stats-constraints">
          Constraints
          <div className="ly-stats-constraints-rows">
            <div className="ly-stats-constraint-row">
              <span>Base</span>
              <span className="ly-stats-constraint-count">{stats.baseConstraints}</span>
            </div>
            <div className="ly-stats-constraint-row">
              <span>Overlay</span>
              <span className="ly-stats-constraint-count">{stats.overlayConstraints}</span>
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
      className="ly-stat-row"
      style={{ background: colors.bg }}
    >
      <span className="ly-stat-label" style={{ color: colors.text }}>{label}</span>
      <span className="ly-stat-count" style={{ color: colors.text }}>{count}</span>
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
    <div className="ly-layout">
      <AdvancedBanner />
      {/* Header */}
      <div className="ly-header">
        <h1 className="ly-header-title">
          Identity Layers
        </h1>
        <span className="ly-header-badge">
          Base + Overlay Visualization
        </span>
      </div>

      {/* Body */}
      <div className="ly-body">
        {/* Left Panel */}
        <div className="ly-sidebar">
          {/* Overlay Selector */}
          <div className="ly-select-group">
            <label className="ly-select-label">
              Select Overlay Spec
            </label>
            <select
              value={selectedOverlayId}
              onChange={(e) => setSelectedOverlayId(e.target.value)}
              disabled={specsLoading}
              className="ly-select"
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
            <div className="ly-empty-sidebar">
              Select an overlay spec to see the layer diff.
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="ly-main">
          {loading && (
            <div className="ly-loading">
              Computing layer diff...
            </div>
          )}

          {error && (
            <div className="ly-error">
              {error}
            </div>
          )}

          {diff && !loading && (
            <>
              {/* Filter + controls bar */}
              <div className="ly-filter-bar">
                <div className="ly-filter-group">
                  {(["ALL", "INHERITED", "OVERRIDDEN", "NEW"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setFilterStatus(status)}
                      className={`ly-filter-btn${filterStatus === status ? " ly-filter-btn--active" : ""}`}
                    >
                      {status === "ALL" ? `All (${diff.parameters.length})` : `${STATUS_LABELS[status]} (${diff.parameters.filter((p) => p.status === status).length})`}
                    </button>
                  ))}
                </div>
                <div className="ly-control-group">
                  <button
                    type="button"
                    onClick={expandAll}
                    className="ly-control-btn"
                  >
                    Expand All
                  </button>
                  <button
                    type="button"
                    onClick={collapseAll}
                    className="ly-control-btn"
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              {/* Parameters */}
              <div className="ly-params-section">
                <h2 className="ly-section-header">
                  Parameters ({filteredParams.length})
                </h2>
                {filteredParams.length === 0 ? (
                  <div className="ly-params-empty">
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
                  <h2 className="ly-section-header">
                    Constraints (stacked: {diff.constraints.length})
                  </h2>
                  {diff.constraints.map((constraint, i) => (
                    <div
                      key={constraint.id + i}
                      className="ly-constraint-row"
                    >
                      <SourceBadge source={constraint.source} />
                      <span className="ly-constraint-rule">
                        {constraint.rule}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!diff && !loading && !error && (
            <div className="ly-empty-main">
              <div className="ly-empty-icon">&#x1F5C3;</div>
              <div className="ly-empty-title">Select an overlay to visualize layers</div>
              <div className="ly-empty-desc">
                Choose a domain overlay from the left panel to see how it extends its base archetype.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Constants ──────────────────────────────────────────

const STATUS_LABELS: Record<ParameterStatus, string> = {
  INHERITED: "Inherited",
  OVERRIDDEN: "Overridden",
  NEW: "New",
};
