"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, RotateCcw, Save, ChevronDown, ChevronUp } from "lucide-react";
import { SortableList } from "@/components/shared/SortableList";
import { reorderItems } from "@/lib/sortable/reorder";
import "./extraction.css";

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
      <div className="ext-loading">
        Loading extraction config...
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="ext-error-wrap">
        <div className="ext-error-msg">{error}</div>
        <button onClick={() => router.push("/x/domains")} className="ext-btn-link">
          &larr; Back to Domains
        </button>
      </div>
    );
  }

  if (!config) return null;

  const levels = config.structuring.levels;
  const isDirty = JSON.stringify(config) !== JSON.stringify(originalConfig);

  return (
    <div className="ext-page">
      {/* Header */}
      <div className="ext-header">
        <div className="ext-header-left">
          <Link href={`/x/domains?id=${domainId}`} className="ext-back-link">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="hf-section-title">Extraction Config</h1>
            <div className="ext-header-meta">
              {domainName}
              {hasOverride && (
                <span className="ext-override-badge">OVERRIDE</span>
              )}
            </div>
          </div>
        </div>
        <div className="ext-header-actions">
          {saveMessage && (
            <span className="ext-save-msg">{saveMessage}</span>
          )}
          {error && (
            <span className="ext-error-inline">{error}</span>
          )}
          {hasOverride && (
            <button onClick={handleReset} disabled={saving} className="ext-btn-secondary">
              <RotateCcw size={14} />
              Reset to Defaults
            </button>
          )}
          <button onClick={handleSave} disabled={saving || !isDirty} className="ext-btn-primary">
            <Save size={14} />
            {saving ? "Saving..." : "Save Override"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="ext-body">
        <div className="ext-body-inner">

          {/* -- Pyramid Structure Section -- */}
          <CollapsibleSection
            title="Pyramid Structure"
            subtitle={`${levels.length} levels, target ~${config.structuring.targetChildCount} children per node`}
            expanded={expandedSections.pyramid}
            onToggle={() => toggleSection("pyramid")}
          >
            {/* Visual pyramid preview */}
            <div className="ext-pyramid-preview">
              {levels.map((level, i) => {
                const indent = i * 24;
                const renderIcon = RENDER_AS_OPTIONS.find((o) => o.value === level.renderAs)?.preview || "?";
                const isLast = i === levels.length - 1;
                return (
                  <div key={i} style={{ paddingLeft: indent }}>
                    <span className="ext-pyramid-connector">
                      {i === 0 ? "\u250C" : isLast ? "\u2514" : "\u251C"}{"\u2500 "}
                    </span>
                    <span className="ext-pyramid-label">{level.label}</span>
                    <span className="ext-pyramid-meta">
                      {" \u2500\u2500 max: "}{level.maxChildren}{" \u2500\u2500 "}
                    </span>
                    <span className="ext-render-icon">
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
                <div className="ext-level-row" onClick={(e) => e.stopPropagation()}>
                  {/* Depth badge */}
                  <span className="ext-depth-badge">
                    {index}
                  </span>

                  {/* Label */}
                  <input
                    type="text"
                    value={level.label}
                    onChange={(e) => updateLevel(index, { label: e.target.value })}
                    className="ext-input ext-input-label"
                    placeholder="Level label"
                  />

                  {/* Max children */}
                  <div className="hf-flex hf-gap-xs">
                    <span className="ext-field-hint">max</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={level.maxChildren}
                      onChange={(e) => updateLevel(index, { maxChildren: parseInt(e.target.value) || 1 })}
                      className="ext-input ext-input-narrow"
                    />
                  </div>

                  {/* Render as */}
                  <select
                    value={level.renderAs}
                    onChange={(e) => updateLevel(index, { renderAs: e.target.value as PyramidLevel["renderAs"] })}
                    className="ext-input ext-input-select"
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
                    className="ext-input ext-input-flex"
                    placeholder="Description"
                  />
                </div>
              )}
            />

            {/* Target children */}
            <div className="ext-target-row">
              <div className="hf-flex hf-gap-sm">
                <span className="hf-text-sm hf-text-secondary">Target children per node:</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={config.structuring.targetChildCount}
                  onChange={(e) => setConfig({
                    ...config,
                    structuring: { ...config.structuring, targetChildCount: parseInt(e.target.value) || 3 },
                  })}
                  className="ext-input ext-input-narrow"
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* -- Depth Adaptation Section -- */}
          <CollapsibleSection
            title="Depth Adaptation"
            subtitle="Adjust rendering depth based on learner signals"
            expanded={expandedSections.adaptation}
            onToggle={() => toggleSection("adaptation")}
          >
            <div className="hf-flex-col hf-gap-lg">
              <div className="hf-flex hf-gap-lg">
                <span className="ext-field-label">Default max depth:</span>
                <input
                  type="number"
                  min={1}
                  max={levels.length}
                  value={config.rendering.defaultMaxDepth}
                  onChange={(e) => setConfig({
                    ...config,
                    rendering: { ...config.rendering, defaultMaxDepth: parseInt(e.target.value) || 3 },
                  })}
                  className="ext-input ext-input-num-md"
                />
                <span className="ext-depth-hint">
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

          {/* -- Extraction Categories Section -- */}
          <CollapsibleSection
            title="Extraction Categories"
            subtitle={`${config.extraction.categories.length} categories`}
            expanded={expandedSections.categories}
            onToggle={() => toggleSection("categories")}
          >
            <div className="hf-flex-col hf-gap-sm">
              {config.extraction.categories.map((cat, i) => (
                <div key={i} className="ext-category-row">
                  <input
                    type="text"
                    value={cat.id}
                    onChange={(e) => updateCategory(i, { id: e.target.value })}
                    className="ext-input ext-input-mono"
                    placeholder="id"
                  />
                  <input
                    type="text"
                    value={cat.label}
                    onChange={(e) => updateCategory(i, { label: e.target.value })}
                    className="ext-input ext-input-label-text"
                    placeholder="Label"
                  />
                  <input
                    type="text"
                    value={cat.description}
                    onChange={(e) => updateCategory(i, { description: e.target.value })}
                    className="ext-input ext-input-flex"
                    placeholder="Description"
                  />
                  <button
                    onClick={() => removeCategory(i)}
                    className="ext-btn-icon ext-btn-icon-danger"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button onClick={addCategory} className="ext-btn-secondary ext-add-btn">
                <Plus size={14} />
                Add Category
              </button>
            </div>
          </CollapsibleSection>

          {/* -- Extraction Rules Section -- */}
          <CollapsibleSection
            title="Extraction Rules"
            subtitle="Precision and extraction behavior"
            expanded={expandedSections.rules}
            onToggle={() => toggleSection("rules")}
          >
            <div className="hf-flex-col hf-gap-lg">
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
              <div className="hf-flex hf-gap-lg">
                <span className="ext-field-label">Chunk size (chars):</span>
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
                  className="ext-input ext-input-num-lg"
                />
              </div>
              <div className="hf-flex hf-gap-lg">
                <span className="ext-field-label">Max assertions/doc:</span>
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
                  className="ext-input ext-input-num-lg"
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* -- Prompts Section -- */}
          <CollapsibleSection
            title="System Prompts"
            subtitle="AI prompts for extraction and structuring"
            expanded={expandedSections.prompts}
            onToggle={() => toggleSection("prompts")}
          >
            <div className="hf-flex-col hf-gap-lg">
              <div>
                <label className="ext-prompt-label">
                  Extraction Prompt
                </label>
                <textarea
                  value={config.extraction.systemPrompt}
                  onChange={(e) => setConfig({
                    ...config,
                    extraction: { ...config.extraction, systemPrompt: e.target.value },
                  })}
                  className="ext-textarea ext-textarea-tall"
                />
              </div>
              <div>
                <label className="ext-prompt-label">
                  Structuring Prompt
                </label>
                <textarea
                  value={config.structuring.systemPrompt}
                  onChange={(e) => setConfig({
                    ...config,
                    structuring: { ...config.structuring, systemPrompt: e.target.value },
                  })}
                  className="ext-textarea ext-textarea-med"
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
    <div className="ext-section">
      <button onClick={onToggle} className="ext-section-header">
        <div>
          <div className="ext-section-title">{title}</div>
          <div className="ext-section-subtitle">{subtitle}</div>
        </div>
        {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
      </button>
      {expanded && (
        <div className="ext-section-body">
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
    <div className="ext-toggle-wrap">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`ext-toggle-track ${checked ? "ext-toggle-track-on" : "ext-toggle-track-off"}`}
      >
        <div className={`ext-toggle-thumb ${checked ? "ext-toggle-thumb-on" : "ext-toggle-thumb-off"}`} />
      </button>
      <div>
        <div className="ext-toggle-label">{label}</div>
        <div className="ext-toggle-desc">{description}</div>
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
    <div className="ext-slider-row">
      <span className="ext-field-label-wide">{label}:</span>
      <input
        type="range"
        min={-3}
        max={0}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="ext-slider-input"
      />
      <span className={`ext-slider-value ${value === 0 ? "ext-slider-value-zero" : "ext-slider-value-active"}`}>
        {value === 0 ? "0" : value}
      </span>
    </div>
  );
}
