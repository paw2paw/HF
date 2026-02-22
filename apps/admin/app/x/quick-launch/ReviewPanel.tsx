"use client";

import { useState, useCallback } from "react";
import type { AnalysisPreview, CommitOverrides } from "@/lib/domain/quick-launch";
import type { GeneratedIdentityConfig } from "@/lib/domain/generate-identity";
import { useTerminology } from "@/contexts/TerminologyContext";
import "./review-panel.css";

// ── Types ──────────────────────────────────────────

interface ReviewPanelProps {
  input: {
    subjectName: string;
    brief?: string;
    persona: string;
    personaName?: string;
    goals: string[];
    fileName?: string;
    fileSize?: number;
    qualificationRef?: string;
    mode?: "upload" | "generate";
    agentStyleTraits?: string[];
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
      className="rp-skeleton"
      style={{ width, height }}
    />
  );
}

// ── Section Card ───────────────────────────────────

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rp-section-card${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

// ── Column Header ──────────────────────────────────

function ColumnHeader({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <div className="rp-column-header">
      <div className={`rp-column-header-label${sublabel ? " rp-column-header-label-spaced" : ""}`}>
        {label}
      </div>
      {sublabel && (
        <div className="rp-column-header-sublabel">
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
    <div className="rp-field-group">
      <div className="rp-field-label">
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
            className="rp-field-textarea"
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
            autoFocus
            className="rp-field-input"
          />
        )
      ) : (
        <div
          onClick={() => setEditing(true)}
          className={`rp-field-display${multiline ? " rp-field-display-multiline" : ""}`}
        >
          {value || <span className="rp-field-placeholder">Click to edit...</span>}
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
    <div className="rp-field-group">
      <div className="rp-tag-label">
        {label}
      </div>
      <div className="rp-tag-wrap">
        {tags.map((tag, i) => (
          <span key={i} className="rp-tag">
            {tag}
            <button
              onClick={() => onChange(tags.filter((_, j) => j !== i))}
              className="rp-tag-remove"
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
            className="rp-tag-input"
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="rp-tag-add"
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
    <div className="rp-cat-row">
      <div className="rp-cat-label">
        {label}
      </div>
      <div className="rp-cat-track">
        <div
          className="rp-cat-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="rp-cat-count">
        {count}
      </div>
    </div>
  );
}

// ── Category Badge ─────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  fact: "var(--accent-primary, #2563eb)", key_fact: "var(--accent-primary, #2563eb)", reading_passage: "var(--accent-primary, #2563eb)", information: "var(--accent-primary, #2563eb)",
  definition: "var(--status-success-text, #059669)", vocabulary_item: "var(--status-success-text, #059669)", vocabulary_exercise: "var(--status-success-text, #059669)",
  question: "var(--accent-secondary, #7c3aed)", comprehension_question: "var(--accent-secondary, #7c3aed)", discussion_prompt: "var(--accent-secondary, #7c3aed)",
  answer: "var(--badge-cyan-text, #0891b2)", answer_key_item: "var(--badge-cyan-text, #0891b2)",
  true_false: "var(--status-warning-text, #d97706)", matching_exercise: "var(--status-warning-text, #d97706)", matching_item: "var(--status-warning-text, #d97706)",
  rule: "var(--status-error-text, #dc2626)", legal_requirement: "var(--status-error-text, #dc2626)", safety_point: "var(--status-error-text, #dc2626)",
  threshold: "var(--badge-orange-text, #ea580c)", process: "var(--badge-orange-text, #ea580c)", procedure: "var(--badge-orange-text, #ea580c)",
  example: "var(--badge-indigo-text, #6366f1)", concept: "var(--badge-indigo-text, #6366f1)", observation: "var(--badge-indigo-text, #6366f1)",
  learning_outcome: "var(--badge-cyan-text, #0d9488)", assessment_criterion: "var(--badge-cyan-text, #0d9488)",
  activity: "var(--accent-secondary, #8b5cf6)", starter: "var(--accent-secondary, #8b5cf6)", plenary: "var(--accent-secondary, #8b5cf6)",
};

function AssertionCategoryBadge({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] || "var(--text-muted)";
  const label = category.replace(/_/g, " ");
  return (
    <span
      className="rp-cat-badge"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      {label}
    </span>
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
  const { terms } = useTerminology();
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
    <div className="rp-container">
      {/* 3-column grid */}
      <div className="rp-grid">
        {/* ── Column 1: Your Input ── */}
        <div>
          <ColumnHeader label="Your Input" />
          <SectionCard>
            <div className="rp-section-mb">
              <div className="rp-input-label">Name</div>
              <div className="rp-input-name">{input.subjectName}</div>
            </div>

            {input.brief && (
              <div className="rp-section-mb">
                <div className="rp-input-label">Brief</div>
                <div className="rp-input-brief">{input.brief}</div>
              </div>
            )}

            <div className="rp-section-mb">
              <div className="rp-input-label">{terms.persona}</div>
              <div className="rp-input-persona">
                {input.personaName || input.persona}
              </div>
            </div>

            {input.goals.length > 0 && (
              <div className="rp-section-mb">
                <div className="rp-input-label rp-input-label-spaced">Learning Goals</div>
                <div className="rp-tag-wrap">
                  {input.goals.map((g, i) => (
                    <span key={i} className="rp-input-goal-chip">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className={input.qualificationRef ? "rp-section-mb" : ""}>
              <div className="rp-input-label">
                {input.mode === "generate" ? "Content Source" : "Source Material"}
              </div>
              {input.mode === "generate" ? (
                <div className="rp-input-source-ai">
                  AI-generated from goals
                </div>
              ) : (
                <>
                  <div className="rp-input-source-file">
                    {input.fileName}
                  </div>
                  {input.fileSize != null && (
                    <div className="rp-input-file-size">
                      {(input.fileSize / 1024).toFixed(0)} KB
                    </div>
                  )}
                </>
              )}
            </div>

            {input.qualificationRef && (
              <div className={input.agentStyleTraits?.length ? "rp-section-mb" : ""}>
                <div className="rp-input-label">Qualification</div>
                <div className="rp-input-qual">
                  {input.qualificationRef}
                </div>
              </div>
            )}

            {input.agentStyleTraits && input.agentStyleTraits.length > 0 && (
              <div>
                <div className="rp-input-label rp-input-label-spaced">Agent Style</div>
                <div className="rp-tag-wrap">
                  {input.agentStyleTraits.map((trait, i) => (
                    <span key={i} className="rp-style-trait">
                      {trait}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Column 2: AI Understood ── */}
        <div>
          <ColumnHeader label="AI Understood" sublabel={analysisComplete ? "Analysis complete" : "Analyzing..."} />

          {/* Content Extraction (upload mode) or Generation info (generate mode) */}
          <SectionCard className="rp-section-mb">
            {input.mode === "generate" ? (
              <>
                <div className="rp-section-heading">
                  AI-Generated Content
                </div>
                <div className="rp-gen-body">
                  Content will be generated during the create step based on your description and{" "}
                  {input.goals.length > 0
                    ? `${input.goals.length} learning goal${input.goals.length !== 1 ? "s" : ""}`
                    : "AI-inferred goals"
                  }.
                </div>
                <div className="rp-gen-note">
                  Modules will be structured progressively, with outcomes and assessment criteria tailored to your goals.
                </div>
              </>
            ) : (
              <>
                <div className="rp-section-heading">
                  Content Extraction
                </div>
                {summary && "categoryBreakdown" in summary ? (
                  <>
                    <div className="rp-extract-count">
                      {preview.assertionCount} teaching points
                    </div>
                    <div className="rp-extract-chapters">
                      from {(summary as any).chapters?.length ?? 0} chapter{(summary as any).chapters?.length !== 1 ? "s" : ""}
                    </div>

                    {/* Category breakdown */}
                    <div className="rp-section-mb">
                      {Object.entries((summary as any).categoryBreakdown || {})
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .map(([cat, count]) => (
                          <CategoryBar key={cat} label={cat} count={count as number} maxCount={maxCategoryCount} />
                        ))}
                    </div>

                    {/* Top chapters */}
                    {(summary as any).chapters?.length > 0 && (
                      <div>
                        <div className="rp-input-label rp-input-label-spaced">
                          Top Chapters
                        </div>
                        {(summary as any).chapters.slice(0, 6).map((ch: any, i: number) => (
                          <div key={i} className="rp-chapter-row">
                            <span className="rp-chapter-name">{ch.name}</span>
                            <span className="rp-chapter-count">{ch.count}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Sample teaching points */}
                    {(summary as any).sampleAssertions?.length > 0 && (
                      <div className="rp-sample-mt">
                        <div className="rp-input-label rp-input-label-spaced-md">
                          Sample Teaching Points
                        </div>
                        <div className="rp-sample-list">
                          {(summary as any).sampleAssertions.map((a: any, i: number) => (
                            <div key={i} className="rp-sample-row">
                              <AssertionCategoryBadge category={a.category} />
                              <div className="rp-sample-body">
                                <div
                                  className="rp-sample-text"
                                  title={a.assertion}
                                >
                                  {a.assertion}
                                </div>
                                {a.chapter && (
                                  <div className="rp-sample-chapter">
                                    {a.chapter}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {(preview.assertionCount || 0) > (summary as any).sampleAssertions.length && (
                          <div className="rp-sample-footer">
                            Showing {(summary as any).sampleAssertions.length} of {preview.assertionCount} teaching points
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rp-skeleton-group">
                    <Skeleton height={24} width="60%" />
                    <Skeleton height={14} width="40%" />
                    <div className="rp-skeleton-spacer-sm">
                      <Skeleton height={8} />
                      <div className="rp-skeleton-gap" />
                      <Skeleton height={8} width="80%" />
                      <div className="rp-skeleton-gap" />
                      <Skeleton height={8} width="60%" />
                    </div>
                  </div>
                )}
              </>
            )}
          </SectionCard>

          {/* Generated Identity */}
          <SectionCard>
            <div className="rp-section-heading">
              Generated Identity
            </div>
            {identity ? (
              <>
                <div className="rp-identity-quote">
                  &ldquo;{identity.roleStatement}&rdquo;
                </div>

                {identity.techniques?.length > 0 && (
                  <div className="rp-identity-section">
                    <div className="rp-input-label rp-input-label-spaced">
                      Teaching Techniques
                    </div>
                    <div className="rp-tag-wrap">
                      {identity.techniques.map((t, i) => (
                        <span key={i} className="rp-technique-tag">
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {identity.domainVocabulary?.length > 0 && (
                  <div>
                    <div className="rp-input-label rp-input-label-spaced">
                      Domain Vocabulary
                    </div>
                    <div className="rp-tag-wrap">
                      {identity.domainVocabulary.slice(0, 12).map((v, i) => (
                        <span key={i} className="rp-vocab-tag">
                          {v}
                        </span>
                      ))}
                      {identity.domainVocabulary.length > 12 && (
                        <span className="rp-vocab-more">
                          +{identity.domainVocabulary.length - 12} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rp-skeleton-group">
                <Skeleton height={14} />
                <Skeleton height={14} width="90%" />
                <Skeleton height={14} width="70%" />
                <div className="rp-skeleton-tags">
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
          <SectionCard className="rp-section-mb">
            <EditableField
              label="Agent Name"
              value={effectiveDomainName}
              onChange={(v) => updateOverride("domainName", v)}
            />

            <EditableField
              label="Agent Slug"
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
            <SectionCard className="rp-section-mb">
              <button
                onClick={() => setIdentityExpanded(!identityExpanded)}
                className="rp-expand-btn"
              >
                <div className="rp-expand-label">
                  Identity Config
                </div>
                <span className="rp-expand-icon">
                  {identityExpanded ? "\u25BE" : "\u25B8"}
                </span>
              </button>

              {!identityExpanded && (
                <div className="rp-identity-preview">
                  {(effectiveIdentity.roleStatement || "").slice(0, 100)}
                  {(effectiveIdentity.roleStatement || "").length > 100 ? "..." : ""}
                </div>
              )}

              {identityExpanded && (
                <div className="rp-identity-expanded">
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
                    label="Institution Vocabulary"
                    tags={effectiveIdentity.domainVocabulary || []}
                    onChange={(tags) => updateIdentityOverride("domainVocabulary", tags)}
                  />

                  <EditableTagList
                    label="Tone Traits"
                    tags={effectiveIdentity.toneTraits || []}
                    onChange={(tags) => updateIdentityOverride("toneTraits", tags)}
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
            <div className="rp-warning-box">
              {preview.warnings.map((w, i) => (
                <div key={i} className={`rp-warning-item${i < preview.warnings!.length - 1 ? " rp-warning-item-spaced" : ""}`}>
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="rp-actions">
            <button
              onClick={onBack}
              className="rp-back-btn"
            >
              Back
            </button>
            <button
              onClick={onConfirm}
              disabled={!analysisComplete}
              className={`rp-confirm-btn ${analysisComplete ? "rp-confirm-btn-active" : "rp-confirm-btn-disabled"}`}
            >
              {analysisComplete ? "Create" : "Waiting for analysis..."}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
