"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface InstitutionDetail {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  welcomeMessage: string | null;
  isActive: boolean;
  userCount: number;
  cohortCount: number;
}

export default function InstitutionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [institution, setInstitution] = useState<InstitutionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#4f46e5");
  const [secondaryColor, setSecondaryColor] = useState("#3b82f6");
  const [welcomeMessage, setWelcomeMessage] = useState("");

  useEffect(() => {
    fetch(`/api/institutions/${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) {
          const inst = res.institution;
          setInstitution(inst);
          setName(inst.name);
          setLogoUrl(inst.logoUrl || "");
          setPrimaryColor(inst.primaryColor || "#4f46e5");
          setSecondaryColor(inst.secondaryColor || "#3b82f6");
          setWelcomeMessage(inst.welcomeMessage || "");
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    const res = await fetch(`/api/institutions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        logoUrl: logoUrl || null,
        primaryColor: primaryColor || null,
        secondaryColor: secondaryColor || null,
        welcomeMessage: welcomeMessage || null,
      }),
    });

    const data = await res.json();
    if (data.ok) {
      setInstitution(data.institution);
      setMessage("Saved");
      setTimeout(() => setMessage(""), 2000);
    } else {
      setMessage(data.error || "Save failed");
    }
    setSaving(false);
  };

  if (loading) {
    return <div style={{ padding: 32, color: "var(--text-muted)", fontSize: 14 }}>Loading...</div>;
  }

  if (!institution) {
    return <div style={{ padding: 32, color: "var(--status-error-text)", fontSize: 14 }}>Institution not found</div>;
  }

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
          {institution.name}
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "monospace" }}>
          {institution.slug}
        </p>
      </div>

      {/* Branding Preview */}
      <div
        style={{
          background: "var(--surface-secondary)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo preview"
            style={{ height: 40, objectFit: "contain" }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: 8, background: primaryColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 18 }}>
            {name.charAt(0)}
          </div>
        )}
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, color: "var(--text-primary)" }}>{name || "Institution Name"}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {institution.userCount} users, {institution.cohortCount} cohorts
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: primaryColor, border: "1px solid var(--border-default)" }} title="Primary" />
          <div style={{ width: 24, height: 24, borderRadius: 6, background: secondaryColor, border: "1px solid var(--border-default)" }} title="Secondary" />
        </div>
      </div>

      {/* Edit Form */}
      <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="School name" style={inputStyle} />
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
            <label style={labelStyle}>Welcome Message (shown on join page)</label>
            <textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="Welcome to our learning platform!"
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
            <button
              onClick={handleSave}
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
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {message && (
              <span style={{ fontSize: 13, color: message === "Saved" ? "var(--status-success-text)" : "var(--status-error-text)" }}>
                {message}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
