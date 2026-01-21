"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { theme, categoryColors } from "@/lib/styles/theme";

type Parameter = {
  parameterId: string;
  name: string;
  domainGroup: string;
};

type PromptSlugParameter = {
  id: string;
  parameterId: string;
  weight: number;
  mode: "ABSOLUTE" | "DELTA";
  sortOrder: number;
  parameter: Parameter;
};

type PromptSlugRange = {
  id: string;
  minValue: number | null;
  maxValue: number | null;
  condition: string | null;
  prompt: string;
  label: string | null;
  sortOrder: number;
};

type PromptSlug = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sourceType: "PARAMETER" | "MEMORY" | "COMPOSITE";
  // Many-to-many parameters
  parameters: PromptSlugParameter[];
  memoryCategory: string | null;
  memoryMode: string | null;
  fallbackPrompt: string | null;
  priority: number;
  isActive: boolean;
  version: string;
  ranges: PromptSlugRange[];
  usageCount: number;
  rangeCount: number;
  createdAt: string;
  updatedAt: string;
};

// Form parameter input type
type ParameterInput = {
  parameterId: string;
  weight: number;
  mode: "ABSOLUTE" | "DELTA";
};

export default function DynamicPromptsPage() {
  const searchParams = useSearchParams();
  const urlParameterId = searchParams.get("parameterId");

  const [slugs, setSlugs] = useState<PromptSlug[]>([]);
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSlug, setEditingSlug] = useState<PromptSlug | null>(null);
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(new Set());
  const [filterSourceType, setFilterSourceType] = useState<string | null>(null);
  const [filterParameterId, setFilterParameterId] = useState<string | null>(urlParameterId);

  // Form state
  const [formSlug, setFormSlug] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSourceType, setFormSourceType] = useState<"PARAMETER" | "MEMORY" | "COMPOSITE">("PARAMETER");
  // Multi-parameter support
  const [formParameters, setFormParameters] = useState<ParameterInput[]>([]);
  const [formMemoryCategory, setFormMemoryCategory] = useState("");
  const [formMemoryMode, setFormMemoryMode] = useState("latest");
  const [formFallbackPrompt, setFormFallbackPrompt] = useState("");
  const [formPriority, setFormPriority] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formRanges, setFormRanges] = useState<Partial<PromptSlugRange>[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSlugs();
  }, [filterSourceType, filterParameterId]);

  // Sync URL param to state on mount
  useEffect(() => {
    if (urlParameterId && urlParameterId !== filterParameterId) {
      setFilterParameterId(urlParameterId);
    }
  }, [urlParameterId]);

  async function loadSlugs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSourceType) params.set("sourceType", filterSourceType);
      if (filterParameterId) params.set("parameterId", filterParameterId);
      const res = await fetch(`/api/prompt-slugs?${params}`);
      const data = await res.json();
      if (data.ok) {
        setSlugs(data.slugs || []);
        setParameters(data.parameters || []);
      } else {
        setError(data.error || "Failed to load dynamic prompts");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormSlug("");
    setFormName("");
    setFormDescription("");
    setFormSourceType("PARAMETER");
    setFormParameters([]);
    setFormMemoryCategory("");
    setFormMemoryMode("latest");
    setFormFallbackPrompt("");
    setFormPriority(0);
    setFormIsActive(true);
    setFormRanges([]);
    setEditingSlug(null);
    setShowCreateForm(false);
  }

  function startEdit(slug: PromptSlug) {
    setEditingSlug(slug);
    setFormSlug(slug.slug);
    setFormName(slug.name);
    setFormDescription(slug.description || "");
    setFormSourceType(slug.sourceType);
    // Map existing parameters to form state
    setFormParameters(
      slug.parameters.map((p) => ({
        parameterId: p.parameterId,
        weight: p.weight,
        mode: p.mode,
      }))
    );
    setFormMemoryCategory(slug.memoryCategory || "");
    setFormMemoryMode(slug.memoryMode || "latest");
    setFormFallbackPrompt(slug.fallbackPrompt || "");
    setFormPriority(slug.priority);
    setFormIsActive(slug.isActive);
    setFormRanges(slug.ranges.map((r) => ({ ...r })));
    setShowCreateForm(true);
  }

  // Parameter management
  function addParameter() {
    setFormParameters([...formParameters, { parameterId: "", weight: 1.0, mode: "ABSOLUTE" }]);
  }

  function updateParameter(index: number, field: keyof ParameterInput, value: any) {
    const updated = [...formParameters];
    (updated[index] as any)[field] = value;
    setFormParameters(updated);
  }

  function removeParameter(index: number) {
    setFormParameters(formParameters.filter((_, i) => i !== index));
  }

  // Range management
  function addRange() {
    setFormRanges([...formRanges, { minValue: null, maxValue: null, prompt: "", label: "", sortOrder: formRanges.length }]);
  }

  function updateRange(index: number, field: string, value: any) {
    const updated = [...formRanges];
    (updated[index] as any)[field] = value;
    setFormRanges(updated);
  }

  function removeRange(index: number) {
    setFormRanges(formRanges.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = editingSlug ? `/api/prompt-slugs/${editingSlug.id}` : "/api/prompt-slugs";
      const method = editingSlug ? "PATCH" : "POST";

      // Build parameters array for PARAMETER/COMPOSITE types
      const parametersToSend =
        formSourceType === "PARAMETER" || formSourceType === "COMPOSITE"
          ? formParameters.filter((p) => p.parameterId)
          : [];

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: formSlug,
          name: formName,
          description: formDescription || null,
          sourceType: formSourceType,
          parameters: parametersToSend,
          memoryCategory: formSourceType === "MEMORY" ? formMemoryCategory : null,
          memoryMode: formSourceType === "MEMORY" ? formMemoryMode : null,
          fallbackPrompt: formFallbackPrompt || null,
          priority: formPriority,
          isActive: formIsActive,
          ranges: formRanges.filter((r) => r.prompt),
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      resetForm();
      loadSlugs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(slug: PromptSlug) {
    if (!confirm(`Delete dynamic prompt "${slug.name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/prompt-slugs/${slug.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      loadSlugs();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function toggleExpand(id: string) {
    setExpandedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const sourceTypeColors: Record<string, string> = {
    PARAMETER: "#6366f1",
    MEMORY: "#10b981",
    COMPOSITE: "#f59e0b",
    ADAPT: "#8b5cf6",
  };

  const memoryCategories = ["FACT", "PREFERENCE", "EVENT", "TOPIC", "RELATIONSHIP", "CONTEXT"];

  return (
    <div style={theme.page}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={theme.h1}>Dynamic Prompts</h1>
          <p style={theme.subtitle}>
            Dynamic prompt fragments driven by parameter values or memories
          </p>
        </div>
        <button onClick={() => setShowCreateForm(true)} style={theme.btnPrimary}>
          + New Dynamic Prompt
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        {/* Source Type Filter */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setFilterSourceType(null)}
            style={!filterSourceType ? theme.pillActive : theme.pillInactive}
          >
            All Types
          </button>
          {["PARAMETER", "MEMORY", "COMPOSITE", "ADAPT"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterSourceType(st)}
              style={filterSourceType === st
                ? { ...theme.pillActive, background: sourceTypeColors[st] }
                : theme.pillInactive
              }
            >
              {st}
            </button>
          ))}
        </div>

        {/* Parameter Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Parameter:</span>
          <select
            value={filterParameterId || ""}
            onChange={(e) => setFilterParameterId(e.target.value || null)}
            style={{
              ...theme.select,
              width: "auto",
              padding: "4px 8px",
              fontSize: 12,
              background: filterParameterId ? "var(--status-info-bg)" : "var(--surface-primary)",
            }}
          >
            <option value="">All Parameters</option>
            {parameters.map((p) => (
              <option key={p.parameterId} value={p.parameterId}>
                {p.name} ({p.domainGroup})
              </option>
            ))}
          </select>
          {filterParameterId && (
            <button onClick={() => setFilterParameterId(null)} style={theme.btnDanger}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div style={theme.formContainer}>
          <h3 style={{ ...theme.h3, margin: "0 0 16px 0" }}>
            {editingSlug ? "Edit Dynamic Prompt" : "Create New Dynamic Prompt"}
          </h3>
          <form onSubmit={handleSubmit}>
            {/* Basic Info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={theme.label}>Slug</label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="e.g., openness-style"
                  disabled={!!editingSlug}
                  style={theme.inputMono}
                />
              </div>
              <div>
                <label style={theme.label}>Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Display name"
                  style={theme.input}
                />
              </div>
              <div>
                <label style={theme.label}>Source Type</label>
                <select
                  value={formSourceType}
                  onChange={(e) => setFormSourceType(e.target.value as any)}
                  style={theme.select}
                >
                  <option value="PARAMETER">Parameter (single)</option>
                  <option value="COMPOSITE">Composite (multiple parameters)</option>
                  <option value="MEMORY">Memory</option>
                </select>
              </div>
            </div>

            {/* Parameter fields - for PARAMETER and COMPOSITE types */}
            {(formSourceType === "PARAMETER" || formSourceType === "COMPOSITE") && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
                    Parameters {formSourceType === "COMPOSITE" && "(weighted combination)"}
                  </label>
                  <button
                    type="button"
                    onClick={addParameter}
                    style={theme.btnSecondary}
                  >
                    + Add Parameter
                  </button>
                </div>

                {formParameters.length === 0 ? (
                  <div style={{ padding: 12, background: "var(--surface-primary)", border: "1px dashed var(--border-default)", borderRadius: 6, textAlign: "center", fontSize: 12, color: "var(--text-secondary)" }}>
                    No parameters added. Click "+ Add Parameter" to link parameters.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {formParameters.map((param, index) => (
                      <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 100px 140px auto", gap: 8, alignItems: "end" }}>
                        <div>
                          <label style={{ ...theme.small, marginBottom: 2, display: "block" }}>Parameter</label>
                          <select
                            value={param.parameterId}
                            onChange={(e) => updateParameter(index, "parameterId", e.target.value)}
                            style={{ ...theme.select, fontSize: 13 }}
                          >
                            <option value="">-- Select --</option>
                            {parameters.map((p) => (
                              <option key={p.parameterId} value={p.parameterId}>
                                {p.name} ({p.domainGroup})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ ...theme.small, marginBottom: 2, display: "block" }}>Weight</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="2"
                            value={param.weight}
                            onChange={(e) => updateParameter(index, "weight", parseFloat(e.target.value) || 1.0)}
                            style={{ ...theme.input, fontSize: 13 }}
                          />
                        </div>
                        <div>
                          <label style={{ ...theme.small, marginBottom: 2, display: "block" }}>Mode</label>
                          <select
                            value={param.mode}
                            onChange={(e) => updateParameter(index, "mode", e.target.value)}
                            style={{ ...theme.select, fontSize: 13 }}
                          >
                            <option value="ABSOLUTE">Absolute</option>
                            <option value="DELTA">Delta</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeParameter(index)}
                          style={{ ...theme.btnDanger, padding: 8 }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {formSourceType === "MEMORY" && (
              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={theme.label}>Memory Category</label>
                  <select
                    value={formMemoryCategory}
                    onChange={(e) => setFormMemoryCategory(e.target.value)}
                    style={theme.select}
                  >
                    <option value="">-- Select Category --</option>
                    {memoryCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={theme.label}>Memory Mode</label>
                  <select
                    value={formMemoryMode}
                    onChange={(e) => setFormMemoryMode(e.target.value)}
                    style={theme.select}
                  >
                    <option value="latest">Latest</option>
                    <option value="summary">Summary</option>
                    <option value="all">All</option>
                  </select>
                </div>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <label style={theme.label}>Description</label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description (optional)"
                style={theme.input}
              />
            </div>

            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={theme.label}>Priority</label>
                <input
                  type="number"
                  value={formPriority}
                  onChange={(e) => setFormPriority(parseInt(e.target.value) || 0)}
                  style={theme.input}
                />
              </div>
              <div>
                <label style={theme.label}>Status</label>
                <label style={{ ...theme.checkboxLabel, paddingTop: 8 }}>
                  <input type="checkbox" checked={formIsActive} onChange={(e) => setFormIsActive(e.target.checked)} />
                  <span>Active</span>
                </label>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={theme.label}>Fallback Prompt</label>
              <textarea
                value={formFallbackPrompt}
                onChange={(e) => setFormFallbackPrompt(e.target.value)}
                placeholder="Prompt to use when no range matches (optional)"
                rows={2}
                style={theme.textarea}
              />
            </div>

            {/* Ranges */}
            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Value Ranges</label>
                <button
                  type="button"
                  onClick={addRange}
                  style={theme.btnSecondary}
                >
                  + Add Range
                </button>
              </div>

              {formRanges.length === 0 ? (
                <div style={{ padding: 16, background: "var(--surface-primary)", border: "1px dashed var(--border-default)", borderRadius: 8, textAlign: "center", fontSize: 13, color: "var(--text-secondary)" }}>
                  No ranges defined. Add ranges to map values to prompts.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {formRanges.map((range, index) => (
                    <div key={index} style={{ padding: 12, background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 8 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "80px 80px 1fr auto", gap: 8, alignItems: "start" }}>
                        <div>
                          <label style={{ ...theme.small, marginBottom: 2, display: "block" }}>Min</label>
                          <input
                            type="number"
                            step="0.1"
                            value={range.minValue ?? ""}
                            onChange={(e) => updateRange(index, "minValue", e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="0.0"
                            style={{ ...theme.input, padding: 6, fontSize: 12 }}
                          />
                        </div>
                        <div>
                          <label style={{ ...theme.small, marginBottom: 2, display: "block" }}>Max</label>
                          <input
                            type="number"
                            step="0.1"
                            value={range.maxValue ?? ""}
                            onChange={(e) => updateRange(index, "maxValue", e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="1.0"
                            style={{ ...theme.input, padding: 6, fontSize: 12 }}
                          />
                        </div>
                        <div>
                          <label style={{ ...theme.small, marginBottom: 2, display: "block" }}>Label</label>
                          <input
                            type="text"
                            value={range.label || ""}
                            onChange={(e) => updateRange(index, "label", e.target.value)}
                            placeholder="e.g., High openness"
                            style={{ ...theme.input, padding: 6, fontSize: 12 }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRange(index)}
                          style={{ ...theme.btnDanger, marginTop: 16 }}
                        >
                          Remove
                        </button>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <label style={{ ...theme.small, marginBottom: 2, display: "block" }}>Prompt</label>
                        <textarea
                          value={range.prompt || ""}
                          onChange={(e) => updateRange(index, "prompt", e.target.value)}
                          placeholder="The prompt text for this range..."
                          rows={2}
                          style={{ ...theme.textarea, padding: 6, fontSize: 11 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
              <button
                type="submit"
                disabled={saving || !formSlug || !formName}
                style={{ ...theme.btnPrimary, opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Saving..." : editingSlug ? "Update Dynamic Prompt" : "Create Dynamic Prompt"}
              </button>
              <button type="button" onClick={resetForm} style={theme.btnSecondary}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={theme.errorAlert}>
          {error}
          <button onClick={() => setError(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "var(--status-error-text)" }}>x</button>
        </div>
      )}

      {/* Slugs List */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>
      ) : slugs.length === 0 ? (
        <div style={theme.emptyState}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔀</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No dynamic prompts yet</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>Create dynamic prompts to generate personalized content</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {slugs.map((slug) => (
            <div
              key={slug.id}
              style={{
                ...theme.card,
                border: slug.isActive ? "1px solid var(--border-default)" : "1px dashed var(--border-default)",
                opacity: slug.isActive ? 1 : 0.7,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        ...theme.badge,
                        background: sourceTypeColors[slug.sourceType],
                        color: "#fff",
                      }}
                    >
                      {slug.sourceType}
                    </span>
                    <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-secondary)" }}>{slug.slug}</span>
                    {!slug.isActive && <span style={theme.small}>INACTIVE</span>}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{slug.name}</div>
                  {slug.description && <div style={theme.muted}>{slug.description}</div>}

                  {/* Show linked parameters */}
                  {slug.parameters.length > 0 && (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                      <span style={{ fontWeight: 500 }}>Parameters:</span>{" "}
                      {slug.parameters.map((p, i) => (
                        <span key={p.id}>
                          {i > 0 && ", "}
                          <span style={{ fontWeight: 500 }}>{p.parameter.name}</span>
                          <span style={theme.small}>
                            {" "}(w:{p.weight}, {p.mode})
                          </span>
                        </span>
                      ))}
                    </div>
                  )}

                  {slug.memoryCategory && (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                      Memory: <strong>{slug.memoryCategory}</strong> ({slug.memoryMode})
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={theme.small}>
                    {slug.rangeCount} range{slug.rangeCount !== 1 ? "s" : ""} · {slug.usageCount} stack{slug.usageCount !== 1 ? "s" : ""}
                  </span>
                  <button onClick={() => toggleExpand(slug.id)} style={theme.btnSmall}>
                    {expandedSlugs.has(slug.id) ? "Hide" : "Show"}
                  </button>
                  <button onClick={() => startEdit(slug)} style={theme.btnSmall}>
                    Edit
                  </button>
                  {slug.usageCount === 0 && (
                    <button onClick={() => handleDelete(slug)} style={theme.btnDanger}>
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {expandedSlugs.has(slug.id) && slug.ranges.length > 0 && (
                <div style={{ marginTop: 12, padding: 12, background: "var(--surface-secondary)", borderRadius: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>Value Ranges:</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {slug.ranges.map((range) => (
                      <div key={range.id} style={{ padding: 8, background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 4 }}>
                        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-secondary)" }}>
                            [{range.minValue ?? "-∞"}, {range.maxValue ?? "∞"})
                          </span>
                          {range.label && <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)" }}>{range.label}</span>}
                        </div>
                        <div style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-primary)" }}>
                          {range.prompt.length > 200 ? range.prompt.slice(0, 200) + "..." : range.prompt}
                        </div>
                      </div>
                    ))}
                  </div>
                  {slug.fallbackPrompt && (
                    <div style={{ marginTop: 8, padding: 8, background: "var(--status-warning-bg)", border: "1px solid var(--status-warning-text)", borderRadius: 4 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--status-warning-text)", marginBottom: 4 }}>Fallback:</div>
                      <div style={{ fontSize: 12, fontFamily: "monospace", color: "var(--status-warning-text)" }}>{slug.fallbackPrompt}</div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ ...theme.small, marginTop: 8 }}>
                v{slug.version} · Priority {slug.priority} · Updated {new Date(slug.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
