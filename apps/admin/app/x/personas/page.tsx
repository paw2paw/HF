"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/src/components/shared/Badges";

type PersonaColor = { bg: string; border: string; text: string };

type PersonaSummary = {
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  color: PersonaColor;
};

type PersonasResponse = {
  ok: boolean;
  source: string;
  specId: string | null;
  defaultPersona: string;
  personas: PersonaSummary[];
};

const defaultColors: PersonaColor[] = [
  { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" }, // Blue
  { bg: "#fce7f3", border: "#ec4899", text: "#9d174d" }, // Pink
  { bg: "#d1fae5", border: "#10b981", text: "#065f46" }, // Green
  { bg: "#fef3c7", border: "#f59e0b", text: "#78350f" }, // Amber
  { bg: "#e0e7ff", border: "#6366f1", text: "#3730a3" }, // Indigo
  { bg: "#fce7f3", border: "#f43f5e", text: "#9f1239" }, // Rose
  { bg: "#ccfbf1", border: "#14b8a6", text: "#115e59" }, // Teal
  { bg: "#f3e8ff", border: "#a855f7", text: "#6b21a8" }, // Purple
];

const defaultIcons = ["🎭", "🧠", "💡", "🌟", "🎯", "🔮", "🦋", "🌈", "🎨", "🧭", "🔥", "💫"];

// Shared button styles
const buttonBase: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: 14,
  fontWeight: 500,
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  transition: "opacity 150ms, background-color 150ms",
};

const primaryButton: React.CSSProperties = {
  ...buttonBase,
  background: "var(--accent-primary)",
  color: "white",
};

const secondaryButton: React.CSSProperties = {
  ...buttonBase,
  background: "var(--surface-secondary)",
  color: "var(--text-secondary)",
  border: "1px solid var(--border-default)",
};

const dangerButton: React.CSSProperties = {
  ...buttonBase,
  background: "var(--status-error-bg)",
  color: "var(--status-error-text)",
  border: "1px solid var(--status-error-border, #fecaca)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  fontSize: 14,
  border: "1px solid var(--border-default)",
  borderRadius: 6,
  background: "var(--surface-secondary)",
  color: "var(--text-primary)",
};

export default function PersonasPage() {
  const [data, setData] = useState<PersonasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New persona form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIcon, setNewIcon] = useState("🎭");
  const [newColorIndex, setNewColorIndex] = useState(0);
  const [creating, setCreating] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/personas");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to fetch");
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createPersona = async () => {
    if (!newSlug || !newName) {
      alert("Slug and name are required");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/onboarding/personas/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: newSlug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          name: newName,
          description: newDescription,
          icon: newIcon,
          color: defaultColors[newColorIndex],
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      // Reset form and refresh
      setShowNewForm(false);
      setNewSlug("");
      setNewName("");
      setNewDescription("");
      setNewIcon("🎭");
      setNewColorIndex(0);
      fetchData();
    } catch (e: any) {
      alert("Failed to create: " + e.message);
    } finally {
      setCreating(false);
    }
  };

  const deletePersona = async (slug: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/onboarding/personas/manage?slug=${slug}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      setDeleteTarget(null);
      fetchData();
    } catch (e: any) {
      alert("Failed to delete: " + e.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        Loading personas...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ padding: 16, background: "var(--status-error-bg)", color: "var(--status-error-text)", borderRadius: 8 }}>
          Error: {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 32 }}>🎭</span>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Personas
            </h1>
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            style={{
              ...primaryButton,
              padding: "10px 20px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>+</span> New Persona
          </button>
        </div>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
          Manage agent personas for first-call onboarding. Each persona defines a unique welcome experience.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Badge
            text={data.source === "database" ? "Loaded from DB" : "Hardcoded defaults"}
            tone={data.source === "database" ? "success" : "warning"}
            variant="soft"
          />
          <Badge
            text={`${data.personas.length} persona${data.personas.length !== 1 ? "s" : ""}`}
            tone="neutral"
            variant="soft"
          />
        </div>
      </div>

      {/* New Persona Form */}
      {showNewForm && (
        <div style={{
          marginBottom: 24,
          padding: 20,
          background: "var(--surface-primary)",
          border: "2px solid var(--accent-primary)",
          borderRadius: 12,
        }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
            Create New Persona
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
                Slug (URL-safe identifier)
              </label>
              <input
                type="text"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                placeholder="e.g., mentor"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
                Display Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Mentor"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
              Description
            </label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="e.g., Career and life guidance"
              style={inputStyle}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
                Icon
              </label>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {defaultIcons.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setNewIcon(icon)}
                    style={{
                      width: 36,
                      height: 36,
                      fontSize: 20,
                      background: newIcon === icon ? "var(--accent-primary)" : "var(--surface-secondary)",
                      border: newIcon === icon ? "2px solid var(--accent-primary)" : "1px solid var(--border-default)",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
                Color Theme
              </label>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {defaultColors.map((color, i) => (
                  <button
                    key={i}
                    onClick={() => setNewColorIndex(i)}
                    style={{
                      width: 36,
                      height: 36,
                      background: color.bg,
                      border: newColorIndex === i ? `3px solid ${color.border}` : `1px solid ${color.border}`,
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div style={{
            marginBottom: 16,
            padding: 12,
            background: defaultColors[newColorIndex].bg,
            borderRadius: 8,
            border: `1px solid ${defaultColors[newColorIndex].border}40`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 24 }}>{newIcon}</span>
              <div>
                <span style={{ fontWeight: 600, color: defaultColors[newColorIndex].text }}>
                  {newName || "New Persona"}
                </span>
                {newDescription && (
                  <p style={{ margin: 0, fontSize: 12, color: defaultColors[newColorIndex].text, opacity: 0.8 }}>
                    {newDescription}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowNewForm(false)} style={secondaryButton}>
              Cancel
            </button>
            <button
              onClick={createPersona}
              disabled={creating || !newSlug || !newName}
              style={{
                ...primaryButton,
                opacity: creating || !newSlug || !newName ? 0.5 : 1,
                cursor: creating || !newSlug || !newName ? "not-allowed" : "pointer",
              }}
            >
              {creating ? "Creating..." : "Create Persona"}
            </button>
          </div>
        </div>
      )}

      {/* Personas Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {data.personas.map((persona, idx) => {
          const isDefault = data.defaultPersona === persona.slug;
          // Fallback color if persona.color is missing
          const color = persona.color ?? defaultColors[idx % defaultColors.length];

          return (
            <div
              key={persona.slug}
              style={{
                padding: 16,
                background: color.bg,
                borderRadius: 12,
                border: `1px solid ${color.border}40`,
                position: "relative",
              }}
            >
              {isDefault && (
                <div style={{ position: "absolute", top: 8, right: 8 }}>
                  <Badge text="Default" tone="brand" variant="solid" size="sm" />
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 36 }}>{persona.icon}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: color.text }}>
                    {persona.name}
                  </h3>
                  <code style={{ fontSize: 11, color: color.text, opacity: 0.7 }}>
                    {persona.slug}
                  </code>
                </div>
              </div>

              {persona.description && (
                <p style={{ margin: "0 0 12px 0", fontSize: 13, color: color.text, opacity: 0.8 }}>
                  {persona.description}
                </p>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <Link
                  href={`/x/onboarding?persona=${persona.slug}`}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    fontSize: 13,
                    fontWeight: 500,
                    background: "white",
                    color: color.text,
                    border: `1px solid ${color.border}`,
                    borderRadius: 6,
                    textDecoration: "none",
                    textAlign: "center",
                  }}
                >
                  Configure
                </Link>
                {!isDefault && (
                  <button
                    onClick={() => setDeleteTarget(persona.slug)}
                    style={{
                      ...dangerButton,
                      padding: "8px 12px",
                      fontSize: 13,
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            background: "var(--surface-primary)",
            padding: 24,
            borderRadius: 12,
            maxWidth: 400,
            width: "90%",
            boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
          }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
              Delete Persona?
            </h3>
            <p style={{ margin: "0 0 20px 0", fontSize: 14, color: "var(--text-secondary)" }}>
              Are you sure you want to delete the <strong>{deleteTarget}</strong> persona? This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteTarget(null)} style={secondaryButton}>
                Cancel
              </button>
              <button
                onClick={() => deletePersona(deleteTarget)}
                disabled={deleting}
                style={{
                  ...dangerButton,
                  background: "var(--status-error-text, #dc2626)",
                  color: "white",
                  opacity: deleting ? 0.7 : 1,
                  cursor: deleting ? "wait" : "pointer",
                }}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
