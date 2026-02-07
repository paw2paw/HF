"use client";

import { useState, useEffect } from "react";
import {
  ExpandMore,
  ExpandLess,
  OpenInNew,
  Refresh,
  Warning,
} from "@mui/icons-material";
import {
  StepIcon,
  StatusBadge,
  ConfigBadge,
  SectionIcon,
  SPIN_KEYFRAMES,
} from "@/lib/pipeline/icons";
import { CallerPicker } from "@/components/shared/CallerPicker";

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

interface Caller {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
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
      {/* Add spin keyframes */}
      <style dangerouslySetInnerHTML={{ __html: SPIN_KEYFRAMES }} />

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
              color: "#6b7280",
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
              color: "#6b7280",
              marginBottom: 4,
            }}
          >
            Run
          </label>
          <select
            value={selectedRunId || ""}
            onChange={(e) => setSelectedRunId(e.target.value || null)}
            disabled={!selectedCallerId || runs.length === 0}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 14,
              background: "white",
              opacity: !selectedCallerId ? 0.5 : 1,
            }}
          >
            <option value="">
              {loading
                ? "Loading..."
                : runs.length === 0
                ? "No runs found"
                : "Select a run..."}
            </option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {new Date(r.startedAt).toLocaleString()} - {r.triggeredBy || "manual"} ({r.durationMs}ms)
              </option>
            ))}
          </select>
        </div>

        {/* Refresh */}
        <button
          onClick={refreshRuns}
          disabled={!selectedCallerId}
          style={{
            marginTop: 20,
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: "white",
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
            color: "#9ca3af",
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
              background: "#f9fafb",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
            }}
          >
            <StatusBadge status={selectedRun.status} size={24} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>
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
              <div style={{ fontSize: 13, color: "#6b7280" }}>
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
// STEP CARD
// =============================================================================

function StepCard({
  step,
  isLast,
  expanded,
  onToggle,
}: {
  step: PipelineStep;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [activeSection, setActiveSection] = useState<string | null>(null);

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
              background: "#e5e7eb",
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
          background: "white",
          border: "1px solid #e5e7eb",
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

          <div style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500 }}>
            {step.durationMs !== null ? `${step.durationMs}ms` : "—"}
          </div>

          {hasDetails && (
            <div style={{ color: "#9ca3af" }}>
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
              borderTop: "1px solid #e5e7eb",
              padding: 12,
              background: "#fafafa",
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
                    color: "#6b7280",
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
                        background: "#f3f4f6",
                        borderRadius: 4,
                        fontSize: 12,
                        color: "#6b7280",
                        border: "1px solid #e5e7eb",
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
                    color: "#6b7280",
                    marginBottom: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Inputs
                </div>
                <div
                  style={{
                    background: "#1f2937",
                    borderRadius: 6,
                    maxHeight: 300,
                    overflow: "auto",
                  }}
                >
                  <pre
                    style={{
                      color: "#e5e7eb",
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
                        color: "#6b7280",
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
                        style={{
                          background: "#1f2937",
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
                            borderBottom: "1px solid #374151",
                          }}
                        >
                          {activeSection}
                        </div>
                        <pre
                          style={{
                            color: "#e5e7eb",
                            padding: 12,
                            margin: 0,
                            fontSize: 11,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          }}
                        >
                          {JSON.stringify(llmPrompt[activeSection], null, 2)}
                        </pre>
                      </div>
                    )}
                    {!activeSection && (
                      <div
                        style={{
                          padding: 16,
                          textAlign: "center",
                          color: "#9ca3af",
                          fontSize: 13,
                          background: "#f9fafb",
                          borderRadius: 6,
                          border: "1px dashed #d1d5db",
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
                        color: "#6b7280",
                        marginBottom: 4,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Outputs
                    </div>
                    <div
                      style={{
                        background: "#1f2937",
                        borderRadius: 6,
                        maxHeight: 400,
                        overflow: "auto",
                      }}
                    >
                      <pre
                        style={{
                          color: "#e5e7eb",
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
