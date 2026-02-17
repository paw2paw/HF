"use client";

import { useState, useEffect, useCallback } from "react";
import { VerticalSlider, SliderGroup } from "@/components/shared/VerticalSlider";
import { Sparkline } from "@/components/shared/Sparkline";
import { SpecPill, GoalPill, PlaybookPill, StatusBadge } from "@/src/components/shared/EntityPill";
import Link from "next/link";
import type { Memory, MemorySummary, PersonalityProfile, PersonalityObservation, ParamConfig } from "./types";
import { CATEGORY_COLORS } from "./constants";
import { useViewMode } from "@/contexts/ViewModeContext";

export function MemoriesSection({
  memories,
  summary,
  expandedMemory,
  setExpandedMemory,
  hideSummary,
}: {
  memories: Memory[];
  summary: MemorySummary | null;
  expandedMemory: string | null;
  setExpandedMemory: (id: string | null) => void;
  hideSummary?: boolean;
}) {
  const { isAdvanced } = useViewMode();
  return (
    <div>
      {/* Summary Cards - hidden when shown inline in SectionSelector */}
      {!hideSummary && summary && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "Facts", count: summary.factCount, color: CATEGORY_COLORS.FACT },
            { label: "Preferences", count: summary.preferenceCount, color: CATEGORY_COLORS.PREFERENCE },
            { label: "Events", count: summary.eventCount, color: CATEGORY_COLORS.EVENT },
            { label: "Topics", count: summary.topicCount, color: CATEGORY_COLORS.TOPIC },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: "10px 16px",
                background: stat.color.bg,
                borderRadius: 8,
                minWidth: 100,
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 600, color: stat.color.text }}>{stat.count}</div>
              <div style={{ fontSize: 11, color: stat.color.text }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Memories List */}
      {memories.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", background: "var(--background)", borderRadius: 12 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💭</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>No memories extracted yet</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>Run the Memory Extractor agent</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {memories.map((memory) => {
            const isExpanded = expandedMemory === memory.id;
            const categoryStyle = CATEGORY_COLORS[memory.category] || CATEGORY_COLORS.FACT;
            return (
              <div key={memory.id} style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 8, overflow: "hidden" }}>
                <button
                  onClick={() => setExpandedMemory(isExpanded ? null : memory.id)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: isExpanded ? "var(--background)" : "var(--surface-primary)",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 8px",
                        background: categoryStyle.bg,
                        color: categoryStyle.text,
                        borderRadius: 4,
                      }}
                    >
                      {memory.category}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>{memory.key}</span>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>= "{memory.value}"</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {memory.decayFactor != null && memory.decayFactor < 1 && (
                      <span style={{ fontSize: 10, color: "var(--text-placeholder)", opacity: 0.8 }} title={`Decay: ${memory.decayFactor.toFixed(2)}`}>
                        {memory.decayFactor >= 0.8 ? "●" : memory.decayFactor >= 0.5 ? "◐" : "○"}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: "var(--text-placeholder)" }}>{(memory.confidence * 100).toFixed(0)}%</span>
                    <span style={{ fontSize: 10, color: "var(--text-placeholder)" }}>
                      {(() => {
                        const d = new Date(memory.extractedAt);
                        const now = new Date();
                        const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
                        if (days === 0) return "today";
                        if (days === 1) return "1d ago";
                        if (days < 30) return `${days}d ago`;
                        return `${Math.floor(days / 30)}mo ago`;
                      })()}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-placeholder)" }}>{isExpanded ? "▼" : "▶"}</span>
                  </div>
                </button>
                {isAdvanced && isExpanded && (
                  <div style={{ padding: 16, borderTop: "1px solid var(--border-default)", background: "var(--background)", fontSize: 13 }}>
                    {memory.evidence && (
                      <>
                        <div style={{ fontWeight: 500, color: "var(--text-muted)", marginBottom: 4 }}>Evidence:</div>
                        <div style={{ fontStyle: "italic", color: "var(--text-secondary)", marginBottom: 8 }}>"{memory.evidence}"</div>
                      </>
                    )}
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11, color: "var(--text-placeholder)" }}>
                      <span>Extracted {new Date(memory.extractedAt).toLocaleString()}</span>
                      {memory.normalizedKey && memory.normalizedKey !== memory.key && (
                        <span>Key: {memory.normalizedKey}</span>
                      )}
                      {memory.decayFactor != null && (
                        <span>Decay: {memory.decayFactor.toFixed(2)}</span>
                      )}
                      {memory.expiresAt && (
                        <span>Expires: {new Date(memory.expiresAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Traits Section (formerly Personality) - FULLY DYNAMIC
export function PersonalitySection({
  personality,
  observations,
  paramConfig,
}: {
  personality: PersonalityProfile | null;
  observations: PersonalityObservation[];
  paramConfig: {
    grouped: Record<string, { parameterId: string; label: string; description: string; color: string; section: string }[]>;
    params: Record<string, { parameterId: string; label: string; description: string; color: string; section: string }>;
  } | null;
}) {
  const { isAdvanced } = useViewMode();
  // Show message if no paramConfig loaded
  if (!paramConfig) {
    return (
      <div style={{ padding: 40, textAlign: "center", background: "var(--background)", borderRadius: 12 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>Loading parameter configuration...</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>Fetching dynamic parameter metadata from database</div>
      </div>
    );
  }

  if (!personality && observations.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", background: "var(--background)", borderRadius: 12 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>No trait data yet</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>Run analysis to measure personality traits</div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
      {/* Aggregated Profile - FULLY DYNAMIC from database */}
      {personality && personality.parameterValues && Object.keys(personality.parameterValues).length > 0 && (
        <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 16 }}>
            Measured Traits
            <span style={{ fontWeight: 400, color: "var(--text-placeholder)", marginLeft: 8 }}>
              ({Object.keys(personality.parameterValues).length} parameters across {Object.keys(paramConfig.grouped).length} groups)
            </span>
          </h3>

          {/* Dynamically render all parameter groups from paramConfig.grouped */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
            {Object.entries(paramConfig.grouped).map(([groupName, params]) => {
              // Check if any parameters in this group have values
              const hasValues = params.some(param => personality.parameterValues[param.parameterId] !== undefined);
              if (!hasValues) return null;

              return (
                <div key={groupName}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-placeholder)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {groupName}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {params.map(param => {
                      const value = personality.parameterValues[param.parameterId];
                      if (value === undefined) return null;
                      return (
                        <div key={param.parameterId}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{param.label}</span>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{value !== null ? (value * 100).toFixed(0) : "—"}</span>
                          </div>
                          <div style={{ height: 10, background: "var(--border-default)", borderRadius: 5, overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${(value || 0) * 100}%`,
                                background: param.color,
                                borderRadius: 5,
                              }}
                            />
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-placeholder)", marginTop: 4 }}>{param.description}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {personality.lastUpdatedAt && (
            <div style={{ marginTop: 16, fontSize: 11, color: "var(--text-placeholder)" }}>
              Last updated: {new Date(personality.lastUpdatedAt).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* Trait History with Sparklines - Fully Dynamic */}
      {observations.length > 1 && personality && personality.parameterValues && paramConfig && (
        <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
            📈 Trait History
          </h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            Showing trends across {observations.length} observations
          </p>

          {/* Dynamic sparklines for ALL parameters from paramConfig */}
          {Object.entries(paramConfig.grouped).map(([groupName, params]) => {
            // Filter params that have historical data
            const paramsWithHistory = params.filter(param => {
              const hasHistory = observations.some((obs: any) => {
                const obsValues = typeof obs.parameterValues === 'string'
                  ? JSON.parse(obs.parameterValues)
                  : (obs.parameterValues || {});
                return obsValues[param.parameterId] !== undefined;
              });
              return hasHistory;
            });

            if (paramsWithHistory.length === 0) return null;

            return (
              <div key={groupName} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-placeholder)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {groupName}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                  {paramsWithHistory.map(param => {
                    // Get historical values for this parameter from parameterValues
                    const history = observations
                      .map((obs: any) => {
                        const obsValues = typeof obs.parameterValues === 'string'
                          ? JSON.parse(obs.parameterValues)
                          : (obs.parameterValues || {});
                        return obsValues[param.parameterId];
                      })
                      .filter((v): v is number => v !== null && v !== undefined)
                      .slice(-10); // Last 10 observations

                    if (history.length === 0) return null;

                    const currentValue = personality.parameterValues[param.parameterId] || history[history.length - 1];
                    const min = Math.min(...history);
                    const max = Math.max(...history);
                    const range = max - min;

                    // Create sparkline points
                    const width = 100;
                    const height = 30;
                    const points = history.map((value, i) => {
                      const x = (i / (history.length - 1)) * width;
                      const y = range > 0 ? height - ((value - min) / range) * height : height / 2;
                      return `${x},${y}`;
                    }).join(" ");

                    return (
                      <div key={param.parameterId} style={{ padding: 12, background: "var(--surface-secondary)", borderRadius: 8, border: "1px solid var(--border-default)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 500 }}>{param.label}</span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: param.color }}>
                            {((currentValue || 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                        <svg width={width} height={height} style={{ width: "100%", height: "30px" }}>
                          <polyline
                            points={points}
                            fill="none"
                            stroke={param.color}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {/* Latest point highlight */}
                          <circle
                            cx={history.length > 1 ? width : width / 2}
                            cy={range > 0 ? height - ((history[history.length - 1] - min) / range) * height : height / 2}
                            r="3"
                            fill={param.color}
                          />
                        </svg>
                        <div style={{ fontSize: 10, color: "var(--text-placeholder)", marginTop: 4 }}>
                          {history.length} observations · Range: {(min * 100).toFixed(0)}%-{(max * 100).toFixed(0)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

{/* Communication Preferences section removed - fields no longer exist in PersonalityProfile */}

      {/* Observations Timeline - DEPRECATED: Legacy OCEAN data only */}
      {/* TODO: Simplify display, enhance with history sparklines showing parameter trends over time */}
      {isAdvanced && observations.length > 0 && (
        <details style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 20 }}>
          <summary style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, background: "var(--badge-yellow-bg)", color: "var(--badge-yellow-text)", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>DEPRECATED</span>
            Observation History ({observations.length}) - Legacy Big Five Only
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-placeholder)" }}>Click to expand</span>
          </summary>
          <div style={{ fontSize: 11, color: "var(--text-placeholder)", marginTop: 12, marginBottom: 16, padding: 12, background: "var(--background)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
            ⚠️ <strong>Legacy data</strong> - This table stores only Big Five (OCEAN) traits in hardcoded columns.
            <br />Current system uses dynamic <code style={{ background: "var(--surface-secondary)", padding: "2px 4px", borderRadius: 3 }}>CallerPersonalityProfile.parameterValues</code> which measures all parameters shown above.
            <br />See TODO in API route: Migrate PersonalityObservation to dynamic storage.
          </div>

          {/* OCEAN Header Row */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 0", borderBottom: "2px solid var(--border-default)", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", width: 140 }}>Date/Time</span>
            <div style={{ display: "flex", gap: 8, flex: 1 }}>
              {[
                { label: "O", title: "Openness", color: "var(--trait-openness)" },
                { label: "C", title: "Conscientiousness", color: "var(--trait-conscientiousness)" },
                { label: "E", title: "Extraversion", color: "var(--trait-extraversion)" },
                { label: "A", title: "Agreeableness", color: "var(--trait-agreeableness)" },
                { label: "N", title: "Neuroticism", color: "var(--trait-neuroticism)" },
              ].map((trait) => (
                <div key={trait.label} style={{ display: "flex", alignItems: "center", gap: 4 }} title={trait.title}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: trait.color, width: 10 }}>{trait.label}</span>
                  <div style={{ width: 40, height: 6 }} />
                </div>
              ))}
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-secondary)" }}>Conf</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {observations.slice(0, 10).map((obs) => (
              <div key={obs.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: 11, color: "var(--text-placeholder)", width: 140 }}>{new Date(obs.observedAt).toLocaleString()}</span>
                <div style={{ display: "flex", gap: 8, flex: 1 }}>
                  {/* Legacy observations use old field names */}
                  {[
                    { key: "openness", label: "O", color: "var(--trait-openness)" },
                    { key: "conscientiousness", label: "C", color: "var(--trait-conscientiousness)" },
                    { key: "extraversion", label: "E", color: "var(--trait-extraversion)" },
                    { key: "agreeableness", label: "A", color: "var(--trait-agreeableness)" },
                    { key: "neuroticism", label: "N", color: "var(--trait-neuroticism)" },
                  ].map((trait) => {
                    const value = obs[trait.key as keyof PersonalityObservation] as number | null;
                    return (
                      <div key={trait.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 10, color: "var(--text-placeholder)" }}>{trait.label}</span>
                        <div style={{ width: 40, height: 6, background: "var(--border-default)", borderRadius: 3, overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${(value || 0) * 100}%`,
                              background: trait.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <span style={{ fontSize: 10, color: "var(--text-placeholder)" }}>
                  {obs.confidence !== null ? `${(obs.confidence * 100).toFixed(0)}% conf` : ""}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// =====================================================
// CALLER SLUGS SECTION - Shows all resolved template variables
// =====================================================

type SlugNode = {
  id: string;
  type: "category" | "spec" | "variable" | "value";
  name: string;
  path?: string;
  value?: string | number | boolean | null;
  specId?: string;
  specSlug?: string;
  children?: SlugNode[];
  meta?: Record<string, any>;
};

export function CallerSlugsSection({ callerId }: { callerId: string }) {
  const [slugsData, setSlugsData] = useState<{
    caller: { id: string; name: string; domain: string | null };
    playbook: { id: string; name: string; status: string } | null;
    tree: SlugNode[];
    counts: { memories: number; scores: number; targets: number; available: number; total: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSlugs();
  }, [callerId]);

  const fetchSlugs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/callers/${callerId}/slugs`);
      const result = await res.json();
      if (result.ok) {
        setSlugsData(result);
        // Auto-expand top-level categories
        const topLevel = new Set<string>();
        result.tree.forEach((node: SlugNode) => topLevel.add(node.id));
        setExpandedNodes(topLevel);
      }
    } catch (err) {
      console.error("Error fetching slugs:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ color: "var(--text-muted)" }}>Loading slugs...</div>
      </div>
    );
  }

  if (!slugsData || slugsData.tree.length === 0) {
    const hasAvailableVars = (slugsData?.counts?.available ?? 0) > 0;
    return (
      <div style={{ padding: 40, textAlign: "center", background: "var(--background)", borderRadius: 12 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏷️</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>
          {hasAvailableVars ? "No values yet" : "No template variables"}
        </div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
          {hasAvailableVars
            ? `${slugsData!.counts.available} template variables are defined but awaiting values.`
            : "This caller has no memories, scores, or personalized targets yet."}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-placeholder)", marginTop: 8 }}>
          Process calls through the pipeline to populate slug values.
        </div>
      </div>
    );
  }

  const categoryIcons: Record<string, string> = {
    IDENTITY: "🎭",
    MEMORIES: "🧠",
    SCORES: "📊",
    "PERSONALIZED TARGETS": "🎯",
    "AVAILABLE VARIABLES": "📋",
  };

  const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
    IDENTITY: { bg: "var(--status-success-bg)", border: "var(--status-success-border)", text: "var(--status-success-text)" },
    MEMORIES: { bg: "var(--status-warning-bg)", border: "var(--status-warning-border)", text: "var(--status-warning-text)" },
    SCORES: { bg: "var(--badge-blue-bg)", border: "var(--status-info-border)", text: "var(--badge-blue-text)" },
    "PERSONALIZED TARGETS": { bg: "var(--badge-pink-bg)", border: "var(--badge-pink-border)", text: "var(--badge-pink-text)" },
    "AVAILABLE VARIABLES": { bg: "var(--surface-secondary)", border: "var(--input-border)", text: "var(--text-muted)" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header with context */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 12,
        background: "var(--background)",
        borderRadius: 8,
        border: "1px solid var(--border-default)",
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>
            Caller Template Variables
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {slugsData.counts.total} with values: {slugsData.counts.memories} memories, {slugsData.counts.scores} scores, {slugsData.counts.targets} targets
            {slugsData.counts.available > 0 && (
              <span style={{ color: "var(--text-placeholder)", marginLeft: 8 }}>
                • {slugsData.counts.available} available in templates
              </span>
            )}
          </div>
        </div>
        {slugsData.playbook && (
          <Link
            href={`/x/playbooks/${slugsData.playbook.id}`}
            style={{
              fontSize: 11,
              padding: "4px 8px",
              background: "var(--status-info-bg)",
              color: "var(--button-primary-bg)",
              borderRadius: 4,
              textDecoration: "none",
            }}
          >
            📚 {slugsData.playbook.name}
          </Link>
        )}
      </div>

      {/* Tree view */}
      <div style={{
        background: "var(--surface-primary)",
        border: "1px solid var(--border-default)",
        borderRadius: 12,
        overflow: "hidden",
      }}>
        {slugsData.tree.map((category) => {
          const isExpanded = expandedNodes.has(category.id);
          const colors = categoryColors[category.name] || { bg: "var(--surface-secondary)", border: "var(--border-default)", text: "var(--text-secondary)" };
          const icon = categoryIcons[category.name] || "📁";

          return (
            <div key={category.id}>
              {/* Category header */}
              <div
                onClick={() => toggleNode(category.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 16px",
                  background: colors.bg,
                  borderBottom: `1px solid ${colors.border}`,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {isExpanded ? "▼" : "▶"}
                </span>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ fontWeight: 600, color: colors.text }}>{category.name}</span>
                {category.meta?.count !== undefined && (
                  <span style={{
                    fontSize: 10,
                    padding: "2px 6px",
                    background: colors.text,
                    color: "var(--text-on-dark)",
                    borderRadius: 4,
                  }}>
                    {category.meta.count}
                  </span>
                )}
              </div>

              {/* Category children */}
              {isExpanded && category.children && (
                <div style={{ borderBottom: "1px solid var(--border-default)" }}>
                  {category.children.map((spec) => (
                    <SlugSpecNode
                      key={spec.id}
                      spec={spec}
                      expandedNodes={expandedNodes}
                      onToggle={toggleNode}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Spec node component for caller slugs
function SlugSpecNode({
  spec,
  expandedNodes,
  onToggle,
}: {
  spec: SlugNode;
  expandedNodes: Set<string>;
  onToggle: (id: string) => void;
}) {
  const isExpanded = expandedNodes.has(spec.id);
  const hasChildren = spec.children && spec.children.length > 0;

  return (
    <div>
      <div
        onClick={() => hasChildren && onToggle(spec.id)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px 8px 32px",
          background: isExpanded ? "var(--background)" : "var(--surface-primary)",
          borderBottom: "1px solid var(--border-subtle)",
          cursor: hasChildren ? "pointer" : "default",
        }}
      >
        {hasChildren ? (
          <span style={{ fontSize: 10, color: "var(--text-placeholder)" }}>
            {isExpanded ? "▼" : "▶"}
          </span>
        ) : (
          <span style={{ width: 10 }} />
        )}
        <span style={{ fontSize: 12 }}>📄</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
          {spec.name}
        </span>
        {spec.specSlug && (
          <Link
            href={`/analysis-specs?slug=${spec.specSlug}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              textDecoration: "none",
            }}
          >
            ({spec.specSlug})
          </Link>
        )}
        {spec.meta?.count !== undefined && (
          <span style={{ fontSize: 10, color: "var(--text-placeholder)" }}>
            ({spec.meta.count} items)
          </span>
        )}
      </div>

      {/* Variables */}
      {isExpanded && spec.children && (
        <div>
          {spec.children.map((variable) => (
            <SlugVariableNode key={variable.id} variable={variable} />
          ))}
        </div>
      )}
    </div>
  );
}

// Variable node component for caller slugs
function SlugVariableNode({ variable }: { variable: SlugNode }) {
  const [showFull, setShowFull] = useState(false);
  const valueStr = variable.value !== undefined && variable.value !== null
    ? String(variable.value)
    : "—";
  const isLong = valueStr.length > 60;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "6px 16px 6px 56px",
        background: "var(--background)",
        borderBottom: "1px solid var(--border-subtle)",
        fontSize: 12,
      }}
    >
      <code style={{
        padding: "2px 6px",
        background: "var(--border-default)",
        borderRadius: 4,
        fontFamily: "monospace",
        fontSize: 11,
        color: "var(--text-secondary)",
        whiteSpace: "nowrap",
      }}>
        {variable.path || variable.name}
      </code>
      <span style={{ color: "var(--text-placeholder)" }}>=</span>
      <span
        style={{
          flex: 1,
          color: "var(--text-secondary)",
          wordBreak: "break-word",
          cursor: isLong ? "pointer" : "default",
        }}
        onClick={() => isLong && setShowFull(!showFull)}
        title={isLong ? "Click to expand" : undefined}
      >
        {showFull || !isLong ? valueStr : `${valueStr.substring(0, 60)}...`}
      </span>
      {variable.meta?.confidence !== undefined && (
        <span style={{
          fontSize: 10,
          padding: "1px 4px",
          background: variable.meta.confidence > 0.7 ? "var(--status-success-bg)" : "var(--status-warning-bg)",
          color: variable.meta.confidence > 0.7 ? "var(--status-success-text)" : "var(--status-warning-text)",
          borderRadius: 3,
        }}>
          {(variable.meta.confidence * 100).toFixed(0)}%
        </span>
      )}
    </div>
  );
}

// Enrollment types and constants
type EnrollmentItem = {
  id: string;
  status: string;
  enrolledAt: string;
  enrolledBy: string | null;
  completedAt: string | null;
  pausedAt: string | null;
  droppedAt: string | null;
  playbook: {
    id: string;
    name: string;
    status: string;
    version: string;
    domain?: { id: string; name: string } | null;
  };
};

const ENROLLMENT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ACTIVE: { bg: "var(--badge-green-bg)", text: "var(--badge-green-text)" },
  COMPLETED: { bg: "var(--badge-blue-bg)", text: "var(--badge-blue-text)" },
  PAUSED: { bg: "var(--badge-yellow-bg)", text: "var(--badge-yellow-text)" },
  DROPPED: { bg: "var(--surface-secondary)", text: "var(--text-muted)" },
};

export function CallerEnrollmentsSection({
  callerId,
  domainId,
  onCountChange,
}: {
  callerId: string;
  domainId: string | null | undefined;
  onCountChange: (count: number) => void;
}) {
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEnroll, setShowEnroll] = useState(false);
  const [availablePlaybooks, setAvailablePlaybooks] = useState<{ id: string; name: string; version: string }[]>([]);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchEnrollments = useCallback(async () => {
    try {
      const res = await fetch(`/api/callers/${callerId}/enrollments`);
      const result = await res.json();
      if (result.ok) {
        setEnrollments(result.enrollments || []);
        onCountChange(result.enrollments?.length || 0);
      }
    } catch (err) {
      console.error("Error fetching enrollments:", err);
    } finally {
      setLoading(false);
    }
  }, [callerId, onCountChange]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  const fetchAvailable = async () => {
    if (!domainId) return;
    try {
      const res = await fetch(`/api/domains/${domainId}`);
      const result = await res.json();
      if (result.ok && result.playbooks) {
        const enrolledIds = new Set(enrollments.map((e) => e.playbook.id));
        setAvailablePlaybooks(
          result.playbooks
            .filter((p: any) => p.status === "PUBLISHED" && !enrolledIds.has(p.id))
            .map((p: any) => ({ id: p.id, name: p.name, version: p.version }))
        );
      }
    } catch (err) {
      console.error("Error fetching available playbooks:", err);
    }
  };

  const handleEnroll = async (playbookId: string) => {
    setEnrolling(playbookId);
    try {
      const res = await fetch(`/api/callers/${callerId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playbookId }),
      });
      if (res.ok) {
        setShowEnroll(false);
        await fetchEnrollments();
      }
    } catch (err) {
      console.error("Error enrolling:", err);
    } finally {
      setEnrolling(null);
    }
  };

  const handleStatusChange = async (enrollmentId: string, newStatus: string) => {
    setUpdating(enrollmentId);
    try {
      const res = await fetch(`/api/callers/${callerId}/enrollments/${enrollmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchEnrollments();
      }
    } catch (err) {
      console.error("Error updating enrollment:", err);
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Loading enrollments...</div>
    );
  }

  if (enrollments.length === 0 && !showEnroll) {
    return (
      <div style={{ padding: 24, textAlign: "center", background: "var(--background)", borderRadius: 12, marginTop: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>No enrolled playbooks</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          This caller is not enrolled in any specific playbooks.
        </div>
        {domainId && (
          <button
            onClick={() => { setShowEnroll(true); fetchAvailable(); }}
            style={{
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 600,
              background: "var(--button-primary-bg)",
              color: "var(--button-primary-text)",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Enroll in Playbook
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Enrolled Playbooks
        </span>
        {domainId && (
          <button
            onClick={() => { setShowEnroll(!showEnroll); if (!showEnroll) fetchAvailable(); }}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 600,
              background: showEnroll ? "var(--surface-secondary)" : "var(--button-primary-bg)",
              color: showEnroll ? "var(--text-secondary)" : "var(--button-primary-text)",
              border: "none",
              borderRadius: 5,
              cursor: "pointer",
            }}
          >
            {showEnroll ? "Cancel" : "+ Enroll"}
          </button>
        )}
      </div>

      {/* Enroll picker */}
      {showEnroll && (
        <div style={{ padding: 12, background: "var(--surface-secondary)", borderRadius: 8, marginBottom: 8 }}>
          {availablePlaybooks.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
              No more playbooks available to enroll in.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {availablePlaybooks.map((pb) => (
                <button
                  key={pb.id}
                  onClick={() => handleEnroll(pb.id)}
                  disabled={enrolling === pb.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "var(--surface-primary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 6,
                    cursor: enrolling === pb.id ? "not-allowed" : "pointer",
                    opacity: enrolling === pb.id ? 0.6 : 1,
                    fontSize: 13,
                    color: "var(--text-primary)",
                  }}
                >
                  <span>{pb.name} <span style={{ fontSize: 11, color: "var(--text-muted)" }}>v{pb.version}</span></span>
                  <span style={{ fontSize: 11, color: "var(--button-primary-bg)", fontWeight: 600 }}>
                    {enrolling === pb.id ? "Enrolling..." : "Enroll"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Enrollment list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {enrollments.map((enr) => {
          const colors = ENROLLMENT_STATUS_COLORS[enr.status] || ENROLLMENT_STATUS_COLORS.ACTIVE;
          const isUpdating = updating === enr.id;
          return (
            <div
              key={enr.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: "var(--surface-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              <Link href={`/x/playbooks/${enr.playbook.id}`} style={{ flex: 1, textDecoration: "none", color: "var(--text-primary)", fontWeight: 500 }}>
                {enr.playbook.name}
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>v{enr.playbook.version}</span>
              </Link>
              <span
                style={{
                  padding: "2px 8px",
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  borderRadius: 10,
                  background: colors.bg,
                  color: colors.text,
                }}
              >
                {enr.status}
              </span>
              {enr.enrolledBy && (
                <span style={{ fontSize: 10, color: "var(--text-placeholder)" }}>{enr.enrolledBy}</span>
              )}
              {/* Status actions */}
              {!isUpdating && enr.status === "ACTIVE" && (
                <>
                  <button onClick={() => handleStatusChange(enr.id, "PAUSED")} title="Pause" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--text-muted)", padding: "2px 4px" }}>Pause</button>
                  <button onClick={() => handleStatusChange(enr.id, "COMPLETED")} title="Complete" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--badge-green-text)", padding: "2px 4px" }}>Complete</button>
                </>
              )}
              {!isUpdating && enr.status === "PAUSED" && (
                <button onClick={() => handleStatusChange(enr.id, "ACTIVE")} title="Resume" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--button-primary-bg)", padding: "2px 4px" }}>Resume</button>
              )}
              {!isUpdating && enr.status === "DROPPED" && (
                <button onClick={() => handleStatusChange(enr.id, "ACTIVE")} title="Re-enroll" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--button-primary-bg)", padding: "2px 4px" }}>Re-enroll</button>
              )}
              {isUpdating && (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>...</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
