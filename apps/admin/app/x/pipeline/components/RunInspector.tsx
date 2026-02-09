"use client";

import { useState, useEffect, useRef } from "react";
import {
  ExpandMore,
  ExpandLess,
  Refresh,
  Warning,
  Psychology,
} from "@mui/icons-material";
import {
  StepIcon,
  StatusBadge,
  ConfigBadge,
  SectionIcon,
  SPIN_KEYFRAMES,
} from "@/lib/pipeline/icons";
import { CallerPicker } from "@/components/shared/CallerPicker";
import { FancySelect } from "@/components/shared/FancySelect";

// =============================================================================
// AI CONFIG TYPES
// =============================================================================

interface AIConfigInfo {
  callPoint: string;
  provider: string;
  model: string;
  transcriptLimit: number | null;
  defaultTranscriptLimit: number | null;
}

// Map step operations to AI config call points
const STEP_TO_CALLPOINT: Record<string, string> = {
  EXTRACT: "pipeline.measure",
  MEASURE: "pipeline.measure",
  LEARN: "pipeline.learn",
  SCORE_AGENT: "pipeline.score_agent",
  ADAPT: "pipeline.adapt",
};

// Steps that use AI
const AI_POWERED_STEPS = new Set(Object.keys(STEP_TO_CALLPOINT));

// =============================================================================
// TYPES
// =============================================================================

interface PipelineStep {
  id: string;
  operation: string;
  label: string | null;
  status: string;
  durationMs: number | null;
  specSlug: string | null;
  outputCounts: Record<string, number> | null;
  error: string | null;
  sectionsActivated: string[];
  sectionsSkipped: string[];
  inputs?: Record<string, unknown> | null;
  outputs?: Record<string, unknown> | null;
  sectionTimings?: Record<string, number> | null;
}

interface PipelineRun {
  id: string;
  phase: "LEARN" | "ADAPT";
  callerId: string | null;
  callId: string | null;
  triggeredBy: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  stepsTotal: number;
  stepsSucceeded: number;
  stepsFailed: number;
  stepsSkipped: number;
  errorSummary: string | null;
  steps: PipelineStep[];
  // Extra metadata from ComposedPrompt
  _caller?: { id: string; name: string | null };
  _model?: string | null;
  _status?: string;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function RunInspector() {
  const [selectedCallerId, setSelectedCallerId] = useState<string | null>(null);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [aiConfigs, setAiConfigs] = useState<Record<string, AIConfigInfo>>({});

  // Fetch AI configs on mount
  useEffect(() => {
    async function fetchAIConfigs() {
      try {
        const res = await fetch("/api/ai-config");
        const data = await res.json();
        if (data.ok && data.configs) {
          const configMap: Record<string, AIConfigInfo> = {};
          for (const config of data.configs) {
            configMap[config.callPoint] = {
              callPoint: config.callPoint,
              provider: config.provider,
              model: config.model,
              transcriptLimit: config.transcriptLimit,
              defaultTranscriptLimit: config.defaultTranscriptLimit,
            };
          }
          setAiConfigs(configMap);
        }
      } catch (err) {
        console.error("Failed to fetch AI configs:", err);
      }
    }
    fetchAIConfigs();
  }, []);

  // Fetch runs when caller changes
  useEffect(() => {
    if (!selectedCallerId) {
      setRuns([]);
      setSelectedRunId(null);
      return;
    }

    async function fetchRuns() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/pipeline/runs?callerId=${selectedCallerId}&limit=50`
        );
        const data = await res.json();
        if (data.ok && data.runs) {
          setRuns(data.runs);
          if (data.runs.length > 0) {
            setSelectedRunId(data.runs[0].id);
          } else {
            setSelectedRunId(null);
          }
        }
      } catch (err) {
        console.error("Failed to fetch runs:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchRuns();
  }, [selectedCallerId]);

  const selectedRun = runs.find((r) => r.id === selectedRunId);

  // Expand all steps by default when a run is selected
  useEffect(() => {
    if (selectedRun) {
      setExpandedSteps(new Set(selectedRun.steps.map((s) => s.id)));
    }
  }, [selectedRunId]);

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const refreshRuns = async () => {
    if (!selectedCallerId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/pipeline/runs?callerId=${selectedCallerId}&limit=50`
      );
      const data = await res.json();
      if (data.ok && data.runs) {
        setRuns(data.runs);
      }
    } catch (err) {
      console.error("Failed to refresh runs:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Add spin keyframes + highlight animation */}
      <style dangerouslySetInnerHTML={{ __html: `
        ${SPIN_KEYFRAMES}
        @keyframes highlightPulse {
          0% { background-color: rgba(139, 92, 246, 0.3); }
          100% { background-color: transparent; }
        }
        .highlight-row {
          animation: highlightPulse 1.5s ease-out;
        }
      ` }} />

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 24,
          alignItems: "center",
        }}
      >
        {/* Caller Picker */}
        <div style={{ flex: 1, maxWidth: 300 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--text-secondary)",
              marginBottom: 4,
            }}
          >
            Caller
          </label>
          <CallerPicker
            value={selectedCallerId}
            onChange={(callerId) => setSelectedCallerId(callerId || null)}
            placeholder="Select a caller..."
          />
        </div>

        {/* Run Picker */}
        <div style={{ flex: 1, maxWidth: 400 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--text-secondary)",
              marginBottom: 4,
            }}
          >
            Run
          </label>
          <FancySelect
            value={selectedRunId || ""}
            onChange={(v) => setSelectedRunId(v || null)}
            disabled={!selectedCallerId || runs.length === 0}
            placeholder={loading ? "Loading..." : runs.length === 0 ? "No runs found" : "Select a run..."}
            searchable={runs.length > 5}
            options={runs.map((r) => ({
              value: r.id,
              label: `${new Date(r.startedAt).toLocaleString()}`,
              subtitle: `${r.triggeredBy || "manual"} (${r.durationMs}ms)`,
            }))}
          />
        </div>

        {/* Refresh */}
        <button
          onClick={refreshRuns}
          disabled={!selectedCallerId}
          style={{
            marginTop: 20,
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid var(--border-default)",
            background: "var(--surface-primary)",
            color: "var(--text-secondary)",
            cursor: selectedCallerId ? "pointer" : "not-allowed",
            opacity: selectedCallerId ? 1 : 0.5,
          }}
        >
          <Refresh style={{ fontSize: 18 }} />
        </button>
      </div>

      {/* Empty State */}
      {!selectedRun && (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "var(--text-muted)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <div style={{ fontSize: 16 }}>
            Select a caller and run to inspect prompt composition details
          </div>
        </div>
      )}

      {/* Run Details */}
      {selectedRun && (
        <div>
          {/* Run Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
              padding: 16,
              background: "var(--surface-secondary)",
              borderRadius: 8,
              border: "1px solid var(--border-default)",
            }}
          >
            <StatusBadge status={selectedRun.status} size={24} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 16, color: "var(--text-primary)" }}>
                Prompt Composition
                {selectedRun._model && (
                  <span
                    style={{
                      marginLeft: 8,
                      padding: "2px 8px",
                      background: selectedRun._model === "deterministic" ? "#dbeafe" : "#fef3c7",
                      color: selectedRun._model === "deterministic" ? "#1e40af" : "#92400e",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 500,
                    }}
                  >
                    {selectedRun._model}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {new Date(selectedRun.startedAt).toLocaleString()} •{" "}
                {selectedRun.durationMs}ms • {selectedRun.stepsSucceeded}/
                {selectedRun.stepsTotal} steps • triggered by {selectedRun.triggeredBy || "manual"}
              </div>
            </div>
            {selectedRun.errorSummary && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  background: "#fee2e2",
                  borderRadius: 6,
                  color: "#dc2626",
                  fontSize: 13,
                }}
              >
                <Warning style={{ fontSize: 16 }} />
                {selectedRun.errorSummary}
              </div>
            )}
          </div>

          {/* Steps Timeline */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              maxHeight: "calc(100vh - 300px)",
              overflowY: "auto",
              paddingLeft: 4,
              paddingRight: 8,
            }}
          >
            {selectedRun.steps.map((step, idx) => (
              <StepCard
                key={step.id}
                step={step}
                isLast={idx === selectedRun.steps.length - 1}
                expanded={expandedSteps.has(step.id)}
                onToggle={() => toggleStep(step.id)}
                aiConfigs={aiConfigs}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// DATA TYPE COLORS
// =============================================================================

const DATA_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  memories: { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" },
  recentCalls: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  behaviorTargets: { bg: "#d1fae5", text: "#065f46", border: "#6ee7b7" },
  playbooks: { bg: "#ede9fe", text: "#5b21b6", border: "#c4b5fd" },
  personality: { bg: "#fce7f3", text: "#9d174d", border: "#f9a8d4" },
  curriculum: { bg: "#cffafe", text: "#0e7490", border: "#67e8f9" },
  identity: { bg: "#fed7aa", text: "#9a3412", border: "#fdba74" },
  instructions: { bg: "#e0e7ff", text: "#3730a3", border: "#a5b4fc" },
  learnerGoals: { bg: "#d9f99d", text: "#3f6212", border: "#bef264" },
  default: { bg: "#f3f4f6", text: "#374151", border: "#d1d5db" },
};

function getTypeColor(key: string) {
  return DATA_TYPE_COLORS[key] || DATA_TYPE_COLORS.default;
}

// =============================================================================
// AI CALL BADGE (with hover tooltip)
// =============================================================================

function AICallBadge({
  operation,
  aiConfigs,
}: {
  operation: string;
  aiConfigs: Record<string, AIConfigInfo>;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  const callPoint = STEP_TO_CALLPOINT[operation];
  if (!callPoint) return null;

  const config = aiConfigs[callPoint];
  if (!config) {
    // Show placeholder badge
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 6px",
          background: "#dbeafe",
          color: "#1e40af",
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 500,
        }}
        title="AI-powered step"
      >
        <Psychology style={{ fontSize: 12 }} />
        AI
      </span>
    );
  }

  const transcriptLimit = config.transcriptLimit ?? config.defaultTranscriptLimit;
  const isCustomized = config.transcriptLimit !== null;

  return (
    <div
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 8px",
          background: isCustomized ? "#fef3c7" : "#dbeafe",
          color: isCustomized ? "#92400e" : "#1e40af",
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 500,
          cursor: "pointer",
          border: `1px solid ${isCustomized ? "#fcd34d" : "#93c5fd"}`,
        }}
      >
        <Psychology style={{ fontSize: 12 }} />
        {config.provider === "mock" ? "Mock" : "AI"}
        {transcriptLimit && (
          <span style={{ opacity: 0.7 }}>• {(transcriptLimit / 1000).toFixed(1)}k</span>
        )}
      </span>

      {/* Hover Tooltip */}
      {showTooltip && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 6,
            padding: 12,
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 100,
            minWidth: 220,
            fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
            AI Configuration
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Provider</span>
              <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                {config.provider}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Model</span>
              <span
                style={{
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  fontSize: 11,
                  maxWidth: 120,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={config.model}
              >
                {config.model.split("-").slice(-2).join("-")}
              </span>
            </div>
            {transcriptLimit && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Transcript Limit</span>
                <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                  {transcriptLimit.toLocaleString()} chars
                  {isCustomized && (
                    <span
                      style={{
                        marginLeft: 4,
                        padding: "1px 4px",
                        background: "#fef3c7",
                        color: "#92400e",
                        borderRadius: 3,
                        fontSize: 9,
                      }}
                    >
                      custom
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px solid var(--border-default)",
              fontSize: 10,
              color: "var(--text-muted)",
            }}
          >
            Configure in <a href="/x/ai-config" style={{ color: "#2563eb" }}>AI Config</a>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// DATA VIEWER - Type-aware rendering for different data types
// =============================================================================

function DataViewer({
  data,
  dataType,
  highlight,
}: {
  data: unknown;
  dataType: string;
  highlight: boolean;
}) {
  // Handle arrays - render as rows
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return (
        <div style={{ padding: 12, color: "var(--text-muted)", fontSize: 12, fontStyle: "italic" }}>
          Empty array
        </div>
      );
    }

    // Special handling for memories array
    if (dataType === "memories") {
      return (
        <div style={{ padding: 0 }}>
          {data.map((item: any, i: number) => (
            <div
              key={i}
              className={highlight ? "highlight-row" : ""}
              style={{
                padding: "10px 12px",
                borderBottom: i < data.length - 1 ? "1px solid rgba(255,255,255,0.1)" : "none",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--text-on-dark)", marginBottom: 4 }}>
                {item.content || item.text || item.memory || JSON.stringify(item)}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", gap: 8 }}>
                {item.category && <span style={{ background: "rgba(255,255,255,0.1)", padding: "1px 6px", borderRadius: 4 }}>{item.category}</span>}
                {item.importance && <span>★ {item.importance}</span>}
                {item.createdAt && <span>{new Date(item.createdAt).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Generic array rendering
    return (
      <div style={{ padding: 0 }}>
        {data.map((item: any, i: number) => (
          <div
            key={i}
            className={highlight ? "highlight-row" : ""}
            style={{
              padding: "10px 12px",
              borderBottom: i < data.length - 1 ? "1px solid rgba(255,255,255,0.1)" : "none",
              fontSize: 11,
              color: "var(--text-on-dark)",
            }}
          >
            {typeof item === "object" ? (
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {JSON.stringify(item, null, 2)}
              </pre>
            ) : (
              String(item)
            )}
          </div>
        ))}
      </div>
    );
  }

  // Handle objects with 'all' array (common pattern for targets, etc.)
  if (data && typeof data === "object" && "all" in data && Array.isArray((data as any).all)) {
    const allItems = (data as any).all;
    return (
      <div style={{ padding: 0 }}>
        {allItems.map((item: any, i: number) => (
          <div
            key={i}
            className={highlight ? "highlight-row" : ""}
            style={{
              padding: "10px 12px",
              borderBottom: i < allItems.length - 1 ? "1px solid rgba(255,255,255,0.1)" : "none",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 12, color: "var(--text-on-dark)" }}>
              {item.name || item.parameterId || item.key || `Item ${i + 1}`}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {item.value !== undefined && (
                <span style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#a78bfa",
                  fontFamily: "monospace",
                }}>
                  {typeof item.value === "number" ? item.value.toFixed(2) : item.value}
                </span>
              )}
              {item.confidence !== undefined && (
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  ±{(item.confidence * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Handle plain objects - render as key-value pairs
  if (data && typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>).filter(([k]) => !k.startsWith("_"));
    return (
      <div style={{ padding: 0 }}>
        {entries.map(([key, value], i) => (
          <div
            key={key}
            className={highlight ? "highlight-row" : ""}
            style={{
              padding: "8px 12px",
              borderBottom: i < entries.length - 1 ? "1px solid rgba(255,255,255,0.1)" : "none",
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{key}</span>
            <span style={{
              fontSize: 11,
              color: "var(--text-on-dark)",
              textAlign: "right",
              wordBreak: "break-word",
              fontFamily: typeof value === "number" || typeof value === "boolean" ? "monospace" : "inherit",
            }}>
              {typeof value === "object" ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Fallback for primitives
  return (
    <pre
      style={{
        color: "var(--text-on-dark)",
        padding: 12,
        margin: 0,
        fontSize: 11,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

// =============================================================================
// STEP CARD
// =============================================================================

function StepCard({
  step,
  isLast,
  expanded,
  onToggle,
  aiConfigs,
}: {
  step: PipelineStep;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
  aiConfigs: Record<string, AIConfigInfo>;
}) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [highlightRows, setHighlightRows] = useState(false);
  const dataViewerRef = useRef<HTMLDivElement>(null);

  // Extract llmPrompt from outputs for structured viewing
  const llmPrompt = (step.outputs as any)?.llmPrompt || null;
  const hasLlmPrompt = !!llmPrompt;

  // Get sections from llmPrompt for tabbed view
  const llmSections = llmPrompt
    ? Object.keys(llmPrompt).filter(
        (k) => !k.startsWith("_") && llmPrompt[k] && typeof llmPrompt[k] === "object"
      )
    : [];

  const hasDetails =
    step.inputs ||
    step.outputs ||
    step.sectionsActivated.length > 0 ||
    step.sectionsSkipped.length > 0;

  // Scroll to data viewer and trigger highlight when section changes
  useEffect(() => {
    if (activeSection && dataViewerRef.current) {
      dataViewerRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setHighlightRows(true);
      const timer = setTimeout(() => setHighlightRows(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [activeSection]);

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
      }}
    >
      {/* Timeline connector */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: 44,
        }}
      >
        <StatusBadge status={step.status} size={18} />
        {!isLast && (
          <div
            style={{
              width: 2,
              flex: 1,
              background: "var(--border-default)",
              minHeight: 20,
            }}
          />
        )}
      </div>

      {/* Card */}
      <div
        style={{
          flex: 1,
          marginBottom: 8,
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          onClick={hasDetails ? onToggle : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 12,
            cursor: hasDetails ? "pointer" : "default",
          }}
        >
          <StepIcon operation={step.operation} size={18} />

          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontWeight: 500, fontSize: 14 }}>
                {step.label || step.operation}
              </span>
              {step.specSlug && <ConfigBadge source="spec" />}
              {AI_POWERED_STEPS.has(step.operation) && (
                <AICallBadge operation={step.operation} aiConfigs={aiConfigs} />
              )}
            </div>
            {step.outputCounts && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {Object.entries(step.outputCounts).map(([key, value]) => {
                  const colors = getTypeColor(key);
                  return (
                    <button
                      key={key}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!expanded) onToggle();
                        setActiveSection(activeSection === key ? null : key);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 8px",
                        background: activeSection === key ? colors.text : colors.bg,
                        color: activeSection === key ? "white" : colors.text,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {value} {key}
                    </button>
                  );
                })}
              </div>
            )}
            {step.error && step.status === "FAILED" && (
              <div
                style={{ fontSize: 12, color: "#dc2626", marginTop: 2 }}
              >
                {step.error}
              </div>
            )}
          </div>

          <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
            {step.durationMs !== null ? `${step.durationMs}ms` : "—"}
          </div>

          {hasDetails && (
            <div style={{ color: "var(--text-muted)" }}>
              {expanded ? (
                <ExpandLess style={{ fontSize: 20 }} />
              ) : (
                <ExpandMore style={{ fontSize: 20 }} />
              )}
            </div>
          )}
        </div>

        {/* Expanded Details */}
        {expanded && hasDetails && (
          <div
            style={{
              borderTop: "1px solid var(--border-default)",
              padding: 12,
              background: "var(--surface-secondary)",
              maxHeight: 500,
              overflowY: "auto",
            }}
          >
            {/* Sections for compose step */}
            {(step.sectionsActivated.length > 0 ||
              step.sectionsSkipped.length > 0) && (
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Sections ({step.sectionsActivated.length} active, {step.sectionsSkipped.length} skipped)
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    maxHeight: 150,
                    overflowY: "auto",
                    padding: 4,
                  }}
                >
                  {step.sectionsActivated.map((s) => {
                    // Map section names to llmPrompt fields
                    const sectionToField: Record<string, string> = {
                      caller_info: "caller",
                      personality: "personality",
                      memories: "memories",
                      behavior_targets: "behaviorTargets",
                      curriculum: "curriculum",
                      identity: "identity",
                      instructions: "instructions",
                      instructions_pedagogy: "instructions",
                      instructions_voice: "instructions",
                      learner_goals: "learnerGoals",
                      call_history: "callHistory",
                      domain_context: "domain",
                      quick_start: "_quickStart",
                      preamble: "_preamble",
                    };
                    const fieldName = sectionToField[s] || s;
                    const hasData = hasLlmPrompt && llmPrompt[fieldName];
                    const colors = getTypeColor(fieldName);
                    const isActive = activeSection === fieldName;

                    return (
                      <button
                        key={s}
                        onClick={() => {
                          if (hasData) {
                            setActiveSection(isActive ? null : fieldName);
                          }
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "4px 8px",
                          background: isActive ? colors.text : hasData ? colors.bg : "#d1fae5",
                          color: isActive ? "white" : hasData ? colors.text : "#065f46",
                          border: hasData ? `1px solid ${colors.border}` : "1px solid #6ee7b7",
                          borderRadius: 4,
                          fontSize: 12,
                          cursor: hasData ? "pointer" : "default",
                          opacity: hasData ? 1 : 0.7,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <SectionIcon section={s} size={14} />
                        {s}
                        {step.sectionTimings?.[s] && (
                          <span style={{ opacity: 0.7 }}>
                            ({step.sectionTimings[s]}ms)
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {step.sectionsSkipped.map((s) => (
                    <div
                      key={s}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 8px",
                        background: "var(--surface-tertiary)",
                        borderRadius: 4,
                        fontSize: 12,
                        color: "var(--text-muted)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      <SectionIcon section={s.split(":")[0]} size={14} />
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Input/Output JSON */}
            {step.inputs && (
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    marginBottom: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Inputs
                </div>
                <div
                  style={{
                    background: "var(--surface-dark)",
                    borderRadius: 6,
                    maxHeight: 300,
                    overflow: "auto",
                  }}
                >
                  <pre
                    style={{
                      color: "var(--text-on-dark)",
                      padding: 12,
                      margin: 0,
                      fontSize: 11,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {JSON.stringify(step.inputs, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {step.outputs && (
              <div>
                {/* If we have llmPrompt, show structured tabs */}
                {hasLlmPrompt && (
                  <>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        marginBottom: 8,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Prompt Data (click a section to view)
                    </div>
                    {/* Section tabs */}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        marginBottom: 12,
                      }}
                    >
                      {llmSections.map((section) => {
                        const colors = getTypeColor(section);
                        const isActive = activeSection === section;
                        const sectionData = llmPrompt[section];
                        const count = Array.isArray(sectionData)
                          ? sectionData.length
                          : Array.isArray(sectionData?.all)
                          ? sectionData.all.length
                          : sectionData?.totalCount || null;
                        return (
                          <button
                            key={section}
                            onClick={() => setActiveSection(isActive ? null : section)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "4px 10px",
                              background: isActive ? colors.text : colors.bg,
                              color: isActive ? "white" : colors.text,
                              border: `1px solid ${colors.border}`,
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 500,
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            {section}
                            {count !== null && (
                              <span
                                style={{
                                  background: isActive ? "rgba(255,255,255,0.3)" : colors.border,
                                  padding: "0 6px",
                                  borderRadius: 10,
                                  fontSize: 10,
                                }}
                              >
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {/* Active section content */}
                    {activeSection && llmPrompt[activeSection] && (
                      <div
                        ref={dataViewerRef}
                        style={{
                          background: "var(--surface-dark)",
                          borderRadius: 6,
                          maxHeight: 400,
                          overflow: "auto",
                          borderLeft: `4px solid ${getTypeColor(activeSection).border}`,
                        }}
                      >
                        <div
                          style={{
                            padding: "8px 12px",
                            background: getTypeColor(activeSection).bg,
                            color: getTypeColor(activeSection).text,
                            fontWeight: 600,
                            fontSize: 12,
                            borderBottom: "1px solid var(--border-dark)",
                            position: "sticky",
                            top: 0,
                            zIndex: 1,
                          }}
                        >
                          {activeSection}
                        </div>
                        <DataViewer
                          data={llmPrompt[activeSection]}
                          dataType={activeSection}
                          highlight={highlightRows}
                        />
                      </div>
                    )}
                    {!activeSection && (
                      <div
                        style={{
                          padding: 16,
                          textAlign: "center",
                          color: "var(--text-muted)",
                          fontSize: 13,
                          background: "var(--surface-tertiary)",
                          borderRadius: 6,
                          border: "1px dashed var(--border-strong)",
                        }}
                      >
                        Click a section above to view its data
                      </div>
                    )}
                  </>
                )}
                {/* Fallback: show raw outputs if no llmPrompt */}
                {!hasLlmPrompt && (
                  <>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        marginBottom: 4,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Outputs
                    </div>
                    <div
                      style={{
                        background: "var(--surface-dark)",
                        borderRadius: 6,
                        maxHeight: 400,
                        overflow: "auto",
                      }}
                    >
                      <pre
                        style={{
                          color: "var(--text-on-dark)",
                          padding: 12,
                          margin: 0,
                          fontSize: 11,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {JSON.stringify(step.outputs, null, 2)}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
