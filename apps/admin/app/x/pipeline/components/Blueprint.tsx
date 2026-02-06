"use client";

import { useState, useEffect } from "react";
import { OpenInNew, ArrowDownward, Code, Settings } from "@mui/icons-material";
import {
  StepIcon,
  SectionIcon,
  ConfigBadge,
  CONFIG_SOURCE_BADGES,
} from "@/lib/pipeline/icons";
import type {
  PipelineManifest,
  PipelineStepManifest,
  CompositionSectionManifest,
} from "@/lib/ops/pipeline-manifest";

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function Blueprint() {
  const [manifest, setManifest] = useState<PipelineManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState(false);

  useEffect(() => {
    async function fetchManifest() {
      try {
        const res = await fetch("/api/pipeline/manifest");
        const data = await res.json();
        if (data.ok && data.manifest) {
          setManifest(data.manifest);
        }
      } catch (err) {
        console.error("Failed to fetch manifest:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchManifest();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
        Loading blueprint...
      </div>
    );
  }

  if (!manifest) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#dc2626" }}>
        Failed to load pipeline blueprint
      </div>
    );
  }

  const learnPhase = manifest.phases.find((p) => p.id === "learn");
  const adaptPhase = manifest.phases.find((p) => p.id === "adapt");

  return (
    <div>
      {/* Two Column Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
        }}
      >
        {/* ADAPT Phase */}
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #e5e7eb",
              background: "#fafafa",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              ADAPT Phase (pre-call)
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
              {adaptPhase?.description}
            </div>
          </div>

          <div style={{ padding: 20 }}>
            {adaptPhase?.steps.map((step) => (
              <StepNode key={step.id} step={step} />
            ))}

            {/* Composition Sections */}
            <div style={{ marginTop: 20 }}>
              <button
                onClick={() => setExpandedSections(!expandedSections)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "12px 16px",
                  background: "#f3f4f6",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                <Settings style={{ fontSize: 18, color: "#6b7280" }} />
                <span style={{ flex: 1, textAlign: "left" }}>
                  Composition Sections ({manifest.compositionSections.length})
                </span>
                <span style={{ color: "#9ca3af" }}>
                  {expandedSections ? "▲" : "▼"}
                </span>
              </button>

              {expandedSections && (
                <div
                  style={{
                    marginTop: 12,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  {manifest.compositionSections.map((section) => (
                    <SectionNode key={section.id} section={section} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LEARN Phase */}
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #e5e7eb",
              background: "#fafafa",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              LEARN Phase (post-call)
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
              {learnPhase?.description}
            </div>
          </div>

          <div style={{ padding: 20 }}>
            {learnPhase?.steps.map((step, idx) => (
              <div key={step.id}>
                <StepNode step={step} />
                {idx < (learnPhase?.steps.length ?? 0) - 1 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      padding: "8px 0",
                    }}
                  >
                    <ArrowDownward
                      style={{ fontSize: 20, color: "#d1d5db" }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Data Flow Diagram */}
      <div
        style={{
          marginTop: 32,
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16 }}>
          Data Flow
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <DataFlowBox label="Transcript" color="#f1f5f9" />
          <Arrow />
          <DataFlowBox label="CallScore" color="#e0e7ff" />
          <Arrow />
          <DataFlowBox label="CallerPersonality" color="#fce7f3" />
          <Arrow />
          <DataFlowBox label="CallerMemory" color="#fef3c7" />
          <Arrow />
          <DataFlowBox label="BehaviorMeasurement" color="#cffafe" />
          <Arrow />
          <DataFlowBox label="RewardScore" color="#d1fae5" />
          <Arrow />
          <DataFlowBox label="ComposedPrompt" color="#ede9fe" highlight />
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 24,
          padding: 12,
          background: "#f9fafb",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
        }}
      >
        <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>
          Legend:
        </span>
        <ConfigBadge source="code" />
        <ConfigBadge source="spec" />
        <ConfigBadge source="hybrid" />
      </div>
    </div>
  );
}

// =============================================================================
// STEP NODE
// =============================================================================

function StepNode({ step }: { step: PipelineStepManifest }) {
  const configSource = step.configSource as "code" | "spec" | "hybrid";

  return (
    <div
      style={{
        background: "#fafafa",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <StepIcon operation={step.id} size={20} />
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14 }}>{step.label}</span>
            <ConfigBadge source={configSource} />
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {step.description}
          </div>
        </div>
      </div>

      {/* Details */}
      <div style={{ marginTop: 12, fontSize: 12 }}>
        {/* Source File */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            color: "#6b7280",
            marginBottom: 4,
          }}
        >
          <Code style={{ fontSize: 14 }} />
          <span style={{ fontFamily: "monospace" }}>{step.sourceFile}</span>
          {step.sourceLine && (
            <span style={{ color: "#9ca3af" }}>:{step.sourceLine}</span>
          )}
        </div>

        {/* Spec Keys */}
        {step.specKeys && step.specKeys.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "#6b7280",
              marginBottom: 4,
            }}
          >
            <Settings style={{ fontSize: 14 }} />
            <span>
              Spec:{" "}
              {step.specKeys.map((k, i) => (
                <span key={k}>
                  <code
                    style={{
                      background: "#fef3c7",
                      padding: "1px 4px",
                      borderRadius: 3,
                    }}
                  >
                    {k}
                  </code>
                  {i < step.specKeys!.length - 1 && ", "}
                </span>
              ))}
            </span>
          </div>
        )}

        {/* Config Fields */}
        {step.configFields && step.configFields.length > 0 && (
          <div style={{ color: "#9ca3af", marginBottom: 4 }}>
            Config: {step.configFields.join(", ")}
          </div>
        )}

        {/* I/O */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid #e5e7eb",
          }}
        >
          <div>
            <span style={{ color: "#059669", fontWeight: 500 }}>In:</span>{" "}
            <span style={{ color: "#6b7280" }}>{step.inputs.join(", ")}</span>
          </div>
          <div>
            <span style={{ color: "#7c3aed", fontWeight: 500 }}>Out:</span>{" "}
            <span style={{ color: "#6b7280" }}>{step.outputs.join(", ")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SECTION NODE
// =============================================================================

function SectionNode({ section }: { section: CompositionSectionManifest }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        padding: 10,
        fontSize: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SectionIcon section={section.id} size={14} />
        <span style={{ fontWeight: 500 }}>{section.label}</span>
      </div>
      <div style={{ color: "#9ca3af", marginTop: 4 }}>
        {section.activateWhen === "always" ? (
          <span style={{ color: "#059669" }}>Always active</span>
        ) : (
          <span>When: {section.activateWhen}</span>
        )}
      </div>
      {section.transform && (
        <div style={{ color: "#6b7280", marginTop: 2 }}>
          Transform: <code>{section.transform}</code>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function DataFlowBox({
  label,
  color,
  highlight,
}: {
  label: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        padding: "8px 16px",
        background: color,
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 500,
        border: highlight ? "2px solid #7c3aed" : "1px solid #e5e7eb",
        boxShadow: highlight ? "0 0 12px rgba(124, 58, 237, 0.3)" : undefined,
      }}
    >
      {label}
    </div>
  );
}

function Arrow() {
  return (
    <div style={{ color: "#d1d5db", fontSize: 20 }}>→</div>
  );
}
