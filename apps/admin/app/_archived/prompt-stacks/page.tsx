"use client";

import { useState, useEffect } from "react";
import { theme, categoryColors, statusColors } from "@/lib/styles/theme";

type PromptBlock = {
  id: string;
  slug: string;
  name: string;
  category: string;
  content?: string;
  isActive: boolean;
};

type PromptSlug = {
  id: string;
  slug: string;
  name: string;
  sourceType: string;
  isActive: boolean;
};

type StackItem = {
  id: string;
  itemType: "BLOCK" | "SLUG" | "CALLER" | "AUTO_SLUGS";
  blockId: string | null;
  block: PromptBlock | null;
  slugId: string | null;
  slug: PromptSlug | null;
  callerMemoryCategories: string[];
  callerMemoryLimit: number | null;
  // AUTO_SLUGS config
  autoSlugSourceTypes: string[];
  autoSlugOrderBy: string | null;
  autoSlugLimit: number | null;
  autoSlugDomainFilter: string[];
  isEnabled: boolean;
  sortOrder: number;
};

type PromptStack = {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isDefault: boolean;
  version: string;
  items: StackItem[];
  callerCount: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export default function PromptStacksPage() {
  const [stacks, setStacks] = useState<PromptStack[]>([]);
  const [blocks, setBlocks] = useState<PromptBlock[]>([]);
  const [slugs, setSlugs] = useState<PromptSlug[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingStack, setEditingStack] = useState<PromptStack | null>(null);
  const [expandedStacks, setExpandedStacks] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formItems, setFormItems] = useState<Partial<StackItem>[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);

      const [stacksRes, blocksRes, slugsRes] = await Promise.all([
        fetch(`/api/prompt-stacks?${params}`),
        fetch("/api/prompt-blocks?isActive=true"),
        fetch("/api/prompt-slugs?isActive=true"),
      ]);

      const [stacksData, blocksData, slugsData] = await Promise.all([
        stacksRes.json(),
        blocksRes.json(),
        slugsRes.json(),
      ]);

      if (stacksData.ok) setStacks(stacksData.stacks || []);
      if (blocksData.ok) setBlocks(blocksData.blocks || []);
      if (slugsData.ok) setSlugs(slugsData.slugs || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormName("");
    setFormDescription("");
    setFormIsDefault(false);
    setFormItems([]);
    setEditingStack(null);
    setShowCreateForm(false);
  }

  function startEdit(stack: PromptStack) {
    setEditingStack(stack);
    setFormName(stack.name);
    setFormDescription(stack.description || "");
    setFormIsDefault(stack.isDefault);
    setFormItems(stack.items.map((item) => ({
      ...item,
      blockId: item.block?.id || null,
      slugId: item.slug?.id || null,
    })));
    setShowCreateForm(true);
  }

  function addItem(type: "BLOCK" | "SLUG" | "CALLER" | "AUTO_SLUGS") {
    setFormItems([
      ...formItems,
      {
        itemType: type,
        blockId: null,
        slugId: null,
        callerMemoryCategories: type === "CALLER" ? ["FACT", "PREFERENCE"] : [],
        callerMemoryLimit: type === "CALLER" ? 10 : null,
        autoSlugSourceTypes: type === "AUTO_SLUGS" ? ["PARAMETER", "COMPOSITE", "ADAPT"] : [],
        autoSlugOrderBy: type === "AUTO_SLUGS" ? "priority" : null,
        autoSlugLimit: null,
        autoSlugDomainFilter: [],
        isEnabled: true,
        sortOrder: formItems.length,
      },
    ]);
  }

  function updateItem(index: number, field: string, value: any) {
    const updated = [...formItems];
    (updated[index] as any)[field] = value;
    setFormItems(updated);
  }

  function removeItem(index: number) {
    setFormItems(formItems.filter((_, i) => i !== index));
  }

  function moveItem(index: number, direction: "up" | "down") {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === formItems.length - 1) return;

    const updated = [...formItems];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
    setFormItems(updated.map((item, i) => ({ ...item, sortOrder: i })));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = editingStack ? `/api/prompt-stacks/${editingStack.id}` : "/api/prompt-stacks";
      const method = editingStack ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          description: formDescription || null,
          isDefault: formIsDefault,
          items: formItems.map((item, index) => ({
            itemType: item.itemType,
            blockId: item.blockId,
            slugId: item.slugId,
            callerMemoryCategories: item.callerMemoryCategories,
            callerMemoryLimit: item.callerMemoryLimit,
            autoSlugSourceTypes: item.autoSlugSourceTypes,
            autoSlugOrderBy: item.autoSlugOrderBy,
            autoSlugLimit: item.autoSlugLimit,
            autoSlugDomainFilter: item.autoSlugDomainFilter,
            isEnabled: item.isEnabled ?? true,
            sortOrder: index,
          })),
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      resetForm();
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish(stack: PromptStack) {
    if (!confirm(`Publish stack "${stack.name}"? This will make it available for callers.`)) return;

    try {
      const res = await fetch(`/api/prompt-stacks/${stack.id}/publish`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(stack: PromptStack) {
    if (!confirm(`Delete stack "${stack.name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/prompt-stacks/${stack.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCreateVersion(stack: PromptStack) {
    try {
      const res = await fetch(`/api/prompt-stacks/${stack.id}/version`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function toggleExpand(id: string) {
    setExpandedStacks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const itemTypeColors: Record<string, string> = {
    BLOCK: "#6366f1",
    SLUG: "#10b981",
    CALLER: "#f59e0b",
    AUTO_SLUGS: "#8b5cf6",
  };

  const localStatusColors: Record<string, string> = {
    DRAFT: "#f59e0b",
    PUBLISHED: "#10b981",
    ARCHIVED: "#6b7280",
  };

  const memoryCategories = ["FACT", "PREFERENCE", "EVENT", "TOPIC", "RELATIONSHIP", "CONTEXT"];

  return (
    <div style={theme.page}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={theme.h1}>Prompt Stacks</h1>
          <p style={theme.subtitle}>
            Compose blocks and slugs into ordered prompt stacks for callers
          </p>
        </div>
        <button onClick={() => setShowCreateForm(true)} style={theme.btnPrimary}>
          + New Stack
        </button>
      </div>

      {/* Status Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setFilterStatus(null)}
            style={!filterStatus ? theme.pillActive : theme.pillInactive}
          >
            All
          </button>
          {["DRAFT", "PUBLISHED", "ARCHIVED"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              style={filterStatus === status
                ? { ...theme.pillActive, background: localStatusColors[status] }
                : theme.pillInactive
              }
            >
              {status}
            </button>
          ))}
        </div>
        {/* Expand/Collapse All */}
        {stacks.length > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setExpandedStacks(new Set(stacks.map(s => s.id)))} style={theme.btnSmall}>
              Expand All
            </button>
            <button onClick={() => setExpandedStacks(new Set())} style={theme.btnSmall}>
              Collapse All
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div style={theme.formContainer}>
          <h3 style={{ ...theme.h3, margin: "0 0 16px 0" }}>
            {editingStack ? "Edit Stack" : "Create New Stack"}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={theme.label}>Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Default Customer Stack"
                  style={theme.input}
                />
              </div>
              <div>
                <label style={theme.label}>Default?</label>
                <label style={{ ...theme.checkboxLabel, paddingTop: 8 }}>
                  <input type="checkbox" checked={formIsDefault} onChange={(e) => setFormIsDefault(e.target.checked)} />
                  <span>Use as default for new callers</span>
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

            {/* Stack Items */}
            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Stack Items (ordered, last wins)</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => addItem("BLOCK")} style={{ padding: "4px 12px", background: itemTypeColors.BLOCK, color: "#fff", border: "none", borderRadius: 4, fontSize: 12, cursor: "pointer" }}>
                    + Block
                  </button>
                  <button type="button" onClick={() => addItem("SLUG")} style={{ padding: "4px 12px", background: itemTypeColors.SLUG, color: "#fff", border: "none", borderRadius: 4, fontSize: 12, cursor: "pointer" }}>
                    + Slug
                  </button>
                  <button type="button" onClick={() => addItem("AUTO_SLUGS")} style={{ padding: "4px 12px", background: itemTypeColors.AUTO_SLUGS, color: "#fff", border: "none", borderRadius: 4, fontSize: 12, cursor: "pointer" }}>
                    + Auto Slugs
                  </button>
                  <button type="button" onClick={() => addItem("CALLER")} style={{ padding: "4px 12px", background: itemTypeColors.CALLER, color: "#fff", border: "none", borderRadius: 4, fontSize: 12, cursor: "pointer" }}>
                    + Caller
                  </button>
                </div>
              </div>

              {formItems.length === 0 ? (
                <div style={{ padding: 24, background: "var(--surface-primary)", border: "1px dashed var(--border-default)", borderRadius: 8, textAlign: "center", fontSize: 13, color: "var(--text-secondary)" }}>
                  No items in stack. Add blocks, slugs, or caller memory items.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {formItems.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        padding: 12,
                        background: "var(--surface-primary)",
                        border: `2px solid ${itemTypeColors[item.itemType || "BLOCK"]}`,
                        borderRadius: 8,
                        opacity: item.isEnabled ? 1 : 0.5,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: itemTypeColors[item.itemType || "BLOCK"] }}>
                            {index + 1}. {item.itemType}
                          </span>
                          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-secondary)" }}>
                            <input type="checkbox" checked={item.isEnabled ?? true} onChange={(e) => updateItem(index, "isEnabled", e.target.checked)} />
                            Enabled
                          </label>
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button type="button" onClick={() => moveItem(index, "up")} disabled={index === 0} style={{ ...theme.btnSmall, padding: "2px 6px", fontSize: 10, opacity: index === 0 ? 0.3 : 1 }}>
                            ▲
                          </button>
                          <button type="button" onClick={() => moveItem(index, "down")} disabled={index === formItems.length - 1} style={{ ...theme.btnSmall, padding: "2px 6px", fontSize: 10, opacity: index === formItems.length - 1 ? 0.3 : 1 }}>
                            ▼
                          </button>
                          <button type="button" onClick={() => removeItem(index)} style={theme.btnDanger}>
                            ✕
                          </button>
                        </div>
                      </div>

                      {item.itemType === "BLOCK" && (
                        <select
                          value={item.blockId || ""}
                          onChange={(e) => updateItem(index, "blockId", e.target.value || null)}
                          style={theme.select}
                        >
                          <option value="">-- Select Block --</option>
                          {blocks.map((b) => (
                            <option key={b.id} value={b.id}>
                              [{b.category}] {b.name} ({b.slug})
                            </option>
                          ))}
                        </select>
                      )}

                      {item.itemType === "SLUG" && (
                        <select
                          value={item.slugId || ""}
                          onChange={(e) => updateItem(index, "slugId", e.target.value || null)}
                          style={theme.select}
                        >
                          <option value="">-- Select Slug --</option>
                          {slugs.map((s) => (
                            <option key={s.id} value={s.id}>
                              [{s.sourceType}] {s.name} ({s.slug})
                            </option>
                          ))}
                        </select>
                      )}

                      {item.itemType === "AUTO_SLUGS" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ padding: 8, background: "#f3e8ff", borderRadius: 4, fontSize: 11, color: "#6b21a8" }}>
                            Auto-collects ALL dynamic prompts that match the caller's parameter values
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
                            <div>
                              <label style={{ ...theme.small, marginBottom: 2, display: "block" }}>Source Types</label>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                {["PARAMETER", "COMPOSITE", "ADAPT"].map((st) => (
                                  <label key={st} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 6px", background: item.autoSlugSourceTypes?.includes(st) ? "var(--surface-secondary)" : "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 4, color: "var(--text-secondary)" }}>
                                    <input
                                      type="checkbox"
                                      checked={item.autoSlugSourceTypes?.includes(st)}
                                      onChange={(e) => {
                                        const current = item.autoSlugSourceTypes || [];
                                        const updated = e.target.checked ? [...current, st] : current.filter((c) => c !== st);
                                        updateItem(index, "autoSlugSourceTypes", updated);
                                      }}
                                    />
                                    {st}
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label style={{ ...theme.small, marginBottom: 2, display: "block" }}>Order By</label>
                              <select
                                value={item.autoSlugOrderBy || "priority"}
                                onChange={(e) => updateItem(index, "autoSlugOrderBy", e.target.value)}
                                style={{ ...theme.select, padding: 4, fontSize: 12 }}
                              >
                                <option value="priority">Priority (high first)</option>
                                <option value="name">Name (A-Z)</option>
                                <option value="domainGroup">Domain Group</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ ...theme.small, marginBottom: 2, display: "block" }}>Max Slugs</label>
                              <input
                                type="number"
                                value={item.autoSlugLimit ?? ""}
                                onChange={(e) => updateItem(index, "autoSlugLimit", e.target.value ? parseInt(e.target.value) : null)}
                                placeholder="∞"
                                style={{ ...theme.input, width: 60, padding: 4, fontSize: 12 }}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {item.itemType === "CALLER" && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                          <div>
                            <label style={{ ...theme.small, marginBottom: 2, display: "block" }}>Memory Categories</label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {memoryCategories.map((cat) => (
                                <label key={cat} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 6px", background: item.callerMemoryCategories?.includes(cat) ? "var(--surface-secondary)" : "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 4, color: "var(--text-secondary)" }}>
                                  <input
                                    type="checkbox"
                                    checked={item.callerMemoryCategories?.includes(cat)}
                                    onChange={(e) => {
                                      const current = item.callerMemoryCategories || [];
                                      const updated = e.target.checked ? [...current, cat] : current.filter((c) => c !== cat);
                                      updateItem(index, "callerMemoryCategories", updated);
                                    }}
                                  />
                                  {cat}
                                </label>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label style={{ ...theme.small, marginBottom: 2, display: "block" }}>Max Memories</label>
                            <input
                              type="number"
                              value={item.callerMemoryLimit ?? 10}
                              onChange={(e) => updateItem(index, "callerMemoryLimit", parseInt(e.target.value) || null)}
                              style={{ ...theme.input, width: 80, padding: 4, fontSize: 12 }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
              <button
                type="submit"
                disabled={saving || !formName}
                style={{ ...theme.btnPrimary, opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Saving..." : editingStack ? "Update Stack" : "Create Stack"}
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

      {/* Stacks List */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>
      ) : stacks.length === 0 ? (
        <div style={theme.emptyState}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No prompt stacks yet</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>Create stacks to compose prompts for callers</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {stacks.map((stack) => (
            <div
              key={stack.id}
              style={stack.isDefault ? theme.cardHighlight : theme.card}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        ...theme.badge,
                        background: localStatusColors[stack.status],
                        color: "#fff",
                      }}
                    >
                      {stack.status}
                    </span>
                    <span style={theme.small}>v{stack.version}</span>
                    {stack.isDefault && (
                      <span style={{ ...theme.badge, background: "var(--status-success-bg)", color: "var(--status-success-text)" }}>DEFAULT</span>
                    )}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{stack.name}</div>
                  {stack.description && <div style={theme.muted}>{stack.description}</div>}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={theme.small}>
                    {stack.itemCount} item{stack.itemCount !== 1 ? "s" : ""} · {stack.callerCount} caller{stack.callerCount !== 1 ? "s" : ""}
                  </span>
                  <button onClick={() => toggleExpand(stack.id)} style={theme.btnSmall}>
                    {expandedStacks.has(stack.id) ? "Hide" : "Show"}
                  </button>
                  {stack.status === "DRAFT" && (
                    <button onClick={() => handlePublish(stack)} style={theme.btnSuccess}>
                      Publish
                    </button>
                  )}
                  {stack.status === "PUBLISHED" && (
                    <button onClick={() => handleCreateVersion(stack)} style={theme.btnSmall}>
                      New Version
                    </button>
                  )}
                  <button onClick={() => startEdit(stack)} style={theme.btnSmall}>
                    Edit
                  </button>
                  {stack.callerCount === 0 && (
                    <button onClick={() => handleDelete(stack)} style={theme.btnDanger}>
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {expandedStacks.has(stack.id) && stack.items.length > 0 && (
                <div style={{ marginTop: 12, padding: 12, background: "var(--surface-secondary)", borderRadius: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>Stack Items (order matters - last wins):</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {stack.items.map((item, index) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: 8,
                          background: "var(--surface-primary)",
                          border: `1px solid ${itemTypeColors[item.itemType]}`,
                          borderRadius: 4,
                          opacity: item.isEnabled ? 1 : 0.5,
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 600, color: itemTypeColors[item.itemType], minWidth: 60 }}>
                          {index + 1}. {item.itemType}
                        </span>
                        {item.block && (
                          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                            <strong>[{item.block.category}]</strong> {item.block.name}
                          </span>
                        )}
                        {item.slug && (
                          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                            <strong>[{item.slug.sourceType}]</strong> {item.slug.name}
                          </span>
                        )}
                        {item.itemType === "AUTO_SLUGS" && (
                          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                            Auto-collect: {item.autoSlugSourceTypes?.join(", ") || "PARAMETER, COMPOSITE"}
                            {item.autoSlugLimit ? ` (max ${item.autoSlugLimit})` : " (unlimited)"}
                          </span>
                        )}
                        {item.itemType === "CALLER" && (
                          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                            Categories: {item.callerMemoryCategories.join(", ") || "None"} (max {item.callerMemoryLimit})
                          </span>
                        )}
                        {!item.isEnabled && <span style={theme.small}>(disabled)</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ ...theme.small, marginTop: 8 }}>
                {stack.publishedAt ? `Published ${new Date(stack.publishedAt).toLocaleDateString()} · ` : ""}
                Updated {new Date(stack.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
