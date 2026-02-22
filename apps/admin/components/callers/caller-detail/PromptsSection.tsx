"use client";

import { useState } from "react";
import Link from "next/link";
import { AdvancedSection } from "@/components/shared/AdvancedSection";
import type { ComposedPrompt, CallerIdentity, CallerProfile, Memory } from "./types";

import { useEffect } from "react";
import { CATEGORY_COLORS } from "./constants";
import type { Call } from "./types";
import "./prompts-section.css";

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
      <div className="hf-empty hf-text-muted">Loading prompts...</div>
    );
  }

  if (!activePrompt) {
    return (
      <div className="hf-flex-col hf-gap-20">
        <div className="hf-empty-dashed">
          <div className="hf-empty-state-icon hf-mb-md">📝</div>
          <div className="hf-empty-state-title">No Prompt Available</div>
          <div className="hf-text-sm hf-text-muted hf-mt-sm hf-empty-hint-centered">
            Run the pipeline on a call to generate prompts. Use &quot;Prompt ALL&quot; or click 📝 on individual calls.
          </div>
        </div>
      </div>
    );
  }

  const llm = activePrompt.llmPrompt;

  return (
    <div className="hf-flex-col hf-gap-20">
      {/* Header with View Toggle */}
      <div className="hf-flex-between">
        <div>
          <h3 className="hf-heading-md">Next Prompt</h3>
          <p className="hf-text-sm hf-text-muted hf-mt-xs">
            Generated {new Date(activePrompt.composedAt).toLocaleString()} • {activePrompt.status.toUpperCase()}
          </p>
        </div>
        <div className="hf-flex hf-gap-sm">
          {/* Main View Toggle: Human vs LLM */}
          <div className="hf-toggle-group">
            <button
              onClick={() => setViewMode("human")}
              className={`hf-toggle-btn ${viewMode === "human" ? "hf-toggle-btn-active" : ""}`}
            >
              📖 Human-Readable
            </button>
            <button
              onClick={() => setViewMode("llm")}
              className={`hf-toggle-btn ${viewMode === "llm" ? "hf-toggle-btn-active" : ""}`}
            >
              🤖 LLM-Friendly
            </button>
          </div>
          <button onClick={onRefresh} className="hf-btn-icon">
            ↻
          </button>
        </div>
      </div>

      {/* Human-Readable View */}
      {viewMode === "human" && (
        <div className="hf-flex-col hf-gap-lg">
          {/* Prompt Content */}
          <div className="hf-code-block">
            {activePrompt.prompt}
          </div>

          {/* Composition Inputs */}
          {activePrompt.inputs && (
            <div className="hf-banner hf-banner-warning hf-banner-col">
              <div className="hf-text-xs hf-text-bold hf-text-warning hf-mb-sm">
                Composition Inputs
              </div>
              <div className="hf-flex-wrap hf-gap-md">
                {activePrompt.inputs.memoriesCount !== undefined && (
                  <span className="hf-text-sm hf-text-warning">
                    Memories: {activePrompt.inputs.memoriesCount}
                  </span>
                )}
                {activePrompt.inputs.personalityAvailable !== undefined && (
                  <span className="hf-text-sm hf-text-warning">
                    Personality: {activePrompt.inputs.personalityAvailable ? "Yes" : "No"}
                  </span>
                )}
                {activePrompt.inputs.recentCallsCount !== undefined && (
                  <span className="hf-text-sm hf-text-warning">
                    Recent Calls: {activePrompt.inputs.recentCallsCount}
                  </span>
                )}
                {activePrompt.inputs.behaviorTargetsCount !== undefined && (
                  <span className="hf-text-sm hf-text-warning">
                    Behavior Targets: {activePrompt.inputs.behaviorTargetsCount}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Copy Button */}
          <div className="hf-flex hf-gap-sm">
            <button
              onClick={() => copyToClipboard(activePrompt.prompt, "active-prompt")}
              className="hf-btn-copy ps-btn-copy-dynamic"
              data-copied={copiedButton === "active-prompt" ? "true" : undefined}
            >
              {copiedButton === "active-prompt" ? "✓ Copied" : "📋 Copy Prompt"}
            </button>
          </div>

          {/* Prompt History */}
          {prompts.length > 1 && (
            <div className="hf-mt-md">
              <div className="hf-label hf-text-muted hf-mb-sm">
                Prompt History ({prompts.length})
              </div>
              <div className="hf-flex-col hf-gap-sm">
                {prompts.slice(1, 5).map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setExpandedPrompt(expandedPrompt === p.id ? null : p.id)}
                    className="hf-prompt-history-item"
                  >
                    <div className="hf-flex-between">
                      <div className="hf-flex hf-gap-sm">
                        <span
                          className={`hf-micro-badge hf-uppercase ${p.status === "active" ? "ps-status-badge-active" : "ps-status-badge-default"}`}
                        >
                          {p.status}
                        </span>
                        <span className="hf-text-sm hf-text-secondary">
                          {new Date(p.composedAt).toLocaleString()}
                        </span>
                      </div>
                      <span className="hf-expand-toggle">{expandedPrompt === p.id ? "−" : "+"}</span>
                    </div>
                    {expandedPrompt === p.id && (
                      <div
                        className="hf-code-block-sm hf-mt-md ps-history-code"
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
        <div className="hf-flex-col hf-gap-lg">
          {!llm ? (
            <div className="hf-empty-dashed">
              <div className="hf-text-md hf-text-muted">
                No structured LLM data available for this prompt. Compose a new prompt to generate.
              </div>
            </div>
          ) : (
            <>
              {/* Pretty/Raw Toggle */}
              <div className="hf-flex-between">
                <span className="hf-text-sm hf-text-muted">Structured JSON for AI agent consumption</span>
                <div className="hf-flex hf-gap-sm">
                  <div className="hf-toggle-group">
                    <button
                      onClick={() => setLlmViewMode("pretty")}
                      className={`hf-toggle-btn hf-toggle-btn-sm ${llmViewMode === "pretty" ? "hf-toggle-btn-active" : ""}`}
                    >
                      Pretty
                    </button>
                    <button
                      onClick={() => setLlmViewMode("raw")}
                      className={`hf-toggle-btn hf-toggle-btn-sm ${llmViewMode === "raw" ? "hf-toggle-btn-active" : ""}`}
                    >
                      Raw JSON
                    </button>
                  </div>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(llm, null, 2), "llm-json-2")}
                    className="hf-btn hf-btn-xs ps-btn-json-copy"
                    data-copied={copiedButton === "llm-json-2" ? "true" : undefined}
                  >
                    {copiedButton === "llm-json-2" ? "✓ Copied" : "📋 Copy JSON"}
                  </button>
                </div>
              </div>

              {llmViewMode === "raw" ? (
                <div className="hf-code-block-raw">
                  {JSON.stringify(llm, null, 2)}
                </div>
              ) : (
                <div className="hf-flex-col hf-gap-md">
                  {/* Memories */}
                  {llm.memories && llm.memories.totalCount > 0 && (
                    <div className="hf-card-compact hf-mb-0">
                      <h4 className="hf-heading-sm ps-heading-cyan">
                        💭 Memories ({llm.memories.totalCount})
                      </h4>
                      <div className="hf-flex-col hf-gap-md">
                        {llm.memories.byCategory && Object.entries(llm.memories.byCategory).map(([category, items]: [string, any]) => (
                          <div key={category}>
                            <div className="hf-text-xs hf-text-bold hf-mb-xs" style={{ color: CATEGORY_COLORS[category]?.text || "var(--text-muted)" }}>
                              {category}
                            </div>
                            <div className="hf-flex-col hf-gap-xs">
                              {items.slice(0, 3).map((m: any, i: number) => (
                                <div
                                  key={i}
                                  className="hf-info-cell hf-text-sm"
                                  style={{
                                    background: CATEGORY_COLORS[category]?.bg || "var(--surface-secondary)",
                                  }}
                                >
                                  <span className="hf-text-bold">{m.key}:</span> {m.value}
                                  <span className="hf-text-xs hf-text-placeholder hf-ml-sm">
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
                    <div className="hf-card-compact hf-mb-0">
                      <h4 className="hf-heading-sm hf-text-success">
                        🎯 Behavior Targets ({llm.behaviorTargets.totalCount})
                      </h4>
                      <div className="hf-grid-3">
                        {llm.behaviorTargets.all?.slice(0, 9).map((t: any, i: number) => (
                          <div
                            key={i}
                            className={`hf-info-cell ${t.targetLevel === "HIGH" ? "ps-target-high" : t.targetLevel === "LOW" ? "ps-target-low" : "ps-target-neutral"}`}
                          >
                            <div className="hf-text-xs hf-text-500 hf-mb-xs">{t.name}</div>
                            <div
                              className={`hf-text-sm hf-text-bold ${t.targetLevel === "HIGH" ? "ps-target-text-high" : t.targetLevel === "LOW" ? "ps-target-text-low" : "ps-target-text-neutral"}`}
                            >
                              {t.targetLevel}
                            </div>
                            <div className="hf-text-xs hf-text-muted">
                              {(t.targetValue * 100).toFixed(0)}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Call History Summary */}
                  {llm.callHistory && llm.callHistory.totalCalls > 0 && (
                    <div className="hf-card-compact hf-mb-0">
                      <h4 className="hf-heading-sm ps-heading-indigo">
                        📞 Call History ({llm.callHistory.totalCalls} calls)
                      </h4>
                      <div className="hf-text-sm hf-text-muted">
                        Recent calls included in prompt context
                      </div>
                    </div>
                  )}

                  {/* AI Instructions */}
                  {llm.instructions && (
                    <div className="hf-callout-warning">
                      <h4 className="hf-heading-sm hf-text-warning">
                        📋 AI Instructions
                      </h4>
                      <div className="hf-flex-col hf-gap-sm hf-text-sm hf-text-warning">
                        {llm.instructions.use_memories && (
                          <div><strong>Memories:</strong> {llm.instructions.use_memories}</div>
                        )}
                        {llm.instructions.use_preferences && (
                          <div><strong>Preferences:</strong> {llm.instructions.use_preferences}</div>
                        )}
                        {llm.instructions.personality_adaptation?.length > 0 && (
                          <div>
                            <strong>Personality Adaptation:</strong>
                            <ul className="ps-adaptation-list">
                              {llm.instructions.personality_adaptation.map((tip: string, i: number) => (
                                <li key={i} className="hf-mb-xs">{tip}</li>
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
      <div className="hf-empty hf-text-muted">Loading prompts...</div>
    );
  }

  return (
    <div className="hf-flex-col hf-gap-20">
      {/* Header with actions */}
      <div className="hf-flex-between">
        <div>
          <h3 className="hf-heading-md">Composed Prompts</h3>
          <p className="hf-text-sm hf-text-muted hf-mt-xs">
            AI-generated next-call guidance prompts for this caller
          </p>
        </div>
        <div className="hf-flex hf-gap-sm">
          <button
            onClick={onRefresh}
            className="hf-btn hf-btn-secondary hf-btn-sm"
          >
            Refresh
          </button>
          <button
            onClick={onCompose}
            disabled={composing}
            className={`hf-btn hf-btn-primary hf-btn-sm ${composing ? "ps-btn-compose-disabled" : ""}`}
          >
            {composing ? "Composing..." : "Compose New Prompt"}
          </button>
        </div>
      </div>

      {prompts.length === 0 ? (
        <div className="hf-empty-dashed">
          <div className="hf-empty-state-icon ps-empty-icon-lg">📝</div>
          <div className="hf-text-md hf-text-muted">No prompts composed yet</div>
          <div className="hf-text-sm hf-text-placeholder hf-mt-xs">
            Click &quot;Compose New Prompt&quot; to generate a personalized next-call guidance prompt using AI
          </div>
        </div>
      ) : (
        <div className="hf-flex-col hf-gap-md">
          {prompts.map((prompt) => {
            const isExpanded = expandedPrompt === prompt.id;
            const statusColors = STATUS_COLORS[prompt.status] || STATUS_COLORS.superseded;

            return (
              <div
                key={prompt.id}
                className={`hf-prompt-card ${prompt.status === "active" ? "hf-prompt-card-active" : ""}`}
              >
                {/* Prompt Header */}
                <div
                  onClick={() => setExpandedPrompt(isExpanded ? null : prompt.id)}
                  className={`hf-prompt-card-header hf-flex-between ${prompt.status === "active" ? "hf-prompt-card-header-active" : ""}`}
                >
                  <div className="hf-flex hf-gap-md">
                    <span
                      className={`hf-micro-pill hf-uppercase ${prompt.status === "active" ? "ps-status-badge-active" : prompt.status === "expired" ? "ps-status-badge-expired" : "ps-status-badge-default"}`}
                    >
                      {prompt.status}
                    </span>
                    <span className="hf-text-md hf-text-bold hf-text-primary">
                      {new Date(prompt.composedAt).toLocaleString()}
                    </span>
                    <span className="hf-text-sm hf-text-secondary">
                      via {prompt.triggerType}
                    </span>
                    {prompt.model && (
                      <span className="hf-badge hf-badge-info hf-mono">
                        {prompt.model}
                      </span>
                    )}
                  </div>
                  <span className="hf-expand-toggle-lg">{isExpanded ? "−" : "+"}</span>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="hf-prompt-card-body">
                    {/* Prompt Preview */}
                    <div className="hf-code-block-sm">
                      {prompt.prompt}
                    </div>

                    {/* Metadata */}
                    {prompt.inputs && (
                      <div className="hf-banner hf-banner-warning hf-banner-col hf-mt-md">
                        <div className="hf-text-xs hf-text-bold hf-text-warning hf-mb-sm">
                          Composition Inputs
                        </div>
                        <div className="hf-flex-wrap hf-gap-md">
                          {prompt.inputs.memoriesCount !== undefined && (
                            <span className="hf-text-sm hf-text-warning">
                              Memories: {prompt.inputs.memoriesCount}
                            </span>
                          )}
                          {prompt.inputs.personalityAvailable !== undefined && (
                            <span className="hf-text-sm hf-text-warning">
                              Personality: {prompt.inputs.personalityAvailable ? "Yes" : "No"}
                            </span>
                          )}
                          {prompt.inputs.recentCallsCount !== undefined && (
                            <span className="hf-text-sm hf-text-warning">
                              Recent Calls: {prompt.inputs.recentCallsCount}
                            </span>
                          )}
                          {prompt.inputs.behaviorTargetsCount !== undefined && (
                            <span className="hf-text-sm hf-text-warning">
                              Behavior Targets: {prompt.inputs.behaviorTargetsCount}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Trigger Call Link */}
                    {prompt.triggerCall && (
                      <div className="hf-mt-sm">
                        <span className="hf-text-sm hf-text-secondary">
                          Triggered by call on {new Date(prompt.triggerCall.createdAt).toLocaleDateString()} ({prompt.triggerCall.source})
                        </span>
                      </div>
                    )}

                    {/* Copy Button */}
                    <div className="hf-flex hf-gap-sm hf-mt-md">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(prompt.prompt, `history-prompt-${prompt.id}`);
                        }}
                        className="hf-btn-copy ps-btn-copy-dynamic"
                        data-copied={copiedButton === `history-prompt-${prompt.id}` ? "true" : undefined}
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
      <div className="hf-empty hf-text-muted">Loading LLM prompt...</div>
    );
  }

  if (!activePrompt || !activePrompt.llmPrompt) {
    return (
      <div className="hf-flex-col hf-gap-20">
        <div className="hf-empty-dashed">
          <div className="hf-empty-state-icon hf-mb-md">🤖</div>
          <div className="hf-empty-state-title">No LLM Prompt Available</div>
          <div className="hf-text-sm hf-text-muted hf-mt-sm hf-empty-hint-centered">
            {!activePrompt
              ? "Compose a prompt first to generate structured LLM data."
              : "This prompt was created before the llmPrompt feature. Compose a new prompt to get structured JSON data."}
          </div>
          <button
            onClick={onCompose}
            disabled={composing}
            className={`hf-btn hf-btn-primary hf-mt-md ${composing ? "ps-btn-compose-disabled" : ""}`}
          >
            {composing ? "Composing..." : "Compose New Prompt"}
          </button>
        </div>
      </div>
    );
  }

  const llm = activePrompt.llmPrompt;

  return (
    <div className="hf-flex-col hf-gap-20">
      {/* Header */}
      <div className="hf-flex-between">
        <div>
          <h3 className="hf-heading-md">LLM-Friendly Prompt Data</h3>
          <p className="hf-text-sm hf-text-muted hf-mt-xs">
            Structured JSON for AI agent consumption • Generated {new Date(activePrompt.composedAt).toLocaleString()}
          </p>
        </div>
        <div className="hf-flex hf-gap-sm">
          <div className="hf-toggle-group">
            <button
              onClick={() => setViewMode("pretty")}
              className={`hf-toggle-btn hf-toggle-btn-sm ${viewMode === "pretty" ? "hf-toggle-btn-active" : ""}`}
            >
              Pretty
            </button>
            <button
              onClick={() => setViewMode("raw")}
              className={`hf-toggle-btn hf-toggle-btn-sm ${viewMode === "raw" ? "hf-toggle-btn-active" : ""}`}
            >
              Raw JSON
            </button>
          </div>
          <button
            onClick={() => copyToClipboard(JSON.stringify(llm, null, 2), "llm-json-3")}
            className="hf-btn hf-btn-xs ps-btn-json-copy"
            data-copied={copiedButton === "llm-json-3" ? "true" : undefined}
          >
            {copiedButton === "llm-json-3" ? "✓ Copied" : "📋 Copy JSON"}
          </button>
          <button
            onClick={onCompose}
            disabled={composing}
            className={`hf-btn hf-btn-primary hf-btn-xs ${composing ? "ps-btn-compose-disabled" : ""}`}
          >
            {composing ? "..." : "Refresh"}
          </button>
        </div>
      </div>

      {viewMode === "raw" ? (
        /* Raw JSON View */
        <div className="hf-code-block-raw">
          {JSON.stringify(llm, null, 2)}
        </div>
      ) : (
        /* Pretty View - structured sections */
        <div className="hf-flex-col hf-gap-lg">
          {/* Caller Info */}
          {llm.caller && (
            <div className="hf-card-compact hf-mb-0">
              <h4 className="hf-heading-sm ps-heading-primary">
                👤 Caller
              </h4>
              <div className="hf-grid-3 hf-gap-md">
                {llm.caller.name && (
                  <div className="hf-info-cell ps-cell-info">
                    <div className="hf-info-cell-label">Name</div>
                    <div className="hf-text-sm hf-text-bold">{llm.caller.name}</div>
                  </div>
                )}
                {llm.caller.contactInfo?.email && (
                  <div className="hf-info-cell ps-cell-info">
                    <div className="hf-info-cell-label">Email</div>
                    <div className="hf-text-sm hf-text-bold">{llm.caller.contactInfo.email}</div>
                  </div>
                )}
                {llm.caller.contactInfo?.phone && (
                  <div className="hf-info-cell ps-cell-info">
                    <div className="hf-info-cell-label">Phone</div>
                    <div className="hf-text-sm hf-text-bold">{llm.caller.contactInfo.phone}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Personality */}
          {llm.personality && (
            <div className="hf-card-compact hf-mb-0">
              <h4 className="hf-heading-sm ps-heading-personality">
                🧠 Personality Profile
              </h4>
              {llm.personality.traits && (
                <div className="hf-grid-5 hf-mb-md">
                  {Object.entries(llm.personality.traits).map(([trait, data]: [string, any]) => (
                    <div
                      key={trait}
                      className={`hf-info-cell hf-text-center ${data.level === "HIGH" ? "ps-trait-high" : data.level === "LOW" ? "ps-trait-low" : "ps-trait-neutral"}`}
                    >
                      <div className="hf-text-xs hf-text-bold hf-mb-xs hf-capitalize">
                        {trait}
                      </div>
                      <div
                        className={`hf-text-md hf-text-bold ${data.level === "HIGH" ? "ps-trait-text-high" : data.level === "LOW" ? "ps-trait-text-low" : "ps-trait-text-neutral"}`}
                      >
                        {data.level || "—"}
                      </div>
                      <div className="hf-text-xs hf-text-muted hf-mt-xs">
                        {data.score !== null ? `${(data.score * 100).toFixed(0)}%` : "N/A"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {llm.personality.preferences && Object.values(llm.personality.preferences).some((v) => v) && (
                <div className="hf-flex-wrap hf-gap-md">
                  {llm.personality.preferences.tone && (
                    <span className="hf-badge hf-badge-info">
                      Tone: {llm.personality.preferences.tone}
                    </span>
                  )}
                  {llm.personality.preferences.responseLength && (
                    <span className="hf-badge hf-badge-warning">
                      Length: {llm.personality.preferences.responseLength}
                    </span>
                  )}
                  {llm.personality.preferences.technicalLevel && (
                    <span className="hf-badge ps-badge-purple">
                      Tech: {llm.personality.preferences.technicalLevel}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Memories */}
          {llm.memories && llm.memories.totalCount > 0 && (
            <div className="hf-card-compact hf-mb-0">
              <h4 className="hf-heading-sm ps-heading-cyan">
                💭 Memories ({llm.memories.totalCount})
              </h4>
              <div className="hf-flex-col hf-gap-md">
                {llm.memories.byCategory && Object.entries(llm.memories.byCategory).map(([category, items]: [string, any]) => (
                  <div key={category}>
                    <div className="hf-text-xs hf-text-bold hf-mb-xs" style={{ color: CATEGORY_COLORS[category]?.text || "var(--text-muted)" }}>
                      {category}
                    </div>
                    <div className="hf-flex-col hf-gap-xs">
                      {items.slice(0, 3).map((m: any, i: number) => (
                        <div
                          key={i}
                          className="hf-info-cell hf-text-sm"
                          style={{
                            background: CATEGORY_COLORS[category]?.bg || "var(--surface-secondary)",
                          }}
                        >
                          <span className="hf-text-bold">{m.key}:</span> {m.value}
                          <span className="hf-text-xs hf-text-placeholder hf-ml-sm">
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
            <div className="hf-card-compact hf-mb-0">
              <h4 className="hf-heading-sm hf-text-success">
                🎯 Behavior Targets ({llm.behaviorTargets.totalCount})
              </h4>
              <div className="hf-grid-3">
                {llm.behaviorTargets.all?.slice(0, 9).map((t: any, i: number) => (
                  <div
                    key={i}
                    className={`hf-info-cell ${t.targetLevel === "HIGH" ? "ps-target-high" : t.targetLevel === "LOW" ? "ps-target-low" : "ps-target-neutral"}`}
                  >
                    <div className="hf-text-xs hf-text-500 hf-mb-xs">{t.name}</div>
                    <div
                      className={`hf-text-sm hf-text-bold ${t.targetLevel === "HIGH" ? "ps-target-text-high" : t.targetLevel === "LOW" ? "ps-target-text-low" : "ps-target-text-neutral"}`}
                    >
                      {t.targetLevel}
                    </div>
                    <div className="hf-text-xs hf-text-muted">
                      {(t.targetValue * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions Summary */}
          {llm.instructions && (
            <div className="hf-callout-warning">
              <h4 className="hf-heading-sm hf-text-warning">
                📋 AI Instructions
              </h4>
              <div className="hf-flex-col hf-gap-sm hf-text-sm hf-text-warning">
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
                    <ul className="ps-adaptation-list">
                      {llm.instructions.personality_adaptation.map((tip: string, i: number) => (
                        <li key={i} className="hf-mb-xs">{tip}</li>
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
      <div className="hf-grid hf-gap-20">
        {/* Caller Info Card */}
        <div className="hf-card-compact hf-mb-0 hf-p-lg">
          <h4 className="hf-heading-sm hf-mb-md">Caller Identification</h4>
          <div className="hf-grid-2">
            {caller.phone && (
              <div className="hf-info-cell-lg ps-cell-success">
                <div className="hf-text-xs hf-text-success hf-text-bold">Phone</div>
                <div className="hf-text-md hf-text-bold hf-text-success hf-mt-xs">{caller.phone}</div>
              </div>
            )}
            {caller.email && (
              <div className="hf-info-cell-lg ps-cell-info">
                <div className="hf-text-xs hf-text-bold ps-text-info">Email</div>
                <div className="hf-text-md hf-text-bold hf-mt-xs ps-text-info">{caller.email}</div>
              </div>
            )}
            {caller.externalId && (
              <div className="hf-info-cell-lg ps-cell-purple">
                <div className="hf-text-xs hf-text-bold ps-text-purple">External ID</div>
                <div className="hf-text-md hf-text-bold hf-mt-xs ps-text-purple">{caller.externalId}</div>
              </div>
            )}
            {caller.name && (
              <div className="hf-info-cell-lg ps-cell-warning">
                <div className="hf-text-xs hf-text-bold hf-text-warning">Name</div>
                <div className="hf-text-md hf-text-bold hf-text-warning hf-mt-xs">{caller.name}</div>
              </div>
            )}
          </div>
        </div>

        {/* Key Memories for Prompt Composition */}
        <div className="hf-card-compact hf-mb-0 hf-p-lg">
          <h4 className="hf-heading-sm hf-mb-md">Key Memories ({memories.length})</h4>
          {memories.length === 0 ? (
            <div className="hf-text-sm hf-text-center hf-text-placeholder hf-p-lg">
              No memories extracted yet. Run analysis on calls to extract memories.
            </div>
          ) : (
            <div className="hf-flex-col hf-gap-lg">
              {Object.entries(memoriesByCategory).map(([category, mems]) => (
                <div key={category}>
                  <div
                    className="hf-text-xs hf-text-bold hf-mb-sm"
                    style={{ color: CATEGORY_COLORS[category]?.text || "var(--text-muted)" }}
                  >
                    {category} ({mems.length})
                  </div>
                  <div className="hf-flex-col" style={{ gap: 6 }}>
                    {mems.slice(0, 5).map((m) => (
                      <div
                        key={m.id}
                        className="hf-info-cell hf-text-sm"
                        style={{
                          background: CATEGORY_COLORS[category]?.bg || "var(--surface-secondary)",
                        }}
                      >
                        <div className="hf-text-bold hf-mb-xs">{m.key}</div>
                        <div className="hf-text-secondary">{m.value}</div>
                      </div>
                    ))}
                    {mems.length > 5 && (
                      <div className="hf-text-xs hf-text-placeholder" style={{ padding: "4px 10px" }}>
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
        <div className="hf-callout-warning hf-p-lg">
          <div className="hf-flex hf-gap-md hf-items-start">
            <span style={{ fontSize: 24 }}>💡</span>
            <div>
              <div className="hf-text-md hf-text-bold hf-text-warning">No composed prompt yet</div>
              <div className="hf-text-sm hf-text-warning hf-mt-xs">
                To compose a personalized prompt for this caller, run the <code>prompt:compose-next</code> operation from the Ops page.
                This will combine their personality profile, memories, and behavior targets into a ready-to-use prompt.
              </div>
              <Link
                href="/ops"
                className="hf-btn hf-btn-primary hf-mt-sm hf-link-unstyled hf-inline-block"
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
      <div className="hf-card-compact">
        <h4 className="hf-text-sm hf-text-bold hf-mb-md">Identities ({identities.length})</h4>
        <div className="hf-flex-col hf-gap-sm">
          {identities.map((identity) => (
            <button
              key={identity.id}
              onClick={() => setSelectedIdentity(identity)}
              className={`hf-identity-btn ${selectedIdentity?.id === identity.id ? "hf-identity-btn-selected" : ""}`}
            >
              <div className="hf-text-sm hf-text-bold">
                {identity.name || identity.externalId || identity.id.slice(0, 8)}
              </div>
              {identity.segment && (
                <div className="hf-text-xs hf-text-muted hf-mt-xs">
                  {identity.segment.name}
                </div>
              )}
              <div className="hf-text-xs hf-mt-xs" style={{ color: identity.nextPrompt ? "var(--status-success-text)" : "var(--text-placeholder)" }}>
                {identity.nextPrompt ? "✓ Prompt ready" : "No prompt"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Prompt Display */}
      <div className="hf-card-compact hf-p-lg">
        {!selectedIdentity?.nextPrompt ? (
          <div className="hf-text-center" style={{ padding: 40 }}>
            <div className="hf-empty-state-icon hf-mb-md">✨</div>
            <div className="hf-empty-state-title">No prompt composed</div>
            <div className="hf-text-md hf-text-muted hf-mt-xs">
              Run prompt composition to generate a personalized prompt for this identity
            </div>
            <Link
              href="/ops"
              className="hf-btn hf-btn-primary hf-mt-md hf-link-unstyled hf-inline-block"
            >
              Go to Ops →
            </Link>
          </div>
        ) : (
          <div>
            <div className="hf-flex-between hf-mb-md">
              <div>
                <h3 className="hf-heading-lg">Composed Prompt</h3>
                <div className="hf-text-sm hf-text-placeholder hf-mt-xs">
                  {selectedIdentity.nextPromptComposedAt
                    ? `Composed ${new Date(selectedIdentity.nextPromptComposedAt).toLocaleString()}`
                    : ""}
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(selectedIdentity.nextPrompt || "", "next-prompt")}
                className="hf-btn hf-btn-sm"
                style={{
                  background: copiedButton === "next-prompt" ? "var(--button-success-bg)" : "var(--surface-secondary)",
                  color: copiedButton === "next-prompt" ? "white" : "inherit",
                  transition: "all 0.2s ease",
                  boxShadow: copiedButton === "next-prompt" ? "0 0 12px var(--button-success-bg)" : "none",
                }}
              >
                {copiedButton === "next-prompt" ? "✓ Copied" : "📋 Copy"}
              </button>
            </div>

            {selectedIdentity.nextPromptInputs && (
              <div className="hf-flex hf-gap-lg hf-mb-md hf-input-summary">
                <span>🎯 {selectedIdentity.nextPromptInputs.targetCount || 0} targets</span>
                <span>💭 {selectedIdentity.nextPromptInputs.memoryCount || 0} memories</span>
              </div>
            )}

            <div className="hf-prompt-display">
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
      <div className="hf-empty-dashed">
        <div className="hf-empty-state-icon hf-mb-md">📜</div>
        <div className="hf-empty-state-title">No transcripts</div>
        <div className="hf-text-md hf-text-muted hf-mt-xs">No calls have been recorded for this caller</div>
      </div>
    );
  }

  return (
    <div className="hf-flex-col hf-gap-md">
      {calls.map((call) => {
        const isExpanded = expandedTranscript === call.id;
        const wordCount = call.transcript?.split(/\s+/).length || 0;

        return (
          <div
            key={call.id}
            className="hf-transcript-card"
          >
            {/* Header */}
            <button
              onClick={() => setExpandedTranscript(isExpanded ? null : call.id)}
              className="hf-transcript-header-btn hf-flex-between"
            >
              <div className="hf-flex hf-gap-md">
                <span style={{ fontSize: 20 }}>📞</span>
                <div>
                  <div className="hf-text-md hf-text-bold">
                    {new Date(call.createdAt).toLocaleDateString()} at {new Date(call.createdAt).toLocaleTimeString()}
                  </div>
                  <div className="hf-text-sm hf-text-muted">
                    {call.source} • {wordCount} words
                    {call.externalId && ` • ${call.externalId}`}
                  </div>
                </div>
              </div>
              <div className="hf-flex hf-gap-md">
                {/* Analysis badges */}
                <div className="hf-flex hf-gap-xs">
                  {call.hasScores && (
                    <span className="hf-badge hf-badge-success hf-text-xs">
                      Scored
                    </span>
                  )}
                  {call.hasMemories && (
                    <span className="hf-badge hf-badge-info hf-text-xs">
                      Memories
                    </span>
                  )}
                </div>
                <span className="hf-text-placeholder">{isExpanded ? "▼" : "▶"}</span>
              </div>
            </button>

            {/* Transcript content */}
            {isExpanded && (
              <div className="hf-prompt-card-body">
                <div className="hf-code-block-sm">
                  {call.transcript || "No transcript content"}
                </div>
                <div className="hf-flex hf-gap-sm hf-mt-sm">
                  <button
                    onClick={() => copyToClipboard(call.transcript || "", `transcript-${call.id}`)}
                    className="hf-btn-copy"
                    style={{
                      background: copiedButton === `transcript-${call.id}` ? "var(--button-success-bg)" : "var(--button-primary-bg)",
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
