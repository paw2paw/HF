"use client";

import { useState, useEffect } from "react";
import { theme, categoryColors as themeCategoryColors } from "@/lib/styles/theme";

type PromptBlock = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  content: string;
  isActive: boolean;
  version: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
};

type CategoryStat = {
  category: string;
  count: number;
};

export default function PromptBlocksPage() {
  const [blocks, setBlocks] = useState<PromptBlock[]>([]);
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingBlock, setEditingBlock] = useState<PromptBlock | null>(null);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());

  // Form state
  const [formSlug, setFormSlug] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("system");
  const [formContent, setFormContent] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBlocks();
  }, [selectedCategory]);

  async function loadBlocks() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.set("category", selectedCategory);
      const res = await fetch(`/api/prompt-blocks?${params}`);
      const data = await res.json();
      if (data.ok) {
        setBlocks(data.blocks || []);
        setCategories(data.categories || []);
      } else {
        setError(data.error || "Failed to load blocks");
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
    setFormCategory("system");
    setFormContent("");
    setFormIsActive(true);
    setEditingBlock(null);
    setShowCreateForm(false);
  }

  function startEdit(block: PromptBlock) {
    setEditingBlock(block);
    setFormSlug(block.slug);
    setFormName(block.name);
    setFormDescription(block.description || "");
    setFormCategory(block.category);
    setFormContent(block.content);
    setFormIsActive(block.isActive);
    setShowCreateForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = editingBlock
        ? `/api/prompt-blocks/${editingBlock.id}`
        : "/api/prompt-blocks";
      const method = editingBlock ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: formSlug,
          name: formName,
          description: formDescription || null,
          category: formCategory,
          content: formContent,
          isActive: formIsActive,
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      resetForm();
      loadBlocks();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(block: PromptBlock) {
    if (!confirm(`Delete block "${block.name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/prompt-blocks/${block.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      loadBlocks();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function toggleExpand(id: string) {
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Local override - can use themeCategoryColors if needed
  const categoryColors: Record<string, string> = {
    system: "#6366f1",
    safety: "#dc2626",
    persona: "#10b981",
    instruction: "#f59e0b",
    custom: "#8b5cf6",
  };

  return (
    <div style={theme.page}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={theme.h1}>Static Prompts</h1>
          <p style={theme.subtitle}>
            Fixed prompt components (system prompts, safety guardrails, personas)
          </p>
        </div>
        <button onClick={() => setShowCreateForm(true)} style={theme.btnPrimary}>
          + New Block
        </button>
      </div>

      {/* Category Filter */}
      {categories.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button
            onClick={() => setSelectedCategory(null)}
            style={!selectedCategory ? theme.pillActive : theme.pillInactive}
          >
            All ({blocks.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.category}
              onClick={() => setSelectedCategory(cat.category)}
              style={selectedCategory === cat.category
                ? { ...theme.pillActive, background: categoryColors[cat.category] || "var(--text-primary)" }
                : theme.pillInactive
              }
            >
              {cat.category} ({cat.count})
            </button>
          ))}
        </div>
      )}

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div style={theme.formContainer}>
          <h3 style={{ ...theme.h3, margin: "0 0 16px 0" }}>
            {editingBlock ? "Edit Block" : "Create New Block"}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={theme.label}>Slug</label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="e.g., system-base"
                  disabled={!!editingBlock}
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
            </div>

            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={theme.label}>Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  style={theme.select}
                >
                  <option value="system">System</option>
                  <option value="safety">Safety</option>
                  <option value="persona">Persona</option>
                  <option value="instruction">Instruction</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label style={theme.label}>Status</label>
                <label style={{ ...theme.checkboxLabel, paddingTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                  />
                  <span>Active</span>
                </label>
              </div>
            </div>

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

            <div style={{ marginTop: 16 }}>
              <label style={theme.label}>Content</label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="The prompt content..."
                rows={8}
                style={theme.textarea}
              />
            </div>

            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <button
                type="submit"
                disabled={saving || !formSlug || !formName || !formContent}
                style={{ ...theme.btnPrimary, opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Saving..." : editingBlock ? "Update Block" : "Create Block"}
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
          <button onClick={() => setError(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "var(--status-error-text)" }}>
            x
          </button>
        </div>
      )}

      {/* Blocks List */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>
      ) : blocks.length === 0 ? (
        <div style={theme.emptyState}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧱</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No prompt blocks yet</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
            Create prompt blocks to use in stacks
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {blocks.map((block) => (
            <div
              key={block.id}
              style={{
                ...theme.card,
                border: block.isActive ? "1px solid var(--border-default)" : "1px dashed var(--border-default)",
                opacity: block.isActive ? 1 : 0.7,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        ...theme.badge,
                        background: categoryColors[block.category] || "var(--text-primary)",
                        color: "#fff",
                      }}
                    >
                      {block.category}
                    </span>
                    <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-secondary)" }}>{block.slug}</span>
                    {!block.isActive && (
                      <span style={theme.small}>INACTIVE</span>
                    )}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{block.name}</div>
                  {block.description && (
                    <div style={theme.muted}>{block.description}</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={theme.small}>
                    {block.usageCount} stack{block.usageCount !== 1 ? "s" : ""}
                  </span>
                  <button onClick={() => toggleExpand(block.id)} style={theme.btnSmall}>
                    {expandedBlocks.has(block.id) ? "Hide" : "Show"}
                  </button>
                  <button onClick={() => startEdit(block)} style={theme.btnSmall}>
                    Edit
                  </button>
                  {block.usageCount === 0 && (
                    <button onClick={() => handleDelete(block)} style={theme.btnDanger}>
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {expandedBlocks.has(block.id) && (
                <div style={theme.codeBlock}>
                  {block.content}
                </div>
              )}

              <div style={{ ...theme.small, marginTop: 8 }}>
                v{block.version} · Updated {new Date(block.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
