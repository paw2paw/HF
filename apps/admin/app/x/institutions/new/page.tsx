"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewInstitutionPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#4f46e5");
  const [secondaryColor, setSecondaryColor] = useState("#3b82f6");
  const [welcomeMessage, setWelcomeMessage] = useState("");

  const autoSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const handleCreate = async () => {
    setSaving(true);
    setError("");

    const res = await fetch("/api/institutions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        slug: (slug || autoSlug).trim(),
        logoUrl: logoUrl || null,
        primaryColor: primaryColor || null,
        secondaryColor: secondaryColor || null,
        welcomeMessage: welcomeMessage || null,
      }),
    });

    const data = await res.json();
    if (data.ok) {
      router.push(`/x/institutions/${data.institution.id}`);
    } else {
      setError(data.error || "Failed to create institution");
    }
    setSaving(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid var(--input-border)",
    borderRadius: 8,
    fontSize: 14,
    background: "var(--input-bg)",
    color: "var(--text-primary)",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: 6,
  };

  return (
    <div style={{ paddingBottom: 40, maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => router.push("/x/institutions")}
          style={{
            background: "none",
            border: "none",
            color: "var(--accent-primary)",
            cursor: "pointer",
            fontSize: 13,
            padding: 0,
            marginBottom: 8,
          }}
        >
          &larr; Back to Institutions
        </button>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>
          New Institution
        </h1>
      </div>

      <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label style={labelStyle}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Greenwood Academy"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Slug *</label>
            <input
              type="text"
              value={slug || autoSlug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="greenwood-academy"
              style={{ ...inputStyle, fontFamily: "monospace" }}
            />
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              URL-safe identifier (lowercase, hyphens only)
            </p>
          </div>

          <div>
            <label style={labelStyle}>Logo URL</label>
            <input type="text" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Primary Color</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                style={{ width: 48, height: 40, border: "1px solid var(--input-border)", borderRadius: 6, cursor: "pointer" }}
              />
              <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#4f46e5" style={{ ...inputStyle, flex: 1 }} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Secondary Color</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                style={{ width: 48, height: 40, border: "1px solid var(--input-border)", borderRadius: 6, cursor: "pointer" }}
              />
              <input type="text" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} placeholder="#3b82f6" style={{ ...inputStyle, flex: 1 }} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Welcome Message</label>
            <textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="Welcome to our learning platform!"
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {error && (
            <div style={{ padding: 10, background: "color-mix(in srgb, var(--status-error-text) 10%, transparent)", color: "var(--status-error-text)", borderRadius: 8, fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            <button
              onClick={handleCreate}
              disabled={saving || !name.trim()}
              style={{
                padding: "12px 24px",
                background: saving || !name.trim() ? "var(--border-default)" : "var(--button-primary-bg)",
                color: saving || !name.trim() ? "var(--text-muted)" : "var(--button-primary-text)",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: saving || !name.trim() ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Creating..." : "Create Institution"}
            </button>
            <button
              onClick={() => router.back()}
              style={{
                padding: "12px 24px",
                background: "var(--surface-secondary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
