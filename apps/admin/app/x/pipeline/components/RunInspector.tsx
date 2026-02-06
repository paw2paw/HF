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
  const [callers, setCallers] = useState<Caller[]>([]);
  const [selectedCallerId, setSelectedCallerId] = useState<string | null>(null);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  // Fetch callers
  useEffect(() => {
    async function fetchCallers() {
      try {
        const res = await fetch("/api/callers?limit=100");
        const data = await res.json();
        if (data.callers) {
          setCallers(data.callers);
        }
      } catch (err) {
        console.error("Failed to fetch callers:", err);
      }
    }
    fetchCallers();
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
          <select
            value={selectedCallerId || ""}
            onChange={(e) => setSelectedCallerId(e.target.value || null)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 14,
              background: "white",
            }}
          >
            <option value="">Select a caller...</option>
            {callers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.email || c.phone || c.id.slice(0, 8)}
              </option>
            ))}
          </select>
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
                {new Date(r.startedAt).toLocaleString()} - {r.phase} -{" "}
                {r.status} ({r.durationMs}ms)
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
            Select a caller and run to inspect the pipeline execution
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
                {selectedRun.phase} Pipeline
              </div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                {new Date(selectedRun.startedAt).toLocaleString()} •{" "}
                {selectedRun.durationMs}ms • {selectedRun.stepsSucceeded}/
                {selectedRun.stepsTotal} steps
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
  const outputSummary = step.outputCounts
    ? Object.entries(step.outputCounts)
        .map(([k, v]) => `${v} ${k}`)
        .join(", ")
    : null;

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
            {outputSummary && (
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                {outputSummary}
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
                  Sections
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                  }}
                >
                  {step.sectionsActivated.map((s) => (
                    <div
                      key={s}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 8px",
                        background: "#d1fae5",
                        borderRadius: 4,
                        fontSize: 12,
                        color: "#065f46",
                      }}
                    >
                      <SectionIcon section={s} size={14} />
                      {s}
                      {step.sectionTimings?.[s] && (
                        <span style={{ opacity: 0.7 }}>
                          ({step.sectionTimings[s]}ms)
                        </span>
                      )}
                    </div>
                  ))}
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
                <pre
                  style={{
                    background: "#1f2937",
                    color: "#e5e7eb",
                    padding: 12,
                    borderRadius: 6,
                    fontSize: 11,
                    overflow: "auto",
                    maxHeight: 200,
                  }}
                >
                  {JSON.stringify(step.inputs, null, 2)}
                </pre>
              </div>
            )}

            {step.outputs && (
              <div>
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
                <pre
                  style={{
                    background: "#1f2937",
                    color: "#e5e7eb",
                    padding: 12,
                    borderRadius: 6,
                    fontSize: 11,
                    overflow: "auto",
                    maxHeight: 200,
                  }}
                >
                  {JSON.stringify(step.outputs, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
