"use client";

import { useEffect, useState, useCallback } from "react";
import { Building2, Plus, Pencil, Trash2, Save, X, Check } from "lucide-react";
import { TERM_KEYS, TERM_KEY_LABELS } from "@/lib/terminology/types";
import type { PanelProps } from "@/lib/settings-panels";
import "./institution-types-panel.css";

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
    <div className="hf-card">
      {/* Header */}
      <div className="itp-header">
        <div className="itp-header-left">
          <div className="itp-header-icon">
            <Building2 size={18} strokeWidth={1.5} />
          </div>
          <h2 className="hf-section-title">
            Institution Types
          </h2>
        </div>
        {!creating && !editingId && (
          <button onClick={startCreate} className="itp-btn-new">
            <Plus size={13} /> New Type
          </button>
        )}
      </div>
      <p className="itp-desc">
        Each type defines what labels users see throughout the app. Admin roles always see technical terms.
      </p>

      {/* Messages */}
      {error && (
        <div className="hf-banner hf-banner-compact hf-banner-error">
          {error}
        </div>
      )}
      {success && (
        <div className="hf-banner hf-banner-compact hf-banner-success">
          <Check size={14} className="itp-check-icon" />
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
        <div className="itp-form-section">
          <h3 className="itp-form-title">
            {creating ? "Create New Type" : "Edit Type"}
          </h3>

          <div className="itp-form-grid">
            <div>
              <label className="itp-form-label">
                Name
              </label>
              <input
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  if (creating) setFormSlug(autoSlug(e.target.value));
                }}
                placeholder="e.g. University"
                className="itp-input"
              />
            </div>
            <div>
              <label className="itp-form-label">
                Slug {!creating && <span className="itp-form-label-hint">(read-only)</span>}
              </label>
              <input
                value={formSlug}
                onChange={(e) => creating && setFormSlug(e.target.value)}
                readOnly={!creating}
                placeholder="e.g. university"
                className={`itp-input${!creating ? " itp-input-readonly" : ""}`}
              />
            </div>
          </div>

          <div className="itp-form-group">
            <label className="itp-form-label">
              Description
            </label>
            <input
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Optional description"
              className="itp-input"
            />
          </div>

          {/* Terminology Editor */}
          <div className="itp-form-group">
            <label className="itp-form-label-terminology">
              Terminology Map
            </label>
            <div className="itp-term-grid">
              {TERM_KEYS.map((key) => (
                <div key={key} className="itp-term-row">
                  <span className="itp-term-label">
                    {TERM_KEY_LABELS[key]}
                  </span>
                  <input
                    value={formTerminology[key] || ""}
                    onChange={(e) =>
                      setFormTerminology((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={`e.g. ${key === "domain" ? "School" : key === "playbook" ? "Lesson Plan" : key}`}
                    className="itp-term-input"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Config row */}
          <div className="itp-form-grid">
            <div>
              <label className="itp-form-label">
                Setup Wizard Spec
              </label>
              <input
                value={formSetupSpec}
                onChange={(e) => setFormSetupSpec(e.target.value)}
                placeholder="e.g. COURSE-SETUP-001"
                className="itp-input"
              />
            </div>
            <div>
              <label className="itp-form-label">
                Default Institution Kind
              </label>
              <select
                value={formDomainKind}
                onChange={(e) => setFormDomainKind(e.target.value as "INSTITUTION" | "COMMUNITY")}
                className="itp-select"
              >
                <option value="INSTITUTION">Institution</option>
                <option value="COMMUNITY">Community</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="itp-form-actions">
            <button
              onClick={handleSave}
              disabled={saving || !formName.trim()}
              className="itp-btn-save"
            >
              <Save size={13} /> {saving ? "Saving..." : creating ? "Create" : "Save Changes"}
            </button>
            <button
              onClick={resetForm}
              className="itp-btn-cancel"
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
              className={[
                "itp-type-row",
                (i === 0 && !creating && !editingId) || i > 0 ? "itp-type-row-border" : "",
                !type.isActive ? "itp-type-row-inactive" : "",
              ].filter(Boolean).join(" ")}
            >
              <div className="itp-type-content">
                <div className="itp-type-main">
                  <div className="itp-type-name-row">
                    <span className="itp-type-name">
                      {type.name}
                    </span>
                    <span className="itp-type-slug">
                      {type.slug}
                    </span>
                    {!type.isActive && (
                      <span className="itp-type-inactive-badge">
                        Inactive
                      </span>
                    )}
                    <span className="itp-type-count">
                      {type._count.institutions} institution{type._count.institutions !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {type.description && (
                    <p className="itp-type-desc">
                      {type.description}
                    </p>
                  )}

                  {/* Terminology preview */}
                  <div className="itp-term-preview">
                    {TERM_KEYS.map((key) => (
                      <span key={key} className="itp-term-chip">
                        <span className="itp-term-chip-key">{key}:</span>{" "}
                        {type.terminology[key] || "\u2014"}
                      </span>
                    ))}
                  </div>

                  {/* Config details */}
                  <div className="itp-config-row">
                    {type.setupSpecSlug && (
                      <span>Wizard: <strong>{type.setupSpecSlug}</strong></span>
                    )}
                    <span>Kind: <strong>{type.defaultDomainKind}</strong></span>
                  </div>
                </div>

                {/* Actions */}
                <div className="itp-actions">
                  <button
                    onClick={() => startEdit(type)}
                    title="Edit"
                    className="itp-btn-action"
                  >
                    <Pencil size={13} />
                  </button>
                  {type.isActive && (
                    <button
                      onClick={() => handleDeactivate(type.id, type.name)}
                      title="Deactivate"
                      className="itp-btn-action itp-btn-action-danger"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {types.length === 0 && (
            <div className="itp-empty">
              No institution types configured. Click &quot;New Type&quot; to create one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
