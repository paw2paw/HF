"use client";

import { useState, useCallback } from "react";
import { ConfigField } from "@/components/config-editor/ConfigField";

// ============================================================================
// Types
// ============================================================================

export interface EnvelopeData {
  story?: { asA?: string; iWant?: string; soThat?: string };
  context?: { applies?: string; dependsOn?: string[]; assumptions?: string[] };
  acceptanceCriteria?: AcceptanceCriterion[];
  constraints?: Constraint[];
  related?: RelatedSpec[];
}

interface AcceptanceCriterion {
  id: string;
  title: string;
  given: string;
  when: string;
  then: string;
  measuredBy?: string[];
}

interface Constraint {
  id: string;
  type: string;
  description: string;
  severity: string;
}

interface RelatedSpec {
  id: string;
  title: string;
  relationship: string;
}

interface EnvelopeEditorProps {
  tab: "story" | "context" | "acceptance" | "constraints" | "related";
  envelope: EnvelopeData;
  onChange: (envelope: EnvelopeData) => void;
  disabled?: boolean;
}

// ============================================================================
// Sub-editors
// ============================================================================

function StoryEditor({
  story,
  onChange,
  disabled,
}: {
  story: EnvelopeData["story"];
  onChange: (s: EnvelopeData["story"]) => void;
  disabled?: boolean;
}) {
  const s = story || {};
  const update = (key: string, val: string) => onChange({ ...s, [key]: val });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary, #6b7280)", lineHeight: 1.5 }}>
        The user story describes who benefits from this orchestrator and why it exists.
      </div>
      {(["asA", "iWant", "soThat"] as const).map((key) => {
        const labels = { asA: "As a", iWant: "I want", soThat: "So that" };
        const placeholders = {
          asA: "e.g. pipeline orchestrator",
          iWant: "e.g. to define the order and grouping of pipeline stages",
          soThat: "e.g. specs are executed in the correct sequence",
        };
        return (
          <div key={key}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-secondary, #6b7280)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 4,
              }}
            >
              {labels[key]}
            </label>
            <textarea
              value={(s[key] as string) || ""}
              onChange={(e) => update(key, e.target.value)}
              disabled={disabled}
              placeholder={placeholders[key]}
              rows={key === "asA" ? 1 : 2}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--border-default, #e5e7eb)",
                background: "var(--surface-primary, #fff)",
                fontSize: 13,
                color: "var(--text-primary, #111827)",
                resize: "vertical",
                fontFamily: "inherit",
                lineHeight: 1.5,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function ContextEditor({
  context,
  onChange,
  disabled,
}: {
  context: EnvelopeData["context"];
  onChange: (c: EnvelopeData["context"]) => void;
  disabled?: boolean;
}) {
  const c = context || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label style={labelStyle}>Applies</label>
        <textarea
          value={c.applies || ""}
          onChange={(e) => onChange({ ...c, applies: e.target.value })}
          disabled={disabled}
          placeholder="When does this orchestrator run?"
          rows={2}
          style={textareaStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Depends On</label>
        <ConfigField
          fieldKey="dependsOn"
          value={c.dependsOn || []}
          onChange={(val) => onChange({ ...c, dependsOn: val as string[] })}
          disabled={disabled}
        />
      </div>
      <div>
        <label style={labelStyle}>Assumptions</label>
        <ConfigField
          fieldKey="assumptions"
          value={c.assumptions || []}
          onChange={(val) => onChange({ ...c, assumptions: val as string[] })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function AcceptanceCriteriaEditor({
  criteria,
  onChange,
  disabled,
}: {
  criteria: AcceptanceCriterion[];
  onChange: (c: AcceptanceCriterion[]) => void;
  disabled?: boolean;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const updateCriterion = (idx: number, updates: Partial<AcceptanceCriterion>) => {
    onChange(criteria.map((c, i) => (i === idx ? { ...c, ...updates } : c)));
  };

  const addCriterion = () => {
    const nextId = `AC-${(criteria.length + 1).toString().padStart(2, "0")}`;
    onChange([...criteria, { id: nextId, title: "", given: "", when: "", then: "", measuredBy: [] }]);
    setExpandedIdx(criteria.length);
  };

  const removeCriterion = (idx: number) => {
    onChange(criteria.filter((_, i) => i !== idx));
    setExpandedIdx(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
        Given-When-Then acceptance criteria define testable behaviors.
      </div>
      {criteria.map((ac, idx) => {
        const isExpanded = expandedIdx === idx;
        return (
          <div
            key={ac.id || idx}
            style={{
              border: "1px solid var(--border-default, #e5e7eb)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <div
              onClick={() => setExpandedIdx(isExpanded ? null : idx)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                cursor: "pointer",
                background: isExpanded ? "var(--surface-secondary, #f9fafb)" : "var(--surface-primary, #fff)",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--accent-primary, #3b82f6)",
                  background: "color-mix(in srgb, var(--accent-primary, #3b82f6) 10%, transparent)",
                  padding: "2px 6px",
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              >
                {ac.id}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {ac.title || "Untitled criterion"}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                {isExpanded ? "▾" : "▸"}
              </span>
            </div>
            {isExpanded && (
              <div
                style={{
                  padding: "12px",
                  borderTop: "1px solid var(--border-default, #e5e7eb)",
                  background: "var(--surface-secondary, #f9fafb)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <input
                  value={ac.title}
                  onChange={(e) => updateCriterion(idx, { title: e.target.value })}
                  disabled={disabled}
                  placeholder="Title"
                  style={{ ...inputStyle, fontWeight: 600 }}
                />
                {(["given", "when", "then"] as const).map((gwt) => {
                  const colors = { given: "#22c55e", when: "#3b82f6", then: "#f59e0b" };
                  return (
                    <div key={gwt} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: colors[gwt],
                          width: 44,
                          flexShrink: 0,
                          paddingTop: 8,
                        }}
                      >
                        {gwt}
                      </span>
                      <textarea
                        value={ac[gwt]}
                        onChange={(e) => updateCriterion(idx, { [gwt]: e.target.value })}
                        disabled={disabled}
                        rows={2}
                        style={{
                          ...textareaStyle,
                          borderLeft: `3px solid ${colors[gwt]}`,
                        }}
                      />
                    </div>
                  );
                })}
                <div>
                  <label style={labelStyle}>Measured By</label>
                  <ConfigField
                    fieldKey="measuredBy"
                    value={ac.measuredBy || []}
                    onChange={(val) => updateCriterion(idx, { measuredBy: val as string[] })}
                    disabled={disabled}
                  />
                </div>
                {!disabled && (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={() => removeCriterion(idx)} style={dangerButtonStyle}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {!disabled && (
        <button onClick={addCriterion} style={addButtonStyle}>
          + Add Criterion
        </button>
      )}
    </div>
  );
}

function ConstraintsEditor({
  constraints,
  onChange,
  disabled,
}: {
  constraints: Constraint[];
  onChange: (c: Constraint[]) => void;
  disabled?: boolean;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const severityColors: Record<string, { bg: string; text: string }> = {
    critical: { bg: "#fef2f2", text: "#dc2626" },
    error: { bg: "#fef2f2", text: "#dc2626" },
    warning: { bg: "#fffbeb", text: "#d97706" },
    info: { bg: "#f0f9ff", text: "#0284c7" },
  };

  const updateConstraint = (idx: number, updates: Partial<Constraint>) => {
    onChange(constraints.map((c, i) => (i === idx ? { ...c, ...updates } : c)));
  };

  const addConstraint = () => {
    const nextId = `C-${(constraints.length + 1).toString().padStart(2, "0")}`;
    onChange([...constraints, { id: nextId, type: "", description: "", severity: "warning" }]);
    setExpandedIdx(constraints.length);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {constraints.map((con, idx) => {
        const isExpanded = expandedIdx === idx;
        const sevColor = severityColors[con.severity] || severityColors.warning;
        return (
          <div
            key={con.id || idx}
            style={{
              border: "1px solid var(--border-default, #e5e7eb)",
              borderRadius: 10,
              borderLeft: `3px solid ${sevColor.text}`,
              overflow: "hidden",
            }}
          >
            <div
              onClick={() => setExpandedIdx(isExpanded ? null : idx)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  background: sevColor.bg,
                  color: sevColor.text,
                  padding: "2px 6px",
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              >
                {con.severity || "warning"}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-primary)", flex: 1 }}>
                {con.description || con.type || "Untitled constraint"}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                {isExpanded ? "▾" : "▸"}
              </span>
            </div>
            {isExpanded && (
              <div
                style={{
                  padding: 12,
                  borderTop: "1px solid var(--border-default, #e5e7eb)",
                  background: "var(--surface-secondary, #f9fafb)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>ID</label>
                    <input
                      value={con.id}
                      onChange={(e) => updateConstraint(idx, { id: e.target.value })}
                      disabled={disabled}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Type</label>
                    <input
                      value={con.type}
                      onChange={(e) => updateConstraint(idx, { type: e.target.value })}
                      disabled={disabled}
                      style={inputStyle}
                      placeholder="ordering, completeness, etc."
                    />
                  </div>
                  <div style={{ width: 120 }}>
                    <label style={labelStyle}>Severity</label>
                    <select
                      value={con.severity}
                      onChange={(e) => updateConstraint(idx, { severity: e.target.value })}
                      disabled={disabled}
                      style={{ ...inputStyle, cursor: "pointer" }}
                    >
                      <option value="critical">Critical</option>
                      <option value="error">Error</option>
                      <option value="warning">Warning</option>
                      <option value="info">Info</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Description</label>
                  <textarea
                    value={con.description}
                    onChange={(e) => updateConstraint(idx, { description: e.target.value })}
                    disabled={disabled}
                    rows={3}
                    style={textareaStyle}
                  />
                </div>
                {!disabled && (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => {
                        onChange(constraints.filter((_, i) => i !== idx));
                        setExpandedIdx(null);
                      }}
                      style={dangerButtonStyle}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {!disabled && (
        <button onClick={addConstraint} style={addButtonStyle}>
          + Add Constraint
        </button>
      )}
    </div>
  );
}

function RelatedSpecsEditor({
  related,
  onChange,
  disabled,
}: {
  related: RelatedSpec[];
  onChange: (r: RelatedSpec[]) => void;
  disabled?: boolean;
}) {
  const updateRelated = (idx: number, updates: Partial<RelatedSpec>) => {
    onChange(related.map((r, i) => (i === idx ? { ...r, ...updates } : r)));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
        Specs that this orchestrator depends on or interacts with.
      </div>
      {related.map((rel, idx) => (
        <div
          key={idx}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: "8px 12px",
            border: "1px solid var(--border-default, #e5e7eb)",
            borderRadius: 10,
            background: "var(--surface-primary, #fff)",
          }}
        >
          <input
            value={rel.id}
            onChange={(e) => updateRelated(idx, { id: e.target.value })}
            disabled={disabled}
            placeholder="SPEC-ID"
            style={{ ...inputStyle, width: 140, fontWeight: 600, fontFamily: "monospace", fontSize: 11 }}
          />
          <input
            value={rel.title}
            onChange={(e) => updateRelated(idx, { title: e.target.value })}
            disabled={disabled}
            placeholder="Title"
            style={{ ...inputStyle, flex: 1 }}
          />
          <input
            value={rel.relationship}
            onChange={(e) => updateRelated(idx, { relationship: e.target.value })}
            disabled={disabled}
            placeholder="Relationship"
            style={{ ...inputStyle, flex: 1 }}
          />
          {!disabled && (
            <button
              onClick={() => onChange(related.filter((_, i) => i !== idx))}
              style={{
                border: "none",
                background: "none",
                color: "#dc2626",
                cursor: "pointer",
                fontSize: 14,
                padding: 4,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          onClick={() => onChange([...related, { id: "", title: "", relationship: "" }])}
          style={addButtonStyle}
        >
          + Add Related Spec
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Main Envelope Editor
// ============================================================================

export function EnvelopeEditor({ tab, envelope, onChange, disabled }: EnvelopeEditorProps) {
  const updateEnvelope = useCallback(
    (key: keyof EnvelopeData, value: unknown) => {
      onChange({ ...envelope, [key]: value });
    },
    [envelope, onChange],
  );

  switch (tab) {
    case "story":
      return (
        <StoryEditor
          story={envelope.story}
          onChange={(s) => updateEnvelope("story", s)}
          disabled={disabled}
        />
      );
    case "context":
      return (
        <ContextEditor
          context={envelope.context}
          onChange={(c) => updateEnvelope("context", c)}
          disabled={disabled}
        />
      );
    case "acceptance":
      return (
        <AcceptanceCriteriaEditor
          criteria={(envelope.acceptanceCriteria as AcceptanceCriterion[]) || []}
          onChange={(c) => updateEnvelope("acceptanceCriteria", c)}
          disabled={disabled}
        />
      );
    case "constraints":
      return (
        <ConstraintsEditor
          constraints={(envelope.constraints as Constraint[]) || []}
          onChange={(c) => updateEnvelope("constraints", c)}
          disabled={disabled}
        />
      );
    case "related":
      return (
        <RelatedSpecsEditor
          related={(envelope.related as RelatedSpec[]) || []}
          onChange={(r) => updateEnvelope("related", r)}
          disabled={disabled}
        />
      );
    default:
      return null;
  }
}

// ============================================================================
// Shared styles
// ============================================================================

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-secondary, #6b7280)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid var(--border-default, #e5e7eb)",
  background: "var(--surface-primary, #fff)",
  fontSize: 12,
  color: "var(--text-primary, #111827)",
  fontFamily: "inherit",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border-default, #e5e7eb)",
  background: "var(--surface-primary, #fff)",
  fontSize: 13,
  color: "var(--text-primary, #111827)",
  resize: "vertical",
  fontFamily: "inherit",
  lineHeight: 1.5,
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid #fca5a5",
  background: "#fef2f2",
  fontSize: 11,
  color: "#dc2626",
  cursor: "pointer",
  fontWeight: 500,
};

const addButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px dashed var(--border-default, #d1d5db)",
  background: "none",
  fontSize: 12,
  cursor: "pointer",
  color: "var(--text-secondary, #6b7280)",
  width: "100%",
  fontWeight: 500,
  transition: "all 0.15s",
};
