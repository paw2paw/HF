"use client";

import { useEffect, useState, useCallback } from "react";
import { Building2, Plus, Pencil, Trash2, Save, X, Check } from "lucide-react";
import { TERM_KEYS, TERM_KEY_LABELS } from "@/lib/terminology/types";

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

export default function InstitutionTypesPage() {
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

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-[var(--surface-secondary)]" />
          <div className="h-64 rounded-lg bg-[var(--surface-secondary)]" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10 }}>
            <Building2 size={24} />
            Institution Types
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            Manage institution types and their terminology presets. Each type defines what labels users see throughout the app.
          </p>
        </div>
        {!creating && !editingId && (
          <button
            onClick={startCreate}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              background: "var(--button-primary-bg)",
              color: "var(--button-primary-text)",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Plus size={14} /> New Type
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div style={{ padding: "10px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: "10px 16px", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, color: "#065f46", fontSize: 13, marginBottom: 16 }}>
          <Check size={14} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
          {success}
        </div>
      )}

      {/* Create/Edit Form */}
      {(creating || editingId) && (
        <div style={{
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
            {creating ? "Create New Institution Type" : "Edit Institution Type"}
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
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
                  fontSize: 14,
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
                  fontSize: 14,
                  background: creating ? "var(--surface-secondary)" : "var(--surface-tertiary, var(--surface-secondary))",
                  color: "var(--text-primary)",
                  opacity: creating ? 1 : 0.7,
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
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
                fontSize: 14,
                background: "var(--surface-secondary)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Terminology Editor */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>
              Terminology Map
            </label>
            <div style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr",
              gap: "8px 12px",
              alignItems: "center",
              padding: 16,
              background: "var(--surface-secondary)",
              borderRadius: 8,
              border: "1px solid var(--border-default)",
            }}>
              {TERM_KEYS.map((key) => (
                <div key={key} style={{ display: "contents" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
                    {TERM_KEY_LABELS[key]}
                  </span>
                  <input
                    value={formTerminology[key] || ""}
                    onChange={(e) =>
                      setFormTerminology((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={`e.g. ${key === "domain" ? "School" : key === "playbook" ? "Lesson Plan" : key}`}
                    style={{
                      padding: "6px 10px",
                      border: "1px solid var(--border-default)",
                      borderRadius: 6,
                      fontSize: 13,
                      background: "var(--surface-primary)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Config row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
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
                  fontSize: 14,
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
                  fontSize: 14,
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
                padding: "8px 20px",
                background: saving ? "var(--border-default)" : "var(--button-primary-bg)",
                color: saving ? "var(--text-muted)" : "var(--button-primary-text)",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              <Save size={14} /> {saving ? "Saving..." : creating ? "Create" : "Save Changes"}
            </button>
            <button
              onClick={resetForm}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                background: "var(--surface-secondary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Types List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {types.map((type) => (
          <div
            key={type.id}
            style={{
              background: "var(--surface-primary)",
              border: `1px solid ${editingId === type.id ? "var(--accent-primary)" : "var(--border-default)"}`,
              borderRadius: 12,
              padding: 20,
              opacity: type.isActive ? 1 : 0.5,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                    {type.name}
                  </span>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: "color-mix(in srgb, var(--accent-primary) 10%, transparent)",
                    color: "var(--accent-primary)",
                  }}>
                    {type.slug}
                  </span>
                  {!type.isActive && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "#fef2f2",
                      color: "#991b1b",
                    }}>
                      Inactive
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {type._count.institutions} institution{type._count.institutions !== 1 ? "s" : ""}
                  </span>
                </div>
                {type.description && (
                  <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
                    {type.description}
                  </p>
                )}

                {/* Terminology preview */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {TERM_KEYS.map((key) => (
                    <span
                      key={key}
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        borderRadius: 4,
                        background: "var(--surface-secondary)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      <span style={{ color: "var(--text-muted)" }}>{key}:</span>{" "}
                      {type.terminology[key] || "—"}
                    </span>
                  ))}
                </div>

                {/* Config details */}
                <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
                  {type.setupSpecSlug && (
                    <span>Wizard: <strong>{type.setupSpecSlug}</strong></span>
                  )}
                  <span>Kind: <strong>{type.defaultDomainKind}</strong></span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => startEdit(type)}
                  title="Edit"
                  style={{
                    padding: 6,
                    background: "transparent",
                    border: "1px solid var(--border-default)",
                    borderRadius: 6,
                    cursor: "pointer",
                    color: "var(--text-muted)",
                  }}
                >
                  <Pencil size={14} />
                </button>
                {type.isActive && (
                  <button
                    onClick={() => handleDeactivate(type.id, type.name)}
                    title="Deactivate"
                    style={{
                      padding: 6,
                      background: "transparent",
                      border: "1px solid var(--border-default)",
                      borderRadius: 6,
                      cursor: "pointer",
                      color: "#dc2626",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {types.length === 0 && !loading && (
          <div style={{
            textAlign: "center",
            padding: 48,
            color: "var(--text-muted)",
            fontSize: 14,
          }}>
            No institution types configured. Click "New Type" to create one.
          </div>
        )}
      </div>
    </div>
  );
}
