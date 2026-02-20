"use client";

import { useEffect, useState, useCallback } from "react";
import { Building2, Plus, Pencil, Trash2, Save, X, Check } from "lucide-react";
import { TERM_KEYS, TERM_KEY_LABELS } from "@/lib/terminology/types";
import type { PanelProps } from "@/lib/settings-panels";

interface InstitutionType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  terminology: Record<string, string>;
  setupSpecSlug: string | null;
  defaultDomainKind: "INSTITUTION" | "COMMUNITY";
  _count: { institutions: number };
  createdAt: string;
}

const EMPTY_TERMINOLOGY: Record<string, string> = Object.fromEntries(
  TERM_KEYS.map((k) => [k, ""])
);

export function InstitutionTypesPanel(_props: PanelProps) {
  const [types, setTypes] = useState<InstitutionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTerminology, setFormTerminology] = useState<Record<string, string>>({ ...EMPTY_TERMINOLOGY });
  const [formSetupSpec, setFormSetupSpec] = useState("");
  const [formDomainKind, setFormDomainKind] = useState<"INSTITUTION" | "COMMUNITY">("INSTITUTION");

  const fetchTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/institution-types");
      const data = await res.json();
      if (data.ok) setTypes(data.types);
    } catch {
      setError("Failed to load institution types");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const resetForm = () => {
    setFormName("");
    setFormSlug("");
    setFormDescription("");
    setFormTerminology({ ...EMPTY_TERMINOLOGY });
    setFormSetupSpec("");
    setFormDomainKind("INSTITUTION");
    setEditingId(null);
    setCreating(false);
    setError(null);
  };

  const startEdit = (type: InstitutionType) => {
    setCreating(false);
    setEditingId(type.id);
    setFormName(type.name);
    setFormSlug(type.slug);
    setFormDescription(type.description || "");
    setFormTerminology({ ...EMPTY_TERMINOLOGY, ...type.terminology });
    setFormSetupSpec(type.setupSpecSlug || "");
    setFormDomainKind(type.defaultDomainKind);
    setError(null);
    setSuccess(null);
  };

  const startCreate = () => {
    setEditingId(null);
    setCreating(true);
    setFormName("");
    setFormSlug("");
    setFormDescription("");
    setFormTerminology({ ...EMPTY_TERMINOLOGY });
    setFormSetupSpec("");
    setFormDomainKind("INSTITUTION");
    setError(null);
    setSuccess(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (creating) {
        const res = await fetch("/api/admin/institution-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            slug: formSlug,
            description: formDescription || null,
            terminology: formTerminology,
            setupSpecSlug: formSetupSpec || null,
            defaultDomainKind: formDomainKind,
          }),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.error || "Failed to create");
          return;
        }
        setSuccess(`Created "${data.type.name}"`);
        resetForm();
        await fetchTypes();
      } else if (editingId) {
        const res = await fetch(`/api/admin/institution-types/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            description: formDescription || null,
            terminology: formTerminology,
            setupSpecSlug: formSetupSpec || null,
            defaultDomainKind: formDomainKind,
          }),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.error || "Failed to update");
          return;
        }
        setSuccess(`Updated "${data.type.name}"`);
        resetForm();
        await fetchTypes();
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`Deactivate "${name}"? Institutions using this type will fall back to technical terms.`)) return;
    try {
      const res = await fetch(`/api/admin/institution-types/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setSuccess(`Deactivated "${name}"`);
        await fetchTypes();
      }
    } catch {
      setError("Failed to deactivate");
    }
  };

  const autoSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  return (
    <div style={{
      background: "var(--surface-primary)",
      border: "1px solid var(--border-default)",
      borderRadius: 16,
      padding: 24,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ color: "var(--text-muted)" }}>
            <Building2 size={18} strokeWidth={1.5} />
          </div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Institution Types
          </h2>
        </div>
        {!creating && !editingId && (
          <button
            onClick={startCreate}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              background: "var(--button-primary-bg)",
              color: "var(--button-primary-text)",
              border: "none",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Plus size={13} /> New Type
          </button>
        )}
      </div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, marginTop: 0 }}>
        Each type defines what labels users see throughout the app. Admin roles always see technical terms.
      </p>

      {/* Messages */}
      {error && (
        <div style={{ padding: "10px 16px", background: "var(--status-error-bg)", border: "1px solid var(--status-error-border)", borderRadius: 8, color: "var(--status-error-text)", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: "10px 16px", background: "var(--status-success-bg)", border: "1px solid var(--status-success-border)", borderRadius: 8, color: "var(--status-success-text)", fontSize: 13, marginBottom: 16 }}>
          <Check size={14} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
          {success}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="animate-pulse space-y-3">
          <div className="h-16 rounded bg-[var(--surface-secondary)]" />
          <div className="h-16 rounded bg-[var(--surface-secondary)]" />
        </div>
      )}

      {/* Create/Edit Form */}
      {(creating || editingId) && (
        <div style={{
          paddingTop: 16,
          marginTop: 4,
          marginBottom: 16,
          borderTop: "1px solid var(--border-default)",
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14, marginTop: 0 }}>
            {creating ? "Create New Type" : "Edit Type"}
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Name
              </label>
              <input
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  if (creating) setFormSlug(autoSlug(e.target.value));
                }}
                placeholder="e.g. University"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  fontSize: 13,
                  background: "var(--surface-secondary)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Slug {!creating && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>(read-only)</span>}
              </label>
              <input
                value={formSlug}
                onChange={(e) => creating && setFormSlug(e.target.value)}
                readOnly={!creating}
                placeholder="e.g. university"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  fontSize: 13,
                  background: creating ? "var(--surface-secondary)" : "var(--surface-tertiary, var(--surface-secondary))",
                  color: "var(--text-primary)",
                  opacity: creating ? 1 : 0.7,
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              Description
            </label>
            <input
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Optional description"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                fontSize: 13,
                background: "var(--surface-secondary)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Terminology Editor */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>
              Terminology Map
            </label>
            <div style={{
              display: "grid",
              gridTemplateColumns: "110px 1fr",
              gap: "6px 10px",
              alignItems: "center",
              padding: 14,
              background: "var(--surface-secondary)",
              borderRadius: 8,
              border: "1px solid var(--border-default)",
            }}>
              {TERM_KEYS.map((key) => (
                <div key={key} style={{ display: "contents" }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>
                    {TERM_KEY_LABELS[key]}
                  </span>
                  <input
                    value={formTerminology[key] || ""}
                    onChange={(e) =>
                      setFormTerminology((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={`e.g. ${key === "domain" ? "School" : key === "playbook" ? "Lesson Plan" : key}`}
                    style={{
                      padding: "5px 10px",
                      border: "1px solid var(--border-default)",
                      borderRadius: 6,
                      fontSize: 12,
                      background: "var(--surface-primary)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Config row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Setup Wizard Spec
              </label>
              <input
                value={formSetupSpec}
                onChange={(e) => setFormSetupSpec(e.target.value)}
                placeholder="e.g. COURSE-SETUP-001"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  fontSize: 13,
                  background: "var(--surface-secondary)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Default Domain Kind
              </label>
              <select
                value={formDomainKind}
                onChange={(e) => setFormDomainKind(e.target.value as "INSTITUTION" | "COMMUNITY")}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  fontSize: 13,
                  background: "var(--surface-secondary)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="INSTITUTION">Institution</option>
                <option value="COMMUNITY">Community</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleSave}
              disabled={saving || !formName.trim()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 18px",
                background: saving ? "var(--border-default)" : "var(--button-primary-bg)",
                color: saving ? "var(--text-muted)" : "var(--button-primary-text)",
                border: "none",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              <Save size={13} /> {saving ? "Saving..." : creating ? "Create" : "Save Changes"}
            </button>
            <button
              onClick={resetForm}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                background: "var(--surface-secondary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <X size={13} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Types List */}
      {!loading && (
        <div>
          {types.map((type, i) => (
            <div
              key={type.id}
              style={{
                padding: "14px 0",
                borderTop: i === 0 && !creating && !editingId ? "1px solid var(--border-default)" : i > 0 ? "1px solid var(--border-default)" : undefined,
                opacity: type.isActive ? 1 : 0.5,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                      {type.name}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 7px",
                      borderRadius: 4,
                      background: "color-mix(in srgb, var(--accent-primary) 10%, transparent)",
                      color: "var(--accent-primary)",
                    }}>
                      {type.slug}
                    </span>
                    {!type.isActive && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 7px",
                        borderRadius: 4,
                        background: "var(--status-error-bg)",
                        color: "var(--status-error-text)",
                      }}>
                        Inactive
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {type._count.institutions} institution{type._count.institutions !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {type.description && (
                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
                      {type.description}
                    </p>
                  )}

                  {/* Terminology preview */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                    {TERM_KEYS.map((key) => (
                      <span
                        key={key}
                        style={{
                          fontSize: 10,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "var(--surface-secondary)",
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border-default)",
                        }}
                      >
                        <span style={{ color: "var(--text-muted)" }}>{key}:</span>{" "}
                        {type.terminology[key] || "\u2014"}
                      </span>
                    ))}
                  </div>

                  {/* Config details */}
                  <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
                    {type.setupSpecSlug && (
                      <span>Wizard: <strong>{type.setupSpecSlug}</strong></span>
                    )}
                    <span>Kind: <strong>{type.defaultDomainKind}</strong></span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8 }}>
                  <button
                    onClick={() => startEdit(type)}
                    title="Edit"
                    style={{
                      padding: 5,
                      background: "transparent",
                      border: "1px solid var(--border-default)",
                      borderRadius: 6,
                      cursor: "pointer",
                      color: "var(--text-muted)",
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                  {type.isActive && (
                    <button
                      onClick={() => handleDeactivate(type.id, type.name)}
                      title="Deactivate"
                      style={{
                        padding: 5,
                        background: "transparent",
                        border: "1px solid var(--border-default)",
                        borderRadius: 6,
                        cursor: "pointer",
                        color: "var(--status-error-text)",
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {types.length === 0 && (
            <div style={{
              textAlign: "center",
              padding: "32px 0",
              color: "var(--text-muted)",
              fontSize: 13,
              borderTop: "1px solid var(--border-default)",
            }}>
              No institution types configured. Click &quot;New Type&quot; to create one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
