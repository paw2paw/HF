"use client";

import { useState, useCallback } from "react";
import type { AnalysisPreview, CommitOverrides } from "@/lib/domain/quick-launch";
import type { GeneratedIdentityConfig } from "@/lib/domain/generate-identity";

// ── Types ──────────────────────────────────────────

interface ReviewPanelProps {
  input: {
    subjectName: string;
    persona: string;
    personaName?: string;
    goals: string[];
    fileName?: string;
    fileSize?: number;
    qualificationRef?: string;
    mode?: "upload" | "generate";
  };
  /** Partial preview — fills progressively as SSE events arrive */
  preview: Partial<AnalysisPreview>;
  overrides: CommitOverrides;
  analysisComplete: boolean;
  onOverridesChange: (o: CommitOverrides) => void;
  onConfirm: () => void;
  onBack: () => void;
}

// ── Skeleton Loader ────────────────────────────────

function Skeleton({ width = "100%", height = 16 }: { width?: string | number; height?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 6,
        background: "var(--surface-tertiary)",
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

// ── Section Card ───────────────────────────────────

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "var(--surface-primary)",
        border: "1px solid var(--border-default)",
        borderRadius: 14,
        padding: 24,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Column Header ──────────────────────────────────

function ColumnHeader({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-muted)",
          marginBottom: sublabel ? 4 : 0,
        }}
      >
        {label}
      </div>
      {sublabel && (
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

// ── Editable Field ─────────────────────────────────

function EditableField({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-muted)",
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      {editing ? (
        multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            autoFocus
            rows={3}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "2px solid var(--accent-primary)",
              fontSize: 14,
              fontWeight: 500,
              background: "var(--surface-primary)",
              color: "var(--text-primary)",
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
            autoFocus
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "2px solid var(--accent-primary)",
              fontSize: 14,
              fontWeight: 500,
              background: "var(--surface-primary)",
              color: "var(--text-primary)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        )
      ) : (
        <div
          onClick={() => setEditing(true)}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid var(--border-default)",
            fontSize: 14,
            fontWeight: 500,
            color: "var(--text-primary)",
            cursor: "pointer",
            transition: "border-color 0.15s",
            minHeight: multiline ? 60 : "auto",
            whiteSpace: multiline ? "pre-wrap" : "normal",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
        >
          {value || <span style={{ color: "var(--text-muted)" }}>Click to edit...</span>}
        </div>
      )}
    </div>
  );
}

// ── Editable Tag List ──────────────────────────────

function EditableTagList({
  label,
  tags,
  onChange,
}: {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newTag, setNewTag] = useState("");

  const addTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setNewTag("");
    }
    setAdding(false);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-muted)",
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {tags.map((tag, i) => (
          <span
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 10px",
              borderRadius: 16,
              background: "var(--status-info-bg)",
              border: "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-primary)",
            }}
          >
            {tag}
            <button
              onClick={() => onChange(tags.filter((_, j) => j !== i))}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                fontSize: 14,
                lineHeight: 1,
                color: "var(--text-muted)",
                fontWeight: 700,
              }}
            >
              &times;
            </button>
          </span>
        ))}
        {adding ? (
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onBlur={addTag}
            onKeyDown={(e) => {
              if (e.key === "Enter") addTag();
              if (e.key === "Escape") { setAdding(false); setNewTag(""); }
            }}
            autoFocus
            placeholder="Type and press Enter"
            style={{
              padding: "5px 10px",
              borderRadius: 16,
              border: "2px solid var(--accent-primary)",
              fontSize: 13,
              fontWeight: 500,
              outline: "none",
              minWidth: 120,
              background: "var(--surface-primary)",
              color: "var(--text-primary)",
            }}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            style={{
              padding: "5px 10px",
              borderRadius: 16,
              border: "1px dashed var(--border-default)",
              background: "transparent",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            + Add
          </button>
        )}
      </div>
    </div>
  );
}

// ── Category Bar ───────────────────────────────────

function CategoryBar({ label, count, maxCount }: { label: string; count: number; maxCount: number }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <div style={{ width: 80, fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", textTransform: "capitalize" }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--surface-tertiary)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 4,
            background: "var(--accent-primary)",
            transition: "width 0.5s ease",
          }}
        />
      </div>
      <div style={{ width: 30, fontSize: 12, fontWeight: 600, color: "var(--text-primary)", textAlign: "right" }}>
        {count}
      </div>
    </div>
  );
}

// ── Main ReviewPanel ───────────────────────────────

export default function ReviewPanel({
  input,
  preview,
  overrides,
  analysisComplete,
  onOverridesChange,
  onConfirm,
  onBack,
}: ReviewPanelProps) {
  const [identityExpanded, setIdentityExpanded] = useState(false);

  const updateOverride = useCallback(
    <K extends keyof CommitOverrides>(key: K, value: CommitOverrides[K]) => {
      onOverridesChange({ ...overrides, [key]: value });
    },
    [overrides, onOverridesChange]
  );

  const updateIdentityOverride = useCallback(
    <K extends keyof GeneratedIdentityConfig>(key: K, value: GeneratedIdentityConfig[K]) => {
      onOverridesChange({
        ...overrides,
        identityConfig: { ...overrides.identityConfig, [key]: value },
      });
    },
    [overrides, onOverridesChange]
  );

  // Effective values (overrides take precedence)
  const effectiveDomainName = overrides.domainName ?? preview.domainName ?? input.subjectName;
  const effectiveDomainSlug = overrides.domainSlug ?? preview.domainSlug ?? "";
  const effectiveCallerName = overrides.callerName ?? `Test Caller — ${effectiveDomainName}`;
  const effectiveGoals = overrides.learningGoals ?? input.goals;

  const identity = preview.identityConfig;
  const effectiveIdentity = identity
    ? { ...identity, ...overrides.identityConfig }
    : null;

  const summary = preview.assertionSummary;
  const maxCategoryCount = summary
    ? Math.max(...Object.values(summary.categoryBreakdown))
    : 0;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px" }}>
      {/* 3-column grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.2fr 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* ── Column 1: Your Input ── */}
        <div>
          <ColumnHeader label="Your Input" />
          <SectionCard>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Subject</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{input.subjectName}</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Teaching Style</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                {input.personaName || input.persona}
              </div>
            </div>

            {input.goals.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Learning Goals</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {input.goals.map((g, i) => (
                    <span
                      key={i}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 16,
                        background: "var(--surface-secondary)",
                        border: "1px solid var(--border-default)",
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: input.qualificationRef ? 16 : 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {input.mode === "generate" ? "Curriculum Source" : "Course Material"}
              </div>
              {input.mode === "generate" ? (
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--accent-primary)" }}>
                  AI-generated from goals
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                    {input.fileName}
                  </div>
                  {input.fileSize != null && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {(input.fileSize / 1024).toFixed(0)} KB
                    </div>
                  )}
                </>
              )}
            </div>

            {input.qualificationRef && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Qualification</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                  {input.qualificationRef}
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Column 2: AI Understood ── */}
        <div>
          <ColumnHeader label="AI Understood" sublabel={analysisComplete ? "Analysis complete" : "Analyzing..."} />

          {/* Content Extraction (upload mode) or Generation info (generate mode) */}
          <SectionCard style={{ marginBottom: 16 }}>
            {input.mode === "generate" ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  AI-Generated Curriculum
                </div>
                <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  Curriculum will be generated during the create step based on your subject and{" "}
                  {input.goals.length > 0
                    ? `${input.goals.length} learning goal${input.goals.length !== 1 ? "s" : ""}`
                    : "AI-inferred goals"
                  }.
                </div>
                <div style={{
                  marginTop: 14,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "var(--surface-secondary)",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  fontWeight: 500,
                }}>
                  Modules will be created from foundational to advanced, with learning outcomes and assessment criteria.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Content Extraction
                </div>
                {summary && "categoryBreakdown" in summary ? (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
                      {preview.assertionCount} teaching points
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                      from {(summary as any).chapters?.length ?? 0} chapter{(summary as any).chapters?.length !== 1 ? "s" : ""}
                    </div>

                    {/* Category breakdown */}
                    <div style={{ marginBottom: 16 }}>
                      {Object.entries((summary as any).categoryBreakdown || {})
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .map(([cat, count]) => (
                          <CategoryBar key={cat} label={cat} count={count as number} maxCount={maxCategoryCount} />
                        ))}
                    </div>

                    {/* Top chapters */}
                    {(summary as any).chapters?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Top Chapters
                        </div>
                        {(summary as any).chapters.slice(0, 6).map((ch: any, i: number) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
                            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{ch.name}</span>
                            <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{ch.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <Skeleton height={24} width="60%" />
                    <Skeleton height={14} width="40%" />
                    <div style={{ marginTop: 8 }}>
                      <Skeleton height={8} />
                      <div style={{ height: 6 }} />
                      <Skeleton height={8} width="80%" />
                      <div style={{ height: 6 }} />
                      <Skeleton height={8} width="60%" />
                    </div>
                  </div>
                )}
              </>
            )}
          </SectionCard>

          {/* Generated Identity */}
          <SectionCard>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Generated Identity
            </div>
            {identity ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.6, marginBottom: 16, fontStyle: "italic" }}>
                  &ldquo;{identity.roleStatement}&rdquo;
                </div>

                {identity.techniques?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Teaching Techniques
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {identity.techniques.map((t, i) => (
                        <span
                          key={i}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 12,
                            background: "var(--surface-secondary)",
                            border: "1px solid var(--border-default)",
                            fontSize: 12,
                            fontWeight: 500,
                            color: "var(--text-primary)",
                          }}
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {identity.domainVocabulary?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Domain Vocabulary
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {identity.domainVocabulary.slice(0, 12).map((v, i) => (
                        <span
                          key={i}
                          style={{
                            padding: "3px 8px",
                            borderRadius: 8,
                            background: "var(--surface-tertiary)",
                            fontSize: 12,
                            fontWeight: 500,
                            color: "var(--text-secondary)",
                          }}
                        >
                          {v}
                        </span>
                      ))}
                      {identity.domainVocabulary.length > 12 && (
                        <span style={{ fontSize: 12, color: "var(--text-muted)", padding: "3px 0" }}>
                          +{identity.domainVocabulary.length - 12} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Skeleton height={14} />
                <Skeleton height={14} width="90%" />
                <Skeleton height={14} width="70%" />
                <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                  <Skeleton height={24} width={80} />
                  <Skeleton height={24} width={90} />
                  <Skeleton height={24} width={70} />
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Column 3: What We'll Create ── */}
        <div>
          <ColumnHeader label="What We'll Create" sublabel="Click any field to edit" />
          <SectionCard style={{ marginBottom: 16 }}>
            <EditableField
              label="Domain Name"
              value={effectiveDomainName}
              onChange={(v) => updateOverride("domainName", v)}
            />

            <EditableField
              label="Domain Slug"
              value={effectiveDomainSlug}
              onChange={(v) => updateOverride("domainSlug", v)}
            />

            <EditableField
              label="Caller Name"
              value={effectiveCallerName}
              onChange={(v) => updateOverride("callerName", v)}
            />

            <EditableTagList
              label="Learning Goals"
              tags={effectiveGoals}
              onChange={(tags) => updateOverride("learningGoals", tags)}
            />
          </SectionCard>

          {/* Identity Config (collapsible) */}
          {effectiveIdentity && (
            <SectionCard style={{ marginBottom: 16 }}>
              <button
                onClick={() => setIdentityExpanded(!identityExpanded)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Identity Config
                </div>
                <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  {identityExpanded ? "\u25BE" : "\u25B8"}
                </span>
              </button>

              {!identityExpanded && (
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8, lineHeight: 1.5 }}>
                  {(effectiveIdentity.roleStatement || "").slice(0, 100)}
                  {(effectiveIdentity.roleStatement || "").length > 100 ? "..." : ""}
                </div>
              )}

              {identityExpanded && (
                <div style={{ marginTop: 16 }}>
                  <EditableField
                    label="Role Statement"
                    value={effectiveIdentity.roleStatement || ""}
                    onChange={(v) => updateIdentityOverride("roleStatement", v)}
                    multiline
                  />

                  <EditableField
                    label="Primary Goal"
                    value={effectiveIdentity.primaryGoal || ""}
                    onChange={(v) => updateIdentityOverride("primaryGoal", v)}
                  />

                  <EditableTagList
                    label="Techniques"
                    tags={(effectiveIdentity.techniques || []).map((t) =>
                      typeof t === "string" ? t : t.name
                    )}
                    onChange={(tags) =>
                      updateIdentityOverride(
                        "techniques",
                        tags.map((name) => {
                          const existing = (identity?.techniques || []).find((t) => t.name === name);
                          return existing || { name, description: "", when: "" };
                        })
                      )
                    }
                  />

                  <EditableTagList
                    label="Domain Vocabulary"
                    tags={effectiveIdentity.domainVocabulary || []}
                    onChange={(tags) => updateIdentityOverride("domainVocabulary", tags)}
                  />

                  <EditableTagList
                    label="Style Guidelines"
                    tags={effectiveIdentity.styleGuidelines || []}
                    onChange={(tags) => updateIdentityOverride("styleGuidelines", tags)}
                  />

                  <EditableTagList
                    label="Does"
                    tags={effectiveIdentity.does || []}
                    onChange={(tags) => updateIdentityOverride("does", tags)}
                  />

                  <EditableTagList
                    label="Does Not"
                    tags={effectiveIdentity.doesNot || []}
                    onChange={(tags) => updateIdentityOverride("doesNot", tags)}
                  />
                </div>
              )}
            </SectionCard>
          )}

          {/* Warnings */}
          {preview.warnings && preview.warnings.length > 0 && (
            <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: "var(--status-warning-bg)", border: "1px solid var(--status-warning-border)", fontSize: 13 }}>
              {preview.warnings.map((w, i) => (
                <div key={i} style={{ color: "var(--status-warning-text)", marginBottom: i < preview.warnings!.length - 1 ? 4 : 0 }}>
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onBack}
              style={{
                padding: "14px 24px",
                borderRadius: 12,
                border: "2px solid var(--border-default)",
                background: "var(--surface-primary)",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Back
            </button>
            <button
              onClick={onConfirm}
              disabled={!analysisComplete}
              style={{
                flex: 1,
                padding: "14px 24px",
                borderRadius: 12,
                border: "none",
                background: analysisComplete
                  ? "linear-gradient(135deg, var(--accent-primary), #1d4ed8)"
                  : "var(--surface-tertiary)",
                color: analysisComplete ? "#fff" : "var(--text-muted)",
                fontSize: 16,
                fontWeight: 800,
                cursor: analysisComplete ? "pointer" : "not-allowed",
                transition: "all 0.2s",
                letterSpacing: "-0.02em",
                boxShadow: analysisComplete ? "0 4px 14px rgba(37, 99, 235, 0.35)" : "none",
              }}
            >
              {analysisComplete ? "Create" : "Waiting for analysis..."}
            </button>
          </div>
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
