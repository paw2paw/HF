"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, GripVertical, RotateCcw, Save, ChevronDown, ChevronUp } from "lucide-react";
import { SortableList } from "@/components/shared/SortableList";
import { reorderItems } from "@/lib/sortable/reorder";

// ------------------------------------------------------------------
// Types (mirror resolve-config.ts)
// ------------------------------------------------------------------

interface PyramidLevel {
  depth: number;
  label: string;
  maxChildren: number;
  renderAs: "paragraph" | "heading" | "subheading" | "bold" | "bullet";
  description?: string;
}

interface ExtractionCategory {
  id: string;
  label: string;
  description: string;
}

interface ExtractionConfig {
  extraction: {
    systemPrompt: string;
    categories: ExtractionCategory[];
    llmConfig: { temperature: number; maxTokens: number };
    chunkSize: number;
    maxAssertionsPerDocument: number;
    rules: {
      requirePrecision: string[];
      noInvention: boolean;
      trackTaxYear: boolean;
      trackValidity: boolean;
    };
  };
  structuring: {
    systemPrompt: string;
    levels: PyramidLevel[];
    targetChildCount: number;
    llmConfig: { temperature: number; maxTokens: number };
  };
  rendering: {
    defaultMaxDepth: number;
    depthAdaptation: {
      entryLevel: number;
      fastPace: number;
      advancedPriorKnowledge: number;
    };
  };
}

const RENDER_AS_OPTIONS: { value: PyramidLevel["renderAs"]; label: string; preview: string }[] = [
  { value: "paragraph", label: "Paragraph", preview: "¶" },
  { value: "heading", label: "Heading", preview: "H" },
  { value: "subheading", label: "Subheading", preview: "h" },
  { value: "bold", label: "Bold", preview: "B" },
  { value: "bullet", label: "Bullet", preview: "•" },
];

// ------------------------------------------------------------------
// Page Component
// ------------------------------------------------------------------

export default function ExtractionConfigPage() {
  const params = useParams();
  const router = useRouter();
  const domainId = params.domainId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [domainName, setDomainName] = useState("");

  // The full merged config (system + domain override)
  const [config, setConfig] = useState<ExtractionConfig | null>(null);
  // Whether a domain override currently exists
  const [hasOverride, setHasOverride] = useState(false);
  // The original merged config for diff/reset detection
  const [originalConfig, setOriginalConfig] = useState<ExtractionConfig | null>(null);

  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    pyramid: true,
    categories: false,
    rules: false,
    prompts: false,
    adaptation: true,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ------------------------------------------------------------------
  // Load
  // ------------------------------------------------------------------

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [configRes, domainRes] = await Promise.all([
        fetch(`/api/domains/${domainId}/extraction-config`),
        fetch(`/api/domains/${domainId}`),
      ]);

      if (!configRes.ok) {
        const data = await configRes.json();
        throw new Error(data.error || "Failed to load extraction config");
      }

      const configData = await configRes.json();
      setConfig(configData.config);
      setOriginalConfig(configData.config);
      setHasOverride(configData.hasOverride);

      if (domainRes.ok) {
        const domainData = await domainRes.json();
        setDomainName(domainData.name || "Domain");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [domainId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // ------------------------------------------------------------------
  // Save
  // ------------------------------------------------------------------

  const handleSave = async () => {
    if (!config) return;
    try {
      setSaving(true);
      setSaveMessage(null);
      setError(null);

      // Build override: only send the parts that differ from system defaults
      const overrideConfig: Partial<ExtractionConfig> = {
        extraction: config.extraction,
        structuring: config.structuring,
        rendering: config.rendering,
      };

      const res = await fetch(`/api/domains/${domainId}/extraction-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: overrideConfig }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      setConfig(data.config);
      setOriginalConfig(data.config);
      setHasOverride(data.hasOverride);
      setSaveMessage("Saved successfully");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset to system defaults? This will remove all domain-level overrides.")) return;
    try {
      setSaving(true);
      setSaveMessage(null);
      setError(null);

      const res = await fetch(`/api/domains/${domainId}/extraction-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: null }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset");

      setConfig(data.config);
      setOriginalConfig(data.config);
      setHasOverride(false);
      setSaveMessage("Reset to system defaults");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------------
  // Level mutations
  // ------------------------------------------------------------------

  const updateLevel = (index: number, updates: Partial<PyramidLevel>) => {
    if (!config) return;
    const levels = [...config.structuring.levels];
    levels[index] = { ...levels[index], ...updates };
    // Re-sync depth values to match array position
    levels.forEach((l, i) => (l.depth = i));
    setConfig({
      ...config,
      structuring: { ...config.structuring, levels },
    });
  };

  const addLevel = () => {
    if (!config) return;
    const levels = [...config.structuring.levels];
    const newDepth = levels.length;
    levels.push({
      depth: newDepth,
      label: "detail",
      maxChildren: 4,
      renderAs: "bullet",
      description: "Additional detail level",
    });
    setConfig({
      ...config,
      structuring: { ...config.structuring, levels },
    });
  };

  const removeLevel = (index: number) => {
    if (!config || config.structuring.levels.length <= 2) return;
    const levels = config.structuring.levels.filter((_, i) => i !== index);
    levels.forEach((l, i) => (l.depth = i));
    setConfig({
      ...config,
      structuring: { ...config.structuring, levels },
    });
  };

  const reorderLevel = (fromIndex: number, toIndex: number) => {
    if (!config) return;
    const levels = reorderItems(config.structuring.levels, fromIndex, toIndex);
    levels.forEach((l, i) => (l.depth = i));
    setConfig({
      ...config,
      structuring: { ...config.structuring, levels },
    });
  };

  // ------------------------------------------------------------------
  // Category mutations
  // ------------------------------------------------------------------

  const updateCategory = (index: number, updates: Partial<ExtractionCategory>) => {
    if (!config) return;
    const categories = [...config.extraction.categories];
    categories[index] = { ...categories[index], ...updates };
    setConfig({
      ...config,
      extraction: { ...config.extraction, categories },
    });
  };

  const addCategory = () => {
    if (!config) return;
    const categories = [...config.extraction.categories];
    categories.push({ id: "new_category", label: "New Category", description: "Description" });
    setConfig({
      ...config,
      extraction: { ...config.extraction, categories },
    });
  };

  const removeCategory = (index: number) => {
    if (!config) return;
    const categories = config.extraction.categories.filter((_, i) => i !== index);
    setConfig({
      ...config,
      extraction: { ...config.extraction, categories },
    });
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        Loading extraction config...
      </div>
    );
  }

  if (error && !config) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ color: "var(--status-error-text)", marginBottom: 16 }}>{error}</div>
        <button onClick={() => router.push("/x/domains")} style={linkButtonStyle}>
          ← Back to Domains
        </button>
      </div>
    );
  }

  if (!config) return null;

  const levels = config.structuring.levels;
  const isDirty = JSON.stringify(config) !== JSON.stringify(originalConfig);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "16px 24px",
        borderBottom: "1px solid var(--border-default)",
        background: "var(--surface-primary)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href={`/x/domains?id=${domainId}`}
            style={{ color: "var(--text-muted)", textDecoration: "none", display: "flex", alignItems: "center" }}
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="hf-section-title">Extraction Config</h1>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {domainName}
              {hasOverride && (
                <span style={{
                  marginLeft: 8,
                  padding: "1px 6px",
                  fontSize: 10,
                  fontWeight: 600,
                  background: "var(--badge-purple-bg)",
                  color: "var(--badge-purple-text)",
                  borderRadius: 4,
                }}>
                  OVERRIDE
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {saveMessage && (
            <span style={{ fontSize: 13, color: "var(--status-success-text)", fontWeight: 500 }}>{saveMessage}</span>
          )}
          {error && (
            <span style={{ fontSize: 13, color: "var(--status-error-text)" }}>{error}</span>
          )}
          {hasOverride && (
            <button onClick={handleReset} disabled={saving} style={secondaryButtonStyle}>
              <RotateCcw size={14} />
              Reset to Defaults
            </button>
          )}
          <button onClick={handleSave} disabled={saving || !isDirty} style={primaryButtonStyle}>
            <Save size={14} />
            {saving ? "Saving..." : "Save Override"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          {/* ── Pyramid Structure Section ── */}
          <CollapsibleSection
            title="Pyramid Structure"
            subtitle={`${levels.length} levels, target ~${config.structuring.targetChildCount} children per node`}
            expanded={expandedSections.pyramid}
            onToggle={() => toggleSection("pyramid")}
          >
            {/* Visual pyramid preview */}
            <div style={{
              padding: 20,
              background: "var(--surface-secondary)",
              borderRadius: 8,
              marginBottom: 20,
              fontFamily: "monospace",
              fontSize: 13,
              lineHeight: 1.8,
            }}>
              {levels.map((level, i) => {
                const indent = i * 24;
                const renderIcon = RENDER_AS_OPTIONS.find((o) => o.value === level.renderAs)?.preview || "?";
                const isLast = i === levels.length - 1;
                return (
                  <div key={i} style={{ paddingLeft: indent }}>
                    <span style={{ color: "var(--text-muted)" }}>
                      {i === 0 ? "┌" : isLast ? "└" : "├"}{"─ "}
                    </span>
                    <span style={{ fontWeight: 600 }}>{level.label}</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {" ── max: "}{level.maxChildren}{" ── "}
                    </span>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 18,
                      height: 18,
                      borderRadius: 3,
                      background: "var(--surface-tertiary)",
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      {renderIcon}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Level editors */}
            <SortableList
              items={levels}
              getItemId={(level) => `level-${level.depth}-${level.label}`}
              onReorder={reorderLevel}
              onRemove={removeLevel}
              onAdd={addLevel}
              addLabel="+ Add Level"
              minItems={2}
              renderCard={(level, index) => (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }} onClick={(e) => e.stopPropagation()}>
                  {/* Depth badge */}
                  <span style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "var(--surface-tertiary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    flexShrink: 0,
                  }}>
                    {index}
                  </span>

                  {/* Label */}
                  <input
                    type="text"
                    value={level.label}
                    onChange={(e) => updateLevel(index, { label: e.target.value })}
                    style={{ ...inputStyle, width: 120, fontWeight: 600 }}
                    placeholder="Level label"
                  />

                  {/* Max children */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>max</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={level.maxChildren}
                      onChange={(e) => updateLevel(index, { maxChildren: parseInt(e.target.value) || 1 })}
                      style={{ ...inputStyle, width: 50, textAlign: "center" }}
                    />
                  </div>

                  {/* Render as */}
                  <select
                    value={level.renderAs}
                    onChange={(e) => updateLevel(index, { renderAs: e.target.value as PyramidLevel["renderAs"] })}
                    style={{ ...inputStyle, width: 110 }}
                  >
                    {RENDER_AS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>

                  {/* Description */}
                  <input
                    type="text"
                    value={level.description || ""}
                    onChange={(e) => updateLevel(index, { description: e.target.value })}
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="Description"
                  />
                </div>
              )}
            />

            {/* Target children */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Target children per node:</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={config.structuring.targetChildCount}
                  onChange={(e) => setConfig({
                    ...config,
                    structuring: { ...config.structuring, targetChildCount: parseInt(e.target.value) || 3 },
                  })}
                  style={{ ...inputStyle, width: 50, textAlign: "center" }}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* ── Depth Adaptation Section ── */}
          <CollapsibleSection
            title="Depth Adaptation"
            subtitle="Adjust rendering depth based on learner signals"
            expanded={expandedSections.adaptation}
            onToggle={() => toggleSection("adaptation")}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)", width: 160 }}>Default max depth:</span>
                <input
                  type="number"
                  min={1}
                  max={levels.length}
                  value={config.rendering.defaultMaxDepth}
                  onChange={(e) => setConfig({
                    ...config,
                    rendering: { ...config.rendering, defaultMaxDepth: parseInt(e.target.value) || 3 },
                  })}
                  style={{ ...inputStyle, width: 60, textAlign: "center" }}
                />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  of {levels.length} levels
                </span>
              </div>

              <OffsetSlider
                label="Entry-level learner"
                value={config.rendering.depthAdaptation.entryLevel}
                onChange={(v) => setConfig({
                  ...config,
                  rendering: {
                    ...config.rendering,
                    depthAdaptation: { ...config.rendering.depthAdaptation, entryLevel: v },
                  },
                })}
              />
              <OffsetSlider
                label="Fast-pace preference"
                value={config.rendering.depthAdaptation.fastPace}
                onChange={(v) => setConfig({
                  ...config,
                  rendering: {
                    ...config.rendering,
                    depthAdaptation: { ...config.rendering.depthAdaptation, fastPace: v },
                  },
                })}
              />
              <OffsetSlider
                label="Advanced prior knowledge"
                value={config.rendering.depthAdaptation.advancedPriorKnowledge}
                onChange={(v) => setConfig({
                  ...config,
                  rendering: {
                    ...config.rendering,
                    depthAdaptation: { ...config.rendering.depthAdaptation, advancedPriorKnowledge: v },
                  },
                })}
              />
            </div>
          </CollapsibleSection>

          {/* ── Extraction Categories Section ── */}
          <CollapsibleSection
            title="Extraction Categories"
            subtitle={`${config.extraction.categories.length} categories`}
            expanded={expandedSections.categories}
            onToggle={() => toggleSection("categories")}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {config.extraction.categories.map((cat, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    border: "1px solid var(--border-default)",
                    borderRadius: 6,
                  }}
                >
                  <input
                    type="text"
                    value={cat.id}
                    onChange={(e) => updateCategory(i, { id: e.target.value })}
                    style={{ ...inputStyle, width: 100, fontFamily: "monospace", fontSize: 12 }}
                    placeholder="id"
                  />
                  <input
                    type="text"
                    value={cat.label}
                    onChange={(e) => updateCategory(i, { label: e.target.value })}
                    style={{ ...inputStyle, width: 150, fontWeight: 500 }}
                    placeholder="Label"
                  />
                  <input
                    type="text"
                    value={cat.description}
                    onChange={(e) => updateCategory(i, { description: e.target.value })}
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="Description"
                  />
                  <button
                    onClick={() => removeCategory(i)}
                    style={{ ...iconButtonStyle, color: "var(--status-error-text)" }}
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button onClick={addCategory} style={{ ...secondaryButtonStyle, alignSelf: "flex-start" }}>
                <Plus size={14} />
                Add Category
              </button>
            </div>
          </CollapsibleSection>

          {/* ── Extraction Rules Section ── */}
          <CollapsibleSection
            title="Extraction Rules"
            subtitle="Precision and extraction behavior"
            expanded={expandedSections.rules}
            onToggle={() => toggleSection("rules")}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Toggle
                label="No invention"
                description="AI must not invent information not present in source text"
                checked={config.extraction.rules.noInvention}
                onChange={(v) => setConfig({
                  ...config,
                  extraction: {
                    ...config.extraction,
                    rules: { ...config.extraction.rules, noInvention: v },
                  },
                })}
              />
              <Toggle
                label="Track tax year"
                description="Extract and tag tax year references (e.g., 2024/25)"
                checked={config.extraction.rules.trackTaxYear}
                onChange={(v) => setConfig({
                  ...config,
                  extraction: {
                    ...config.extraction,
                    rules: { ...config.extraction.rules, trackTaxYear: v },
                  },
                })}
              />
              <Toggle
                label="Track validity dates"
                description="Extract valid-until dates on time-bound assertions"
                checked={config.extraction.rules.trackValidity}
                onChange={(v) => setConfig({
                  ...config,
                  extraction: {
                    ...config.extraction,
                    rules: { ...config.extraction.rules, trackValidity: v },
                  },
                })}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)", width: 160 }}>Chunk size (chars):</span>
                <input
                  type="number"
                  min={1000}
                  max={32000}
                  step={1000}
                  value={config.extraction.chunkSize}
                  onChange={(e) => setConfig({
                    ...config,
                    extraction: { ...config.extraction, chunkSize: parseInt(e.target.value) || 8000 },
                  })}
                  style={{ ...inputStyle, width: 80, textAlign: "center" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)", width: 160 }}>Max assertions/doc:</span>
                <input
                  type="number"
                  min={10}
                  max={2000}
                  step={10}
                  value={config.extraction.maxAssertionsPerDocument}
                  onChange={(e) => setConfig({
                    ...config,
                    extraction: { ...config.extraction, maxAssertionsPerDocument: parseInt(e.target.value) || 500 },
                  })}
                  style={{ ...inputStyle, width: 80, textAlign: "center" }}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* ── Prompts Section ── */}
          <CollapsibleSection
            title="System Prompts"
            subtitle="AI prompts for extraction and structuring"
            expanded={expandedSections.prompts}
            onToggle={() => toggleSection("prompts")}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                  Extraction Prompt
                </label>
                <textarea
                  value={config.extraction.systemPrompt}
                  onChange={(e) => setConfig({
                    ...config,
                    extraction: { ...config.extraction, systemPrompt: e.target.value },
                  })}
                  style={{
                    ...inputStyle,
                    width: "100%",
                    minHeight: 200,
                    fontFamily: "monospace",
                    fontSize: 12,
                    lineHeight: 1.5,
                    resize: "vertical",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                  Structuring Prompt
                </label>
                <textarea
                  value={config.structuring.systemPrompt}
                  onChange={(e) => setConfig({
                    ...config,
                    structuring: { ...config.structuring, systemPrompt: e.target.value },
                  })}
                  style={{
                    ...inputStyle,
                    width: "100%",
                    minHeight: 150,
                    fontFamily: "monospace",
                    fontSize: 12,
                    lineHeight: 1.5,
                    resize: "vertical",
                  }}
                />
              </div>
            </div>
          </CollapsibleSection>

        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

function CollapsibleSection({
  title,
  subtitle,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      border: "1px solid var(--border-default)",
      borderRadius: 10,
      marginBottom: 16,
      overflow: "hidden",
    }}>
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "14px 16px",
          background: "var(--surface-secondary)",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{subtitle}</div>
        </div>
        {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
      </button>
      {expanded && (
        <div style={{ padding: 16 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          border: "none",
          background: checked ? "var(--status-success-text)" : "var(--surface-tertiary)",
          cursor: "pointer",
          position: "relative",
          flexShrink: 0,
          marginTop: 1,
          transition: "background 0.2s",
        }}
      >
        <div style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "white",
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </button>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{description}</div>
      </div>
    </div>
  );
}

function OffsetSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <span style={{ fontSize: 13, color: "var(--text-secondary)", width: 180 }}>{label}:</span>
      <input
        type="range"
        min={-3}
        max={0}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        style={{ flex: 1, maxWidth: 200 }}
      />
      <span style={{
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "monospace",
        color: value === 0 ? "var(--text-muted)" : "var(--status-warning-text)",
        width: 30,
        textAlign: "center",
      }}>
        {value === 0 ? "0" : value}
      </span>
    </div>
  );
}

// ------------------------------------------------------------------
// Shared styles
// ------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  padding: "6px 8px",
  border: "1px solid var(--border-default)",
  borderRadius: 6,
  background: "var(--surface-primary)",
  color: "var(--text-primary)",
  fontSize: 13,
  outline: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  color: "white",
  background: "var(--button-primary-bg)",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-secondary)",
  background: "var(--surface-secondary)",
  border: "1px solid var(--border-default)",
  borderRadius: 6,
  cursor: "pointer",
};

const iconButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  padding: 0,
  background: "none",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  color: "var(--text-muted)",
};

const linkButtonStyle: React.CSSProperties = {
  color: "var(--accent-primary)",
  background: "none",
  border: "none",
  fontSize: 14,
  cursor: "pointer",
  textDecoration: "underline",
};
