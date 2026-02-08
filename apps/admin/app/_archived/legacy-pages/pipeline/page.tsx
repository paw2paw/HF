"use client";

import { useState } from "react";

type StepStatus = "idle" | "running" | "success" | "error";

interface PipelineStep {
  id: string;
  title: string;
  description: string;
  opid: string;
  settings?: Record<string, any>;
  status: StepStatus;
  output?: string;
  result?: any;
}

export default function PipelinePage() {
  const [steps, setSteps] = useState<PipelineStep[]>([
    {
      id: "ingest_knowledge",
      title: "1. Ingest Knowledge Base",
      description: "Process markdown/text documents from sources/knowledge into searchable chunks",
      opid: "knowledge:ingest",
      settings: { verbose: true, resumePartial: true },
      status: "idle",
    },
    {
      id: "verify_transcripts",
      title: "2. Verify Transcripts",
      description: "Scan for available transcript files in transcripts/raw",
      opid: "transcripts:raw:list",
      settings: {},
      status: "idle",
    },
    {
      id: "process_transcripts",
      title: "3. Process Transcripts",
      description: "Extract users, batch transcripts, and create call records",
      opid: "transcripts:process",
      settings: { autoDetectType: true, createUsers: true, createBatches: true },
      status: "idle",
    },
    {
      id: "snapshot_parameters",
      title: "4. Snapshot Parameters",
      description: "Freeze Active parameters into immutable ParameterSet for reproducible analysis",
      opid: "kb:parameters:snapshot",
      settings: { tagFilter: "Active", includeDefinitions: true },
      status: "idle",
    },
    {
      id: "analyze_personality",
      title: "5. Analyze Personality",
      description: "Score Big Five traits from call transcripts using LLM",
      opid: "personality:analyze",
      settings: { verbose: true },
      status: "idle",
    },
  ]);

  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const runStep = async (stepId: string) => {
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) return;

    // Mark as running
    const updatedSteps = [...steps];
    updatedSteps[stepIndex].status = "running";
    updatedSteps[stepIndex].output = "";
    setSteps(updatedSteps);

    try {
      const step = updatedSteps[stepIndex];
      const response = await fetch(`/api/ops/${step.opid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(step.settings || {}),
      });

      if (!response.ok) {
        throw new Error(`Operation failed: ${response.status}`);
      }

      const result = await response.json();

      // Update with success
      updatedSteps[stepIndex].status = result.ok ? "success" : "error";
      updatedSteps[stepIndex].output = result.output || result.stdout || "";
      updatedSteps[stepIndex].result = result;
      setSteps([...updatedSteps]);
    } catch (error: any) {
      // Update with error
      updatedSteps[stepIndex].status = "error";
      updatedSteps[stepIndex].output = error.message || "Unknown error";
      setSteps([...updatedSteps]);
    }
  };

  const getStatusColor = (status: StepStatus) => {
    switch (status) {
      case "idle":
        return "#9ca3af"; // gray-400
      case "running":
        return "#3b82f6"; // blue-500
      case "success":
        return "#10b981"; // green-500
      case "error":
        return "#ef4444"; // red-500
    }
  };

  const getStatusIcon = (status: StepStatus) => {
    switch (status) {
      case "idle":
        return "○";
      case "running":
        return "◐";
      case "success":
        return "●";
      case "error":
        return "●";
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
          Analysis Pipeline
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280" }}>
          Process transcripts from ingestion to personality analysis and prompt selection
        </p>
      </div>

      {/* Pipeline Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {steps.map((step, index) => (
          <div
            key={step.id}
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {/* Step Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px 20px",
                borderLeft: `4px solid ${getStatusColor(step.status)}`,
              }}
            >
              {/* Status Indicator */}
              <div
                style={{
                  fontSize: 24,
                  color: getStatusColor(step.status),
                  animation: step.status === "running" ? "spin 2s linear infinite" : undefined,
                }}
              >
                {getStatusIcon(step.status)}
              </div>

              {/* Step Info */}
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 13, color: "#6b7280" }}>
                  {step.description}
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 8 }}>
                {step.output && (
                  <button
                    onClick={() =>
                      setExpandedStep(expandedStep === step.id ? null : step.id)
                    }
                    style={{
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#4b5563",
                      background: "#f9fafb",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    {expandedStep === step.id ? "Hide Output" : "Show Output"}
                  </button>
                )}

                <button
                  onClick={() => runStep(step.id)}
                  disabled={step.status === "running"}
                  style={{
                    padding: "8px 20px",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#ffffff",
                    background: step.status === "running" ? "#9ca3af" : "#2563eb",
                    border: "none",
                    borderRadius: 6,
                    cursor: step.status === "running" ? "not-allowed" : "pointer",
                    opacity: step.status === "running" ? 0.6 : 1,
                  }}
                >
                  {step.status === "running" ? "Running..." : "Go"}
                </button>
              </div>
            </div>

            {/* Expandable Output */}
            {expandedStep === step.id && step.output && (
              <div
                style={{
                  padding: "16px 20px",
                  background: "#f9fafb",
                  borderTop: "1px solid #e5e7eb",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: "monospace",
                    color: "#374151",
                    whiteSpace: "pre-wrap",
                    maxHeight: 400,
                    overflow: "auto",
                    background: "#ffffff",
                    padding: 12,
                    borderRadius: 4,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  {step.output}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Run All Button */}
      <div style={{ marginTop: 32, textAlign: "center" }}>
        <button
          onClick={async () => {
            for (const step of steps) {
              await runStep(step.id);
              // Small delay between steps
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }}
          disabled={steps.some((s) => s.status === "running")}
          style={{
            padding: "12px 32px",
            fontSize: 15,
            fontWeight: 600,
            color: "#ffffff",
            background: steps.some((s) => s.status === "running")
              ? "#9ca3af"
              : "#7c3aed",
            border: "none",
            borderRadius: 8,
            cursor: steps.some((s) => s.status === "running")
              ? "not-allowed"
              : "pointer",
          }}
        >
          Run All Steps
        </button>
      </div>

      {/* CSS for rotation animation */}
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
