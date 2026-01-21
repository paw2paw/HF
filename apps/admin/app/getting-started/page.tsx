"use client";

import React, { useState, useEffect } from "react";
import { uiColors } from "../../src/components/shared/uiColors";

type StepStatus = "pending" | "in_progress" | "completed" | "error";

interface Step {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  checkEndpoint?: string;
  actionLabel?: string;
  actionOpid?: string;
  actionLink?: string;
}

export default function GettingStartedPage() {
  const [transcriptStats, setTranscriptStats] = useState<{
    fileCount: number;
    totalCalls: number;
    batchFiles: number;
    singleFiles: number;
  } | null>(null);

  const [processResults, setProcessResults] = useState<{
    filesProcessed: number;
    usersCreated: number;
    batchesCreated: number;
    callsProcessed: number;
  } | null>(null);

  const [steps, setSteps] = useState<Step[]>([
    {
      id: "db_setup",
      title: "1. Database Setup",
      description: "Ensure PostgreSQL is running and migrations are applied",
      status: "pending",
      checkEndpoint: "/api/health",
      actionLabel: "Check Health",
      actionLink: "/ops",
    },
    {
      id: "seed_parameters",
      title: "2. Seed Parameters",
      description: "Load 44 baseline parameters (Big Five traits, quality dimensions)",
      status: "pending",
      actionLabel: "Seed Database",
      actionOpid: "prisma:seed",
    },
    {
      id: "ingest_knowledge",
      title: "3. Ingest Knowledge Base",
      description: "Load reference documents for parameter scoring rubrics",
      status: "pending",
      actionLabel: "Ingest Knowledge",
      actionOpid: "knowledge:ingest",
    },
    {
      id: "add_transcripts",
      title: "4. Verify Transcripts",
      description: "Check for transcript files in HF_KB_PATH/transcripts/raw/",
      status: "pending",
      checkEndpoint: "/api/transcripts",
      actionLabel: "View Transcripts",
      actionLink: "/transcripts#/transcripts",
    },
    {
      id: "process_transcripts",
      title: "5. Process Transcripts",
      description: "Extract users, batch transcripts, and create call records",
      status: "pending",
      actionLabel: "Process Transcripts",
      actionOpid: "transcripts:process",
    },
    {
      id: "snapshot_parameters",
      title: "6. Snapshot Parameters",
      description: "Freeze Active parameters into a ParameterSet for reproducible analysis",
      status: "pending",
      actionLabel: "Create Snapshot",
      actionOpid: "kb:parameters:snapshot",
    },
    {
      id: "analyze_personality",
      title: "7. Analyze Personality",
      description: "Score Big Five traits from transcripts (creates observations)",
      status: "pending",
      actionLabel: "Coming Soon",
    },
    {
      id: "view_results",
      title: "8. View Results",
      description: "Explore personality profiles and prompt selections",
      status: "pending",
      actionLabel: "View Dashboard",
      actionLink: "/admin#/parameters",
    },
  ]);

  const [checking, setChecking] = useState(false);
  const [expandedStep, setExpandedStep] = useState<string | null>("db_setup");

  useEffect(() => {
    checkStepStatuses();
  }, []);

  async function checkStepStatuses() {
    setChecking(true);
    const updated = [...steps];

    // Check database health
    try {
      const healthRes = await fetch("/api/health");
      const health = await healthRes.json();
      if (health.ok && health.checks.database.status === "ok") {
        updated[0].status = "completed";
      }
    } catch (err) {
      updated[0].status = "error";
    }

    // Check if parameters exist
    try {
      const paramsRes = await fetch("/api/parameters?_end=1");
      const params = await paramsRes.json();
      if (Array.isArray(params) && params.length > 0) {
        updated[1].status = "completed";
      }
    } catch (err) {
      // Still pending
    }

    // Check if transcripts exist
    try {
      const transcriptsRes = await fetch('/api/transcripts?sort=["modifiedAt","DESC"]&range=[0,999]');
      const transcripts = await transcriptsRes.json();
      if (Array.isArray(transcripts) && transcripts.length > 0) {
        updated[3].status = "completed";

        // Calculate stats
        const stats = {
          fileCount: transcripts.length,
          totalCalls: transcripts.reduce((sum: number, t: any) => sum + (t.callCount || 0), 0),
          batchFiles: transcripts.filter((t: any) => t.type === "Batch").length,
          singleFiles: transcripts.filter((t: any) => t.type === "Single").length,
        };
        setTranscriptStats(stats);
      }
    } catch (err) {
      // Still pending
    }

    setSteps(updated);
    setChecking(false);
  }

  async function runOperation(opid: string) {
    const stepIndex = steps.findIndex((s) => s.actionOpid === opid);
    if (stepIndex === -1) return;

    const updated = [...steps];
    updated[stepIndex].status = "in_progress";
    setSteps(updated);

    try {
      const res = await fetch(`/api/ops/${opid}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });

      const result = await res.json();

      if (result.ok) {
        updated[stepIndex].status = "completed";

        // Capture transcript processing results
        if (opid === "transcripts:process" && result.stdout) {
          const match = result.stdout.match(/Processed (\d+) file\(s\): (\d+) user\(s\), (\d+) batch\(es\), (\d+) call\(s\)/);
          if (match) {
            setProcessResults({
              filesProcessed: parseInt(match[1]),
              usersCreated: parseInt(match[2]),
              batchesCreated: parseInt(match[3]),
              callsProcessed: parseInt(match[4]),
            });
          }
        }
      } else {
        updated[stepIndex].status = "error";
      }
    } catch (err) {
      updated[stepIndex].status = "error";
    }

    setSteps(updated);
    await checkStepStatuses();
  }

  function getStatusColor(status: StepStatus): string {
    switch (status) {
      case "completed":
        return "#10b981";
      case "in_progress":
        return "#f59e0b";
      case "error":
        return "#ef4444";
      case "pending":
      default:
        return "#9ca3af";
    }
  }

  function getStatusIcon(status: StepStatus): string {
    switch (status) {
      case "completed":
        return "✓";
      case "in_progress":
        return "⏳";
      case "error":
        return "✗";
      case "pending":
      default:
        return "○";
    }
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: uiColors.textValue }}>
          Getting Started with HF MVP
        </h1>
        <p style={{ marginTop: 8, fontSize: 15, color: uiColors.textMuted, lineHeight: 1.6 }}>
          Follow these steps to set up the Human Factors MVP system from ops to prompt selection.
          Each step builds on the previous one.
        </p>
      </div>

      {/* Progress Overview */}
      <div
        style={{
          marginBottom: 24,
          padding: 16,
          background: "#f9fafb",
          border: `1px solid ${uiColors.border}`,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: uiColors.textLabel, marginBottom: 4 }}>
            Progress
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            {steps.map((step, i) => (
              <div
                key={step.id}
                style={{
                  flex: 1,
                  height: 6,
                  background:
                    step.status === "completed"
                      ? "#10b981"
                      : step.status === "in_progress"
                      ? "#f59e0b"
                      : "#e5e7eb",
                  borderRadius: 3,
                }}
              />
            ))}
          </div>
        </div>
        <button
          onClick={checkStepStatuses}
          disabled={checking}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            color: checking ? uiColors.textMuted : uiColors.brandText,
            background: "white",
            border: `1px solid ${uiColors.border}`,
            borderRadius: 6,
            cursor: checking ? "not-allowed" : "pointer",
          }}
        >
          {checking ? "Checking..." : "Refresh Status"}
        </button>
      </div>

      {/* Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {steps.map((step, index) => {
          const isExpanded = expandedStep === step.id;
          const isDisabled = index > 0 && steps[index - 1].status !== "completed";

          return (
            <div
              key={step.id}
              style={{
                border: `1px solid ${uiColors.border}`,
                borderRadius: 8,
                background: "white",
                opacity: isDisabled ? 0.6 : 1,
              }}
            >
              {/* Step Header */}
              <div
                style={{
                  padding: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                }}
                onClick={() => setExpandedStep(isExpanded ? null : step.id)}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: getStatusColor(step.status),
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {getStatusIcon(step.status)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: uiColors.textValue }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: 13, color: uiColors.textMuted, marginTop: 2 }}>
                    {step.description}
                  </div>
                </div>
                <div style={{ fontSize: 14, color: uiColors.textMuted }}>
                  {isExpanded ? "▼" : "▶"}
                </div>
              </div>

              {/* Step Details */}
              {isExpanded && (
                <div
                  style={{
                    padding: "0 16px 16px 60px",
                    borderTop: `1px solid ${uiColors.borderSubtle}`,
                    paddingTop: 16,
                  }}
                >
                  {step.id === "db_setup" && (
                    <div>
                      <p style={{ margin: 0, fontSize: 14, color: uiColors.text, lineHeight: 1.6 }}>
                        Ensure PostgreSQL is running and database migrations are applied. The health check
                        verifies database connectivity, KB path, environment variables, and file permissions.
                      </p>
                      <div style={{ marginTop: 12 }}>
                        <a
                          href="/ops"
                          target="_blank"
                          style={{
                            display: "inline-block",
                            padding: "8px 16px",
                            background: uiColors.brandBg,
                            color: uiColors.brandText,
                            border: "none",
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            textDecoration: "none",
                            cursor: "pointer",
                          }}
                        >
                          {step.actionLabel}
                        </a>
                      </div>
                    </div>
                  )}

                  {step.id === "seed_parameters" && (
                    <div>
                      <p style={{ margin: 0, fontSize: 14, color: uiColors.text, lineHeight: 1.6 }}>
                        Load 44 baseline parameters from <code>backlog/parameters.csv</code>. These define the
                        Big Five personality traits (openness, conscientiousness, extraversion, agreeableness,
                        neuroticism) and quality dimensions used for scoring.
                      </p>

                      {step.status === "completed" && (
                        <div
                          style={{
                            marginTop: 12,
                            padding: 12,
                            background: "#f0fdf4",
                            border: "1px solid #86efac",
                            borderRadius: 6,
                            fontSize: 12,
                          }}
                        >
                          <div style={{ color: "#15803d", fontWeight: 700, marginBottom: 8 }}>
                            ✓ 44 parameters loaded successfully
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <a
                              href="/admin#/parameters"
                              target="_blank"
                              style={{
                                fontSize: 12,
                                color: "#15803d",
                                textDecoration: "underline",
                                cursor: "pointer",
                              }}
                            >
                              View Parameters →
                            </a>
                          </div>
                        </div>
                      )}

                      <div style={{ marginTop: 12 }}>
                        <button
                          onClick={() => runOperation("prisma:seed")}
                          disabled={step.status === "in_progress" || step.status === "completed"}
                          style={{
                            padding: "8px 16px",
                            background:
                              step.status === "completed"
                                ? "#10b981"
                                : step.status === "in_progress"
                                ? "#f59e0b"
                                : uiColors.brandBg,
                            color: "white",
                            border: "none",
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            cursor:
                              step.status === "in_progress" || step.status === "completed"
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          {step.status === "completed"
                            ? "✓ Completed"
                            : step.status === "in_progress"
                            ? "Running..."
                            : step.actionLabel}
                        </button>
                      </div>
                    </div>
                  )}

                  {step.id === "ingest_knowledge" && (
                    <div>
                      <p style={{ margin: 0, fontSize: 14, color: uiColors.text, lineHeight: 1.6 }}>
                        Ingest reference documents from the knowledge base to provide scoring rubrics for
                        personality analysis. Documents are chunked and indexed for retrieval.
                      </p>
                      <div
                        style={{
                          marginTop: 12,
                          padding: 12,
                          background: "#f9fafb",
                          borderRadius: 6,
                          fontSize: 12,
                          color: uiColors.textValue,
                        }}
                      >
                        <div style={{ fontFamily: "monospace" }}>
                          Path: /Volumes/PAWSTAW/Projects/hf_kb/sources/knowledge/
                        </div>
                        <div style={{ marginTop: 8, color: uiColors.textMuted }}>
                          Processes markdown and text files into searchable chunks
                        </div>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <button
                          onClick={() => runOperation("knowledge:ingest")}
                          disabled={step.status === "in_progress" || isDisabled}
                          style={{
                            padding: "8px 16px",
                            background:
                              step.status === "in_progress"
                                ? "#f59e0b"
                                : isDisabled
                                ? "#e5e7eb"
                                : uiColors.brandBg,
                            color: isDisabled ? uiColors.textMuted : "white",
                            border: "none",
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: step.status === "in_progress" || isDisabled ? "not-allowed" : "pointer",
                          }}
                        >
                          {step.status === "in_progress" ? "Ingesting..." : step.actionLabel}
                        </button>
                      </div>
                    </div>
                  )}

                  {step.id === "add_transcripts" && (
                    <div>
                      <p style={{ margin: 0, fontSize: 14, color: uiColors.text, lineHeight: 1.6 }}>
                        {step.status === "completed"
                          ? "Transcript files detected! You have raw transcripts ready to process."
                          : "Place raw transcript JSON files in the transcripts directory. Files should contain call data with transcript text and customer information."}
                      </p>
                      <div
                        style={{
                          marginTop: 12,
                          padding: 12,
                          background: step.status === "completed" ? "#f0fdf4" : "#f9fafb",
                          border: step.status === "completed" ? "1px solid #86efac" : "none",
                          borderRadius: 6,
                          fontSize: 12,
                          color: uiColors.textValue,
                        }}
                      >
                        <div style={{ fontFamily: "monospace" }}>
                          Path: /Volumes/PAWSTAW/Projects/hf_kb/transcripts/raw/
                        </div>
                        {step.status === "completed" && transcriptStats && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ color: "#15803d", fontWeight: 700, marginBottom: 8 }}>
                              ✓ Files found - ready to process
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                              <div>
                                <div style={{ fontSize: 11, color: "#16a34a", opacity: 0.8 }}>Total Files</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: "#15803d" }}>
                                  {transcriptStats.fileCount}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 11, color: "#16a34a", opacity: 0.8 }}>Total Calls</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: "#15803d" }}>
                                  {transcriptStats.totalCalls}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 11, color: "#16a34a", opacity: 0.8 }}>Batch Files</div>
                                <div style={{ fontSize: 16, fontWeight: 600, color: "#15803d" }}>
                                  {transcriptStats.batchFiles}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 11, color: "#16a34a", opacity: 0.8 }}>Single Files</div>
                                <div style={{ fontSize: 16, fontWeight: 600, color: "#15803d" }}>
                                  {transcriptStats.singleFiles}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {step.status !== "completed" && (
                          <div style={{ marginTop: 8, color: uiColors.textMuted }}>
                            Format: JSON with call data (see QUICKSTART.md for examples)
                          </div>
                        )}
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <a
                          href="/transcripts#/transcripts"
                          target="_blank"
                          style={{
                            display: "inline-block",
                            padding: "8px 16px",
                            background: uiColors.brandBg,
                            color: uiColors.brandText,
                            border: "none",
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            textDecoration: "none",
                            cursor: "pointer",
                          }}
                        >
                          {step.actionLabel}
                        </a>
                      </div>
                    </div>
                  )}

                  {step.id === "process_transcripts" && (
                    <div>
                      <p style={{ margin: 0, fontSize: 14, color: uiColors.text, lineHeight: 1.6 }}>
                        Process transcript files to extract users, create batches, and prepare call records. Uses
                        hash-based deduplication to avoid reprocessing.
                      </p>

                      {step.status === "completed" && processResults && (
                        <div
                          style={{
                            marginTop: 12,
                            padding: 12,
                            background: "#f0fdf4",
                            border: "1px solid #86efac",
                            borderRadius: 6,
                            fontSize: 12,
                          }}
                        >
                          <div style={{ color: "#15803d", fontWeight: 700, marginBottom: 12 }}>
                            ✓ Processing complete
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 11, color: "#16a34a", opacity: 0.8 }}>Files Processed</div>
                              <div style={{ fontSize: 20, fontWeight: 700, color: "#15803d" }}>
                                {processResults.filesProcessed}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: "#16a34a", opacity: 0.8 }}>Calls Extracted</div>
                              <div style={{ fontSize: 20, fontWeight: 700, color: "#15803d" }}>
                                {processResults.callsProcessed}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: "#16a34a", opacity: 0.8 }}>Users Created</div>
                              <div style={{ fontSize: 16, fontWeight: 600, color: "#15803d" }}>
                                {processResults.usersCreated}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: "#16a34a", opacity: 0.8 }}>Batches Created</div>
                              <div style={{ fontSize: 16, fontWeight: 600, color: "#15803d" }}>
                                {processResults.batchesCreated}
                              </div>
                            </div>
                          </div>
                          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <a
                              href="/admin#/users"
                              target="_blank"
                              style={{
                                fontSize: 12,
                                color: "#15803d",
                                textDecoration: "underline",
                                cursor: "pointer",
                              }}
                            >
                              View Users →
                            </a>
                            <a
                              href="/transcripts#/transcripts"
                              target="_blank"
                              style={{
                                fontSize: 12,
                                color: "#15803d",
                                textDecoration: "underline",
                                cursor: "pointer",
                              }}
                            >
                              View Transcripts →
                            </a>
                          </div>
                        </div>
                      )}

                      <div style={{ marginTop: 12 }}>
                        <button
                          onClick={() => runOperation("transcripts:process")}
                          disabled={step.status === "in_progress" || isDisabled}
                          style={{
                            padding: "8px 16px",
                            background:
                              step.status === "in_progress"
                                ? "#f59e0b"
                                : isDisabled
                                ? "#e5e7eb"
                                : uiColors.brandBg,
                            color: isDisabled ? uiColors.textMuted : "white",
                            border: "none",
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: step.status === "in_progress" || isDisabled ? "not-allowed" : "pointer",
                          }}
                        >
                          {step.status === "in_progress" ? "Processing..." : step.actionLabel}
                        </button>
                      </div>
                    </div>
                  )}

                  {step.id === "snapshot_parameters" && (
                    <div>
                      <p style={{ margin: 0, fontSize: 14, color: uiColors.text, lineHeight: 1.6 }}>
                        Create an immutable <strong>ParameterSet</strong> from currently Active parameters. This freezes
                        the exact definitions, scales, and interpretations used for analysis - enabling reproducibility
                        and A/B testing of different parameter versions.
                      </p>
                      <div
                        style={{
                          marginTop: 12,
                          padding: 12,
                          background: "#f9fafb",
                          borderRadius: 6,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 8, color: uiColors.textValue }}>
                          Why snapshot?
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 16, color: uiColors.textMuted, lineHeight: 1.8 }}>
                          <li>Parameters can be edited over time - snapshots preserve exact versions</li>
                          <li>Every AnalysisRun links to a ParameterSet for audit trail</li>
                          <li>Compare effectiveness of different parameter definitions</li>
                        </ul>
                      </div>
                      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
                        <button
                          onClick={() => runOperation("kb:parameters:snapshot")}
                          disabled={step.status === "in_progress" || isDisabled}
                          style={{
                            padding: "8px 16px",
                            background:
                              step.status === "in_progress"
                                ? "#f59e0b"
                                : isDisabled
                                ? "#e5e7eb"
                                : uiColors.brandBg,
                            color: isDisabled ? uiColors.textMuted : "white",
                            border: "none",
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: step.status === "in_progress" || isDisabled ? "not-allowed" : "pointer",
                          }}
                        >
                          {step.status === "in_progress" ? "Creating..." : step.actionLabel}
                        </button>
                        <a
                          href="/parameter-sets"
                          target="_blank"
                          style={{
                            fontSize: 12,
                            color: uiColors.brandText,
                            textDecoration: "underline",
                          }}
                        >
                          View Parameter Sets →
                        </a>
                      </div>
                    </div>
                  )}

                  {step.id === "analyze_personality" && (
                    <div>
                      <p style={{ margin: 0, fontSize: 14, color: uiColors.text, lineHeight: 1.6 }}>
                        Score Big Five personality traits from call transcripts using parameter definitions as
                        rubrics. Creates PersonalityObservation records and aggregates into UserPersonality
                        profiles with time decay.
                      </p>
                      <div
                        style={{
                          marginTop: 12,
                          padding: 12,
                          background: "#fef3c7",
                          border: "1px solid #fbbf24",
                          borderRadius: 6,
                          fontSize: 13,
                          color: "#92400e",
                        }}
                      >
                        ⚠️ This operation is not yet wired to the UI. Coming soon!
                      </div>
                    </div>
                  )}

                  {step.id === "view_results" && (
                    <div>
                      <p style={{ margin: 0, fontSize: 14, color: uiColors.text, lineHeight: 1.6 }}>
                        Explore the admin interface to view parameters, personality profiles, and prompt
                        selections. The dashboard shows user insights and selected conversational approaches.
                      </p>
                      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                        <a
                          href="/admin#/parameters"
                          target="_blank"
                          style={{
                            display: "inline-block",
                            padding: "8px 16px",
                            background: uiColors.brandBg,
                            color: uiColors.brandText,
                            border: "none",
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          View Parameters
                        </a>
                        <a
                          href="/admin#/prompt-slugs"
                          target="_blank"
                          style={{
                            display: "inline-block",
                            padding: "8px 16px",
                            background: "white",
                            color: uiColors.brandText,
                            border: `1px solid ${uiColors.border}`,
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          View Prompt Slugs
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Help Footer */}
      <div
        style={{
          marginTop: 32,
          padding: 16,
          background: "#f0f9ff",
          border: "1px solid #bae6fd",
          borderRadius: 8,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: "#0c4a6e", marginBottom: 8 }}>
          Need Help?
        </div>
        <div style={{ fontSize: 13, color: "#0c4a6e", lineHeight: 1.6 }}>
          See <a href="/QUICKSTART.md" style={{ color: "#0369a1", fontWeight: 600 }}>QUICKSTART.md</a> for
          detailed documentation, or visit the{" "}
          <a href="/ops" style={{ color: "#0369a1", fontWeight: 600 }}>Ops Dashboard</a> to check system health
          and run operations manually.
        </div>
      </div>
    </div>
  );
}
