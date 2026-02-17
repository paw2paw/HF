"use client";

import { useState } from "react";
import Link from "next/link";
import { AdvancedSection } from "@/components/shared/AdvancedSection";
import type { ComposedPrompt, CallerIdentity, CallerProfile, Memory } from "./types";

import { useEffect } from "react";
import { CATEGORY_COLORS } from "./constants";
import type { Call } from "./types";

export function UnifiedPromptSection({
  prompts,
  loading,
  expandedPrompt,
  setExpandedPrompt,
  onRefresh,
  defaultExpandFirst = false,
}: {
  prompts: ComposedPrompt[];
  loading: boolean;
  expandedPrompt: string | null;
  setExpandedPrompt: (id: string | null) => void;
  onRefresh: () => void;
  defaultExpandFirst?: boolean;
}) {
  const [viewMode, setViewMode] = useState<"human" | "llm">("human");
  const [llmViewMode, setLlmViewMode] = useState<"pretty" | "raw">("pretty");
  const [copiedButton, setCopiedButton] = useState<string | null>(null);

  // Auto-expand first prompt if defaultExpandFirst is true
  useEffect(() => {
    if (defaultExpandFirst && prompts.length > 0 && !expandedPrompt) {
      setExpandedPrompt(prompts[0].id);
    }
  }, [defaultExpandFirst, prompts, expandedPrompt, setExpandedPrompt]);
  const copyToClipboard = (text: string, buttonId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedButton(buttonId);
    setTimeout(() => setCopiedButton(null), 1500);
  };

  // Get the most recent active prompt
  const activePrompt = prompts.find((p) => p.status === "active") || prompts[0];

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading prompts...</div>
    );
  }

  if (!activePrompt) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "var(--background)",
            borderRadius: 12,
            border: "1px dashed var(--border-default)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>No Prompt Available</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8, maxWidth: 400, margin: "8px auto 0" }}>
            Run the pipeline on a call to generate prompts. Use "Prompt ALL" or click 📝 on individual calls.
          </div>
        </div>
      </div>
    );
  }

  const llm = activePrompt.llmPrompt;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header with View Toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Next Prompt</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Generated {new Date(activePrompt.composedAt).toLocaleString()} • {activePrompt.status.toUpperCase()}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Main View Toggle: Human vs LLM */}
          <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border-default)" }}>
            <button
              onClick={() => setViewMode("human")}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 500,
                background: viewMode === "human" ? "var(--button-primary-bg)" : "var(--surface-primary)",
                color: viewMode === "human" ? "var(--text-on-dark)" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
              }}
            >
              📖 Human-Readable
            </button>
            <button
              onClick={() => setViewMode("llm")}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 500,
                background: viewMode === "llm" ? "var(--button-primary-bg)" : "var(--surface-primary)",
                color: viewMode === "llm" ? "var(--text-on-dark)" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
              }}
            >
              🤖 LLM-Friendly
            </button>
          </div>
          <button
            onClick={onRefresh}
            style={{
              padding: "8px 12px",
              background: "var(--surface-secondary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-default)",
              borderRadius: 6,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ↻
          </button>
        </div>
      </div>

      {/* Human-Readable View */}
      {viewMode === "human" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Prompt Content */}
          <div
            style={{
              background: "var(--surface-dark)",
              color: "var(--text-on-dark)",
              padding: 20,
              borderRadius: 12,
              fontSize: 14,
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              fontFamily: "ui-monospace, monospace",
              maxHeight: 500,
              overflowY: "auto",
              border: "1px solid var(--border-dark)",
            }}
          >
            {activePrompt.prompt}
          </div>

          {/* Composition Inputs */}
          {activePrompt.inputs && (
            <div style={{ padding: 12, background: "var(--status-warning-bg)", borderRadius: 8, border: "1px solid var(--status-warning-border)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--status-warning-text)", marginBottom: 8 }}>
                Composition Inputs
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {activePrompt.inputs.memoriesCount !== undefined && (
                  <span style={{ fontSize: 12, color: "var(--status-warning-text)" }}>
                    Memories: {activePrompt.inputs.memoriesCount}
                  </span>
                )}
                {activePrompt.inputs.personalityAvailable !== undefined && (
                  <span style={{ fontSize: 12, color: "var(--status-warning-text)" }}>
                    Personality: {activePrompt.inputs.personalityAvailable ? "Yes" : "No"}
                  </span>
                )}
                {activePrompt.inputs.recentCallsCount !== undefined && (
                  <span style={{ fontSize: 12, color: "var(--status-warning-text)" }}>
                    Recent Calls: {activePrompt.inputs.recentCallsCount}
                  </span>
                )}
                {activePrompt.inputs.behaviorTargetsCount !== undefined && (
                  <span style={{ fontSize: 12, color: "var(--status-warning-text)" }}>
                    Behavior Targets: {activePrompt.inputs.behaviorTargetsCount}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Copy Button */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => copyToClipboard(activePrompt.prompt, "active-prompt")}
              style={{
                padding: "8px 16px",
                background: copiedButton === "active-prompt" ? "var(--button-success-bg)" : "var(--button-primary-bg)",
                color: "var(--text-on-dark)",
                border: "none",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: copiedButton === "active-prompt" ? "0 0 12px var(--button-success-bg)" : "none",
              }}
            >
              {copiedButton === "active-prompt" ? "✓ Copied" : "📋 Copy Prompt"}
            </button>
          </div>

          {/* Prompt History */}
          {prompts.length > 1 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
                Prompt History ({prompts.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {prompts.slice(1, 5).map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setExpandedPrompt(expandedPrompt === p.id ? null : p.id)}
                    style={{
                      padding: 12,
                      background: "var(--background)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            background: p.status === "active" ? "var(--status-success-bg)" : "var(--border-default)",
                            color: p.status === "active" ? "var(--status-success-text)" : "var(--text-muted)",
                            borderRadius: 4,
                            textTransform: "uppercase",
                          }}
                        >
                          {p.status}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {new Date(p.composedAt).toLocaleString()}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--text-placeholder)" }}>{expandedPrompt === p.id ? "−" : "+"}</span>
                    </div>
                    {expandedPrompt === p.id && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: 12,
                          background: "var(--surface-dark)",
                          color: "var(--text-on-dark)",
                          borderRadius: 6,
                          fontSize: 12,
                          whiteSpace: "pre-wrap",
                          fontFamily: "monospace",
                          maxHeight: 200,
                          overflowY: "auto",
                        }}
                      >
                        {p.prompt}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* LLM-Friendly View */}
      {viewMode === "llm" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!llm ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                background: "var(--background)",
                borderRadius: 12,
                border: "1px dashed var(--border-default)",
              }}
            >
              <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                No structured LLM data available for this prompt. Compose a new prompt to generate.
              </div>
            </div>
          ) : (
            <>
              {/* Pretty/Raw Toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Structured JSON for AI agent consumption</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border-default)" }}>
                    <button
                      onClick={() => setLlmViewMode("pretty")}
                      style={{
                        padding: "4px 10px",
                        fontSize: 11,
                        background: llmViewMode === "pretty" ? "var(--button-primary-bg)" : "var(--surface-primary)",
                        color: llmViewMode === "pretty" ? "var(--text-on-dark)" : "var(--text-secondary)",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Pretty
                    </button>
                    <button
                      onClick={() => setLlmViewMode("raw")}
                      style={{
                        padding: "4px 10px",
                        fontSize: 11,
                        background: llmViewMode === "raw" ? "var(--button-primary-bg)" : "var(--surface-primary)",
                        color: llmViewMode === "raw" ? "var(--text-on-dark)" : "var(--text-secondary)",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Raw JSON
                    </button>
                  </div>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(llm, null, 2), "llm-json-2")}
                    style={{
                      padding: "4px 10px",
                      background: copiedButton === "llm-json-2" ? "var(--button-success-bg)" : "var(--surface-secondary)",
                      color: copiedButton === "llm-json-2" ? "white" : "var(--text-secondary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 6,
                      fontSize: 11,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: copiedButton === "llm-json-2" ? "0 0 12px var(--button-success-bg)" : "none",
                    }}
                  >
                    {copiedButton === "llm-json-2" ? "✓ Copied" : "📋 Copy JSON"}
                  </button>
                </div>
              </div>

              {llmViewMode === "raw" ? (
                <div
                  style={{
                    background: "var(--surface-dark)",
                    color: "var(--text-on-dark-muted)",
                    padding: 20,
                    borderRadius: 12,
                    fontSize: 12,
                    fontFamily: "ui-monospace, monospace",
                    whiteSpace: "pre-wrap",
                    maxHeight: 600,
                    overflowY: "auto",
                    border: "1px solid var(--border-dark)",
                  }}
                >
                  {JSON.stringify(llm, null, 2)}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Memories */}
                  {llm.memories && llm.memories.totalCount > 0 && (
                    <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 16 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--badge-cyan-text)" }}>
                        💭 Memories ({llm.memories.totalCount})
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {llm.memories.byCategory && Object.entries(llm.memories.byCategory).map(([category, items]: [string, any]) => (
                          <div key={category}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: CATEGORY_COLORS[category]?.text || "var(--text-muted)", marginBottom: 6 }}>
                              {category}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {items.slice(0, 3).map((m: any, i: number) => (
                                <div
                                  key={i}
                                  style={{
                                    padding: 8,
                                    background: CATEGORY_COLORS[category]?.bg || "var(--surface-secondary)",
                                    borderRadius: 6,
                                    fontSize: 12,
                                  }}
                                >
                                  <span style={{ fontWeight: 500 }}>{m.key}:</span> {m.value}
                                  <span style={{ marginLeft: 8, fontSize: 10, color: "var(--text-placeholder)" }}>
                                    ({(m.confidence * 100).toFixed(0)}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Behavior Targets */}
                  {llm.behaviorTargets && llm.behaviorTargets.totalCount > 0 && (
                    <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 16 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--status-success-text)" }}>
                        🎯 Behavior Targets ({llm.behaviorTargets.totalCount})
                      </h4>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                        {llm.behaviorTargets.all?.slice(0, 9).map((t: any, i: number) => (
                          <div
                            key={i}
                            style={{
                              padding: 10,
                              background: t.targetLevel === "HIGH" ? "var(--status-success-bg)" : t.targetLevel === "LOW" ? "var(--status-error-bg)" : "var(--surface-secondary)",
                              borderRadius: 6,
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 2 }}>{t.name}</div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: t.targetLevel === "HIGH" ? "var(--status-success-text)" : t.targetLevel === "LOW" ? "var(--status-error-text)" : "var(--text-muted)",
                              }}
                            >
                              {t.targetLevel}
                            </div>
                            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                              {(t.targetValue * 100).toFixed(0)}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Call History Summary */}
                  {llm.callHistory && llm.callHistory.totalCalls > 0 && (
                    <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 16 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--badge-indigo-text)" }}>
                        📞 Call History ({llm.callHistory.totalCalls} calls)
                      </h4>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Recent calls included in prompt context
                      </div>
                    </div>
                  )}

                  {/* AI Instructions */}
                  {llm.instructions && (
                    <div style={{ background: "var(--status-warning-bg)", border: "1px solid var(--status-warning-border)", borderRadius: 12, padding: 16 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--status-warning-text)" }}>
                        📋 AI Instructions
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: "var(--status-warning-text)" }}>
                        {llm.instructions.use_memories && (
                          <div><strong>Memories:</strong> {llm.instructions.use_memories}</div>
                        )}
                        {llm.instructions.use_preferences && (
                          <div><strong>Preferences:</strong> {llm.instructions.use_preferences}</div>
                        )}
                        {llm.instructions.personality_adaptation?.length > 0 && (
                          <div>
                            <strong>Personality Adaptation:</strong>
                            <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                              {llm.instructions.personality_adaptation.map((tip: string, i: number) => (
                                <li key={i} style={{ marginBottom: 2 }}>{tip}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Prompts Section (AI-composed prompts history) - kept for reference
function PromptsSection({
  prompts,
  loading,
  composing,
  expandedPrompt,
  setExpandedPrompt,
  onCompose,
  onRefresh,
}: {
  prompts: ComposedPrompt[];
  loading: boolean;
  composing: boolean;
  expandedPrompt: string | null;
  setExpandedPrompt: (id: string | null) => void;
  onCompose: () => void;
  onRefresh: () => void;
}) {
  const [copiedButton, setCopiedButton] = useState<string | null>(null);
  const copyToClipboard = (text: string, buttonId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedButton(buttonId);
    setTimeout(() => setCopiedButton(null), 1500);
  };
  const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    active: { bg: "var(--status-success-bg)", text: "var(--status-success-text)" },
    superseded: { bg: "var(--surface-secondary)", text: "var(--text-muted)" },
    expired: { bg: "var(--status-error-bg)", text: "var(--status-error-text)" },
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading prompts...</div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header with actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Composed Prompts</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            AI-generated next-call guidance prompts for this caller
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onRefresh}
            style={{
              padding: "8px 16px",
              background: "var(--surface-secondary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-default)",
              borderRadius: 6,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
          <button
            onClick={onCompose}
            disabled={composing}
            style={{
              padding: "8px 16px",
              background: composing ? "var(--text-placeholder)" : "var(--button-primary-bg)",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              cursor: composing ? "not-allowed" : "pointer",
            }}
          >
            {composing ? "Composing..." : "Compose New Prompt"}
          </button>
        </div>
      </div>

      {prompts.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "var(--background)",
            borderRadius: 12,
            border: "1px dashed var(--border-default)",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>No prompts composed yet</div>
          <div style={{ fontSize: 13, color: "var(--text-placeholder)", marginTop: 4 }}>
            Click "Compose New Prompt" to generate a personalized next-call guidance prompt using AI
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {prompts.map((prompt) => {
            const isExpanded = expandedPrompt === prompt.id;
            const statusColors = STATUS_COLORS[prompt.status] || STATUS_COLORS.superseded;

            return (
              <div
                key={prompt.id}
                style={{
                  background: "var(--surface-primary)",
                  border: prompt.status === "active" ? "2px solid var(--button-primary-bg)" : "1px solid var(--border-default)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {/* Prompt Header */}
                <div
                  onClick={() => setExpandedPrompt(isExpanded ? null : prompt.id)}
                  style={{
                    padding: 16,
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: prompt.status === "active" ? "var(--status-info-bg)" : "var(--surface-primary)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        background: statusColors.bg,
                        color: statusColors.text,
                        borderRadius: 4,
                        fontWeight: 500,
                        textTransform: "uppercase",
                      }}
                    >
                      {prompt.status}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                      {new Date(prompt.composedAt).toLocaleString()}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      via {prompt.triggerType}
                    </span>
                    {prompt.model && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 6px",
                          background: "var(--status-info-bg)",
                          color: "var(--badge-indigo-text)",
                          borderRadius: 4,
                          fontFamily: "monospace",
                        }}
                      >
                        {prompt.model}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 16, color: "var(--text-muted)" }}>{isExpanded ? "−" : "+"}</span>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div style={{ padding: 16, borderTop: "1px solid var(--border-default)", background: "var(--surface-primary)" }}>
                    {/* Prompt Preview */}
                    <div
                      style={{
                        background: "var(--surface-dark)",
                        color: "var(--text-on-dark)",
                        padding: 16,
                        borderRadius: 8,
                        fontSize: 13,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        fontFamily: "monospace",
                        maxHeight: 400,
                        overflowY: "auto",
                        border: "1px solid var(--border-dark)",
                      }}
                    >
                      {prompt.prompt}
                    </div>

                    {/* Metadata */}
                    {prompt.inputs && (
                      <div style={{ marginTop: 16, padding: 12, background: "var(--status-warning-bg)", borderRadius: 8, border: "1px solid var(--status-warning-border)" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--status-warning-text)", marginBottom: 8 }}>
                          Composition Inputs
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                          {prompt.inputs.memoriesCount !== undefined && (
                            <span style={{ fontSize: 12, color: "var(--status-warning-text)" }}>
                              Memories: {prompt.inputs.memoriesCount}
                            </span>
                          )}
                          {prompt.inputs.personalityAvailable !== undefined && (
                            <span style={{ fontSize: 12, color: "var(--status-warning-text)" }}>
                              Personality: {prompt.inputs.personalityAvailable ? "Yes" : "No"}
                            </span>
                          )}
                          {prompt.inputs.recentCallsCount !== undefined && (
                            <span style={{ fontSize: 12, color: "var(--status-warning-text)" }}>
                              Recent Calls: {prompt.inputs.recentCallsCount}
                            </span>
                          )}
                          {prompt.inputs.behaviorTargetsCount !== undefined && (
                            <span style={{ fontSize: 12, color: "var(--status-warning-text)" }}>
                              Behavior Targets: {prompt.inputs.behaviorTargetsCount}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Trigger Call Link */}
                    {prompt.triggerCall && (
                      <div style={{ marginTop: 12 }}>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          Triggered by call on {new Date(prompt.triggerCall.createdAt).toLocaleDateString()} ({prompt.triggerCall.source})
                        </span>
                      </div>
                    )}

                    {/* Copy Button */}
                    <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(prompt.prompt, `history-prompt-${prompt.id}`);
                        }}
                        style={{
                          padding: "8px 16px",
                          background: copiedButton === `history-prompt-${prompt.id}` ? "var(--button-success-bg)" : "var(--button-primary-bg)",
                          color: "var(--text-on-dark)",
                          border: "none",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          boxShadow: copiedButton === `history-prompt-${prompt.id}` ? "0 0 12px var(--button-success-bg)" : "none",
                        }}
                      >
                        {copiedButton === `history-prompt-${prompt.id}` ? "✓ Copied" : "Copy to Clipboard"}
                      </button>
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

// LLM Prompt Section - displays the structured JSON prompt for AI consumption
function LlmPromptSection({
  prompts,
  loading,
  composing,
  onCompose,
  onRefresh,
}: {
  prompts: ComposedPrompt[];
  loading: boolean;
  composing: boolean;
  onCompose: () => void;
  onRefresh: () => void;
}) {
  const [viewMode, setViewMode] = useState<"pretty" | "raw">("pretty");
  const [copiedButton, setCopiedButton] = useState<string | null>(null);
  const copyToClipboard = (text: string, buttonId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedButton(buttonId);
    setTimeout(() => setCopiedButton(null), 1500);
  };

  // Get the most recent active prompt
  const activePrompt = prompts.find((p) => p.status === "active") || prompts[0];

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading LLM prompt...</div>
    );
  }

  if (!activePrompt || !activePrompt.llmPrompt) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "var(--background)",
            borderRadius: 12,
            border: "1px dashed var(--border-default)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>No LLM Prompt Available</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8, maxWidth: 400, margin: "8px auto 0" }}>
            {!activePrompt
              ? "Compose a prompt first to generate structured LLM data."
              : "This prompt was created before the llmPrompt feature. Compose a new prompt to get structured JSON data."}
          </div>
          <button
            onClick={onCompose}
            disabled={composing}
            style={{
              marginTop: 20,
              padding: "12px 24px",
              background: composing ? "var(--text-placeholder)" : "var(--button-primary-bg)",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: composing ? "not-allowed" : "pointer",
            }}
          >
            {composing ? "Composing..." : "Compose New Prompt"}
          </button>
        </div>
      </div>
    );
  }

  const llm = activePrompt.llmPrompt;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>LLM-Friendly Prompt Data</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Structured JSON for AI agent consumption • Generated {new Date(activePrompt.composedAt).toLocaleString()}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border-default)" }}>
            <button
              onClick={() => setViewMode("pretty")}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                background: viewMode === "pretty" ? "var(--button-primary-bg)" : "var(--surface-primary)",
                color: viewMode === "pretty" ? "var(--text-on-dark)" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Pretty
            </button>
            <button
              onClick={() => setViewMode("raw")}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                background: viewMode === "raw" ? "var(--button-primary-bg)" : "var(--surface-primary)",
                color: viewMode === "raw" ? "var(--text-on-dark)" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Raw JSON
            </button>
          </div>
          <button
            onClick={() => copyToClipboard(JSON.stringify(llm, null, 2), "llm-json-3")}
            style={{
              padding: "6px 12px",
              background: copiedButton === "llm-json-3" ? "var(--button-success-bg)" : "var(--surface-secondary)",
              color: copiedButton === "llm-json-3" ? "white" : "var(--text-secondary)",
              border: "1px solid var(--border-default)",
              borderRadius: 6,
              fontSize: 12,
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: copiedButton === "llm-json-3" ? "0 0 12px var(--button-success-bg)" : "none",
            }}
          >
            {copiedButton === "llm-json-3" ? "✓ Copied" : "📋 Copy JSON"}
          </button>
          <button
            onClick={onCompose}
            disabled={composing}
            style={{
              padding: "6px 12px",
              background: composing ? "var(--text-placeholder)" : "var(--button-primary-bg)",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: composing ? "not-allowed" : "pointer",
            }}
          >
            {composing ? "..." : "Refresh"}
          </button>
        </div>
      </div>

      {viewMode === "raw" ? (
        /* Raw JSON View */
        <div
          style={{
            background: "var(--surface-dark)",
            color: "var(--text-on-dark-muted)",
            padding: 20,
            borderRadius: 12,
            fontSize: 12,
            fontFamily: "ui-monospace, monospace",
            whiteSpace: "pre-wrap",
            maxHeight: 600,
            overflowY: "auto",
            border: "1px solid var(--border-dark)",
          }}
        >
          {JSON.stringify(llm, null, 2)}
        </div>
      ) : (
        /* Pretty View - structured sections */
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Caller Info */}
          {llm.caller && (
            <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--button-primary-bg)" }}>
                👤 Caller
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {llm.caller.name && (
                  <div style={{ padding: 10, background: "var(--status-info-bg)", borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Name</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{llm.caller.name}</div>
                  </div>
                )}
                {llm.caller.contactInfo?.email && (
                  <div style={{ padding: 10, background: "var(--status-info-bg)", borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Email</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{llm.caller.contactInfo.email}</div>
                  </div>
                )}
                {llm.caller.contactInfo?.phone && (
                  <div style={{ padding: 10, background: "var(--status-info-bg)", borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Phone</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{llm.caller.contactInfo.phone}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Personality */}
          {llm.personality && (
            <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--trait-neuroticism)" }}>
                🧠 Personality Profile
              </h4>
              {llm.personality.traits && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 12 }}>
                  {Object.entries(llm.personality.traits).map(([trait, data]: [string, any]) => (
                    <div
                      key={trait}
                      style={{
                        padding: 10,
                        background: data.level === "HIGH" ? "var(--status-success-bg)" : data.level === "LOW" ? "var(--status-error-bg)" : "var(--surface-secondary)",
                        borderRadius: 6,
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "capitalize", marginBottom: 4 }}>
                        {trait}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: data.level === "HIGH" ? "var(--status-success-text)" : data.level === "LOW" ? "var(--status-error-text)" : "var(--text-muted)",
                        }}
                      >
                        {data.level || "—"}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                        {data.score !== null ? `${(data.score * 100).toFixed(0)}%` : "N/A"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {llm.personality.preferences && Object.values(llm.personality.preferences).some((v) => v) && (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {llm.personality.preferences.tone && (
                    <span style={{ fontSize: 11, padding: "4px 8px", background: "var(--status-info-bg)", color: "var(--badge-indigo-text)", borderRadius: 4 }}>
                      Tone: {llm.personality.preferences.tone}
                    </span>
                  )}
                  {llm.personality.preferences.responseLength && (
                    <span style={{ fontSize: 11, padding: "4px 8px", background: "var(--status-warning-bg)", color: "var(--status-warning-text)", borderRadius: 4 }}>
                      Length: {llm.personality.preferences.responseLength}
                    </span>
                  )}
                  {llm.personality.preferences.technicalLevel && (
                    <span style={{ fontSize: 11, padding: "4px 8px", background: "var(--badge-purple-bg)", color: "var(--badge-purple-text)", borderRadius: 4 }}>
                      Tech: {llm.personality.preferences.technicalLevel}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Memories */}
          {llm.memories && llm.memories.totalCount > 0 && (
            <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--badge-cyan-text)" }}>
                💭 Memories ({llm.memories.totalCount})
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {llm.memories.byCategory && Object.entries(llm.memories.byCategory).map(([category, items]: [string, any]) => (
                  <div key={category}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: CATEGORY_COLORS[category]?.text || "var(--text-muted)", marginBottom: 6 }}>
                      {category}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {items.slice(0, 3).map((m: any, i: number) => (
                        <div
                          key={i}
                          style={{
                            padding: 8,
                            background: CATEGORY_COLORS[category]?.bg || "var(--surface-secondary)",
                            borderRadius: 6,
                            fontSize: 12,
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>{m.key}:</span> {m.value}
                          <span style={{ marginLeft: 8, fontSize: 10, color: "var(--text-placeholder)" }}>
                            ({(m.confidence * 100).toFixed(0)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Behavior Targets */}
          {llm.behaviorTargets && llm.behaviorTargets.totalCount > 0 && (
            <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--status-success-text)" }}>
                🎯 Behavior Targets ({llm.behaviorTargets.totalCount})
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {llm.behaviorTargets.all?.slice(0, 9).map((t: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      padding: 10,
                      background: t.targetLevel === "HIGH" ? "var(--status-success-bg)" : t.targetLevel === "LOW" ? "var(--status-error-bg)" : "var(--surface-secondary)",
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 2 }}>{t.name}</div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: t.targetLevel === "HIGH" ? "var(--status-success-text)" : t.targetLevel === "LOW" ? "var(--status-error-text)" : "var(--text-muted)",
                      }}
                    >
                      {t.targetLevel}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {(t.targetValue * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions Summary */}
          {llm.instructions && (
            <div style={{ background: "var(--status-warning-bg)", border: "1px solid var(--status-warning-border)", borderRadius: 12, padding: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--status-warning-text)" }}>
                📋 AI Instructions
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: "var(--status-warning-text)" }}>
                {llm.instructions.use_memories && (
                  <div><strong>Memories:</strong> {llm.instructions.use_memories}</div>
                )}
                {llm.instructions.use_preferences && (
                  <div><strong>Preferences:</strong> {llm.instructions.use_preferences}</div>
                )}
                {llm.instructions.use_topics && (
                  <div><strong>Topics:</strong> {llm.instructions.use_topics}</div>
                )}
                {llm.instructions.personality_adaptation?.length > 0 && (
                  <div>
                    <strong>Personality Adaptation:</strong>
                    <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                      {llm.instructions.personality_adaptation.map((tip: string, i: number) => (
                        <li key={i} style={{ marginBottom: 2 }}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Prompt Prep Section (deprecated - keeping for backward compatibility)
function PromptSection({ identities, caller, memories }: { identities: CallerIdentity[]; caller: CallerProfile; memories: Memory[] }) {
  const [selectedIdentity, setSelectedIdentity] = useState<CallerIdentity | null>(
    identities.find((i) => i.nextPrompt) || identities[0] || null
  );
  const [copiedButton, setCopiedButton] = useState<string | null>(null);
  const copyToClipboard = (text: string, buttonId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedButton(buttonId);
    setTimeout(() => setCopiedButton(null), 1500);
  };

  // Group memories by category for display
  const memoriesByCategory = memories.reduce((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {} as Record<string, Memory[]>);

  if (!identities || identities.length === 0) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        {/* Caller Info Card */}
        <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Caller Identification</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {caller.phone && (
              <div style={{ padding: 12, background: "var(--status-success-bg)", borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: "var(--status-success-text)", fontWeight: 500 }}>Phone</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--status-success-text)", marginTop: 4 }}>{caller.phone}</div>
              </div>
            )}
            {caller.email && (
              <div style={{ padding: 12, background: "var(--status-info-bg)", borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: "var(--status-info-text)", fontWeight: 500 }}>Email</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--status-info-text)", marginTop: 4 }}>{caller.email}</div>
              </div>
            )}
            {caller.externalId && (
              <div style={{ padding: 12, background: "var(--badge-purple-bg)", borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: "var(--badge-purple-text)", fontWeight: 500 }}>External ID</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--badge-purple-text)", marginTop: 4 }}>{caller.externalId}</div>
              </div>
            )}
            {caller.name && (
              <div style={{ padding: 12, background: "var(--status-warning-bg)", borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: "var(--status-warning-text)", fontWeight: 500 }}>Name</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--status-warning-text)", marginTop: 4 }}>{caller.name}</div>
              </div>
            )}
          </div>
        </div>

        {/* Key Memories for Prompt Composition */}
        <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Key Memories ({memories.length})</h4>
          {memories.length === 0 ? (
            <div style={{ color: "var(--text-placeholder)", fontSize: 13, padding: 20, textAlign: "center" }}>
              No memories extracted yet. Run analysis on calls to extract memories.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {Object.entries(memoriesByCategory).map(([category, mems]) => (
                <div key={category}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: CATEGORY_COLORS[category]?.text || "var(--text-muted)",
                      marginBottom: 8,
                    }}
                  >
                    {category} ({mems.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {mems.slice(0, 5).map((m) => (
                      <div
                        key={m.id}
                        style={{
                          padding: 10,
                          background: CATEGORY_COLORS[category]?.bg || "var(--surface-secondary)",
                          borderRadius: 6,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ fontWeight: 500, marginBottom: 2 }}>{m.key}</div>
                        <div style={{ color: "var(--text-secondary)" }}>{m.value}</div>
                      </div>
                    ))}
                    {mems.length > 5 && (
                      <div style={{ fontSize: 11, color: "var(--text-placeholder)", padding: "4px 10px" }}>
                        + {mems.length - 5} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Prompt Composition Notice */}
        <div style={{ background: "var(--status-warning-bg)", border: "1px solid var(--status-warning-border)", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ fontSize: 24 }}>💡</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--status-warning-text)" }}>No composed prompt yet</div>
              <div style={{ fontSize: 13, color: "var(--status-warning-text)", marginTop: 4 }}>
                To compose a personalized prompt for this caller, run the <code>prompt:compose-next</code> operation from the Ops page.
                This will combine their personality profile, memories, and behavior targets into a ready-to-use prompt.
              </div>
              <Link
                href="/ops"
                style={{
                  display: "inline-block",
                  marginTop: 12,
                  padding: "8px 16px",
                  background: "var(--button-primary-bg)",
                  color: "var(--text-on-dark)",
                  borderRadius: 6,
                  textDecoration: "none",
                  fontSize: 13,
                }}
              >
                Go to Ops →
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20 }}>
      {/* Identity List */}
      <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 16 }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Identities ({identities.length})</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {identities.map((identity) => (
            <button
              key={identity.id}
              onClick={() => setSelectedIdentity(identity)}
              style={{
                padding: 10,
                background: selectedIdentity?.id === identity.id ? "var(--status-info-bg)" : "var(--background)",
                border: `1px solid ${selectedIdentity?.id === identity.id ? "var(--status-info-border)" : "var(--border-default)"}`,
                borderRadius: 8,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                {identity.name || identity.externalId || identity.id.slice(0, 8)}
              </div>
              {identity.segment && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {identity.segment.name}
                </div>
              )}
              <div style={{ fontSize: 10, marginTop: 4, color: identity.nextPrompt ? "var(--status-success-text)" : "var(--text-placeholder)" }}>
                {identity.nextPrompt ? "✓ Prompt ready" : "No prompt"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Prompt Display */}
      <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 20 }}>
        {!selectedIdentity?.nextPrompt ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>No prompt composed</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
              Run prompt composition to generate a personalized prompt for this identity
            </div>
            <Link
              href="/ops"
              style={{
                display: "inline-block",
                marginTop: 16,
                padding: "10px 20px",
                background: "var(--button-primary-bg)",
                color: "var(--text-on-dark)",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              Go to Ops →
            </Link>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Composed Prompt</h3>
                <div style={{ fontSize: 12, color: "var(--text-placeholder)", marginTop: 2 }}>
                  {selectedIdentity.nextPromptComposedAt
                    ? `Composed ${new Date(selectedIdentity.nextPromptComposedAt).toLocaleString()}`
                    : ""}
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(selectedIdentity.nextPrompt || "", "next-prompt")}
                style={{
                  padding: "8px 16px",
                  background: copiedButton === "next-prompt" ? "var(--button-success-bg)" : "var(--surface-secondary)",
                  color: copiedButton === "next-prompt" ? "white" : "inherit",
                  border: "1px solid var(--input-border)",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  transition: "all 0.2s ease",
                  boxShadow: copiedButton === "next-prompt" ? "0 0 12px var(--button-success-bg)" : "none",
                }}
              >
                {copiedButton === "next-prompt" ? "✓ Copied" : "📋 Copy"}
              </button>
            </div>

            {selectedIdentity.nextPromptInputs && (
              <div style={{ display: "flex", gap: 16, marginBottom: 16, padding: 12, background: "var(--status-success-bg)", borderRadius: 8, fontSize: 12 }}>
                <span>🎯 {selectedIdentity.nextPromptInputs.targetCount || 0} targets</span>
                <span>💭 {selectedIdentity.nextPromptInputs.memoryCount || 0} memories</span>
              </div>
            )}

            <div
              style={{
                background: "var(--background)",
                border: "1px solid var(--border-default)",
                borderRadius: 10,
                padding: 20,
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                maxHeight: 500,
                overflow: "auto",
              }}
            >
              {selectedIdentity.nextPrompt}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Transcripts Section - shows all transcripts for this caller
function TranscriptsSection({ calls }: { calls: Call[] }) {
  const [expandedTranscript, setExpandedTranscript] = useState<string | null>(null);
  const [copiedButton, setCopiedButton] = useState<string | null>(null);
  const copyToClipboard = (text: string, buttonId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedButton(buttonId);
    setTimeout(() => setCopiedButton(null), 1500);
  };

  if (!calls || calls.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", background: "var(--background)", borderRadius: 12 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📜</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>No transcripts</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>No calls have been recorded for this caller</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {calls.map((call) => {
        const isExpanded = expandedTranscript === call.id;
        const wordCount = call.transcript?.split(/\s+/).length || 0;

        return (
          <div
            key={call.id}
            style={{
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <button
              onClick={() => setExpandedTranscript(isExpanded ? null : call.id)}
              style={{
                width: "100%",
                padding: 16,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 20 }}>📞</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {new Date(call.createdAt).toLocaleDateString()} at {new Date(call.createdAt).toLocaleTimeString()}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {call.source} • {wordCount} words
                    {call.externalId && ` • ${call.externalId}`}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* Analysis badges */}
                <div style={{ display: "flex", gap: 4 }}>
                  {call.hasScores && (
                    <span style={{ padding: "2px 6px", fontSize: 10, background: "var(--status-success-bg)", color: "var(--status-success-text)", borderRadius: 4 }}>
                      Scored
                    </span>
                  )}
                  {call.hasMemories && (
                    <span style={{ padding: "2px 6px", fontSize: 10, background: "var(--badge-blue-bg)", color: "var(--status-info-text)", borderRadius: 4 }}>
                      Memories
                    </span>
                  )}
                </div>
                <span style={{ color: "var(--text-placeholder)" }}>{isExpanded ? "▼" : "▶"}</span>
              </div>
            </button>

            {/* Transcript content */}
            {isExpanded && (
              <div style={{ borderTop: "1px solid var(--border-default)", padding: 16 }}>
                <div
                  style={{
                    background: "var(--surface-dark)",
                    color: "var(--text-on-dark)",
                    padding: 16,
                    borderRadius: 8,
                    fontSize: 13,
                    lineHeight: 1.8,
                    whiteSpace: "pre-wrap",
                    fontFamily: "ui-monospace, monospace",
                    maxHeight: 500,
                    overflowY: "auto",
                  }}
                >
                  {call.transcript || "No transcript content"}
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <button
                    onClick={() => copyToClipboard(call.transcript || "", `transcript-${call.id}`)}
                    style={{
                      padding: "8px 16px",
                      fontSize: 12,
                      background: copiedButton === `transcript-${call.id}` ? "var(--button-success-bg)" : "var(--button-primary-bg)",
                      color: "var(--text-on-dark)",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: copiedButton === `transcript-${call.id}` ? "0 0 12px var(--button-success-bg)" : "none",
                    }}
                  >
                    {copiedButton === `transcript-${call.id}` ? "✓ Copied" : "Copy Transcript"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
