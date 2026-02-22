"use client";

import "./blueprint.css";
import { useState, useEffect } from "react";
import { ArrowDownward, Code, Settings } from "@mui/icons-material";
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
      <div className="bp-loading">
        Loading blueprint...
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className="bp-error">
        Failed to load composition blueprint
      </div>
    );
  }

  const learnPhase = manifest.phases.find((p) => p.id === "learn");
  const adaptPhase = manifest.phases.find((p) => p.id === "adapt");

  return (
    <div>
      {/* Two Column Layout */}
      <div className="bp-grid">
        {/* ADAPT Phase */}
        <div className="bp-phase-panel">
          <div className="bp-phase-header">
            <div className="bp-phase-title">ADAPT Phase (pre-call)</div>
            <div className="bp-phase-desc">{adaptPhase?.description}</div>
          </div>

          <div className="bp-phase-body">
            {adaptPhase?.steps.map((step) => (
              <StepNode key={step.id} step={step} />
            ))}

            {/* Composition Sections */}
            <div className="bp-sections-wrap">
              <button
                onClick={() => setExpandedSections(!expandedSections)}
                className="bp-sections-toggle"
              >
                <Settings className="bp-sections-toggle-icon" />
                <span className="bp-sections-toggle-label">
                  Composition Sections ({manifest.compositionSections.length})
                </span>
                <span className="bp-sections-toggle-chevron">
                  {expandedSections ? "▲" : "▼"}
                </span>
              </button>

              {expandedSections && (
                <div className="bp-sections-grid">
                  {manifest.compositionSections.map((section) => (
                    <SectionNode key={section.id} section={section} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LEARN Phase */}
        <div className="bp-phase-panel">
          <div className="bp-phase-header">
            <div className="bp-phase-title">LEARN Phase (post-call)</div>
            <div className="bp-phase-desc">{learnPhase?.description}</div>
          </div>

          <div className="bp-phase-body">
            {learnPhase?.steps.map((step, idx) => (
              <div key={step.id}>
                <StepNode step={step} />
                {idx < (learnPhase?.steps.length ?? 0) - 1 && (
                  <div className="bp-step-arrow">
                    <ArrowDownward className="bp-step-arrow-icon" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Data Flow Diagram */}
      <div className="bp-dataflow">
        <div className="bp-dataflow-title">Data Flow</div>
        <div className="bp-dataflow-row">
          <DataFlowBox label="Transcript" color="var(--surface-secondary)" />
          <Arrow />
          <DataFlowBox label="CallScore" color="var(--badge-indigo-bg)" />
          <Arrow />
          <DataFlowBox label="CallerPersonality" color="var(--badge-pink-bg)" />
          <Arrow />
          <DataFlowBox label="CallerMemory" color="var(--badge-yellow-bg)" />
          <Arrow />
          <DataFlowBox label="BehaviorMeasurement" color="var(--badge-cyan-bg)" />
          <Arrow />
          <DataFlowBox label="RewardScore" color="var(--badge-green-bg)" />
          <Arrow />
          <DataFlowBox label="ComposedPrompt" color="var(--badge-purple-bg)" highlight />
        </div>
      </div>

      {/* Legend */}
      <div className="bp-legend">
        <span className="bp-legend-label">Legend:</span>
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
    <div className="bp-step">
      {/* Header */}
      <div className="bp-step-header">
        <StepIcon operation={step.id} size={20} />
        <div className="bp-step-header-body">
          <div className="bp-step-title-row">
            <span className="bp-step-label">{step.label}</span>
            <ConfigBadge source={configSource} />
          </div>
          <div className="bp-step-desc">{step.description}</div>
        </div>
      </div>

      {/* Details */}
      <div className="bp-step-details">
        {/* Source File */}
        <div className="bp-step-detail-row">
          <Code className="bp-step-detail-icon" />
          <span className="bp-step-source-file">{step.sourceFile}</span>
          {step.sourceLine && (
            <span className="bp-step-source-line">:{step.sourceLine}</span>
          )}
        </div>

        {/* Spec Keys */}
        {step.specKeys && step.specKeys.length > 0 && (
          <div className="bp-step-detail-row">
            <Settings className="bp-step-detail-icon" />
            <span>
              Spec:{" "}
              {step.specKeys.map((k, i) => (
                <span key={k}>
                  <code className="bp-spec-key">{k}</code>
                  {i < step.specKeys!.length - 1 && ", "}
                </span>
              ))}
            </span>
          </div>
        )}

        {/* Config Fields */}
        {step.configFields && step.configFields.length > 0 && (
          <div className="bp-step-config">
            Config: {step.configFields.join(", ")}
          </div>
        )}

        {/* I/O */}
        <div className="bp-step-io">
          <div>
            <span className="bp-io-in">In:</span>{" "}
            <span className="bp-io-value">{step.inputs.join(", ")}</span>
          </div>
          <div>
            <span className="bp-io-out">Out:</span>{" "}
            <span className="bp-io-value">{step.outputs.join(", ")}</span>
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
    <div className="bp-section">
      <div className="bp-section-header">
        <SectionIcon section={section.id} size={14} />
        <span className="bp-section-label">{section.label}</span>
      </div>
      <div className="bp-section-status">
        {section.activateWhen === "always" ? (
          <span className="bp-section-active">Always active</span>
        ) : (
          <span>When: {section.activateWhen}</span>
        )}
      </div>
      {section.transform && (
        <div className="bp-section-transform">
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
      className={`bp-flow-box${highlight ? " bp-flow-box-highlight" : ""}`}
      style={{ background: color }}
    >
      {label}
    </div>
  );
}

function Arrow() {
  return <div className="bp-flow-arrow">&rarr;</div>;
}
