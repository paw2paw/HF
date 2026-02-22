"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  type TerminologyPresetId,
  type TerminologyConfig,
  type TerminologyOverrides,
  TERMINOLOGY_PRESETS,
  PRESET_OPTIONS,
  resolveTerminology,
} from "@/lib/terminology/types";
import "./institution-detail.css";

interface InstitutionDetail {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  welcomeMessage: string | null;
  terminology: TerminologyConfig | null;
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
  const [fetchError, setFetchError] = useState<"forbidden" | "not-found" | null>(null);

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#4f46e5");
  const [secondaryColor, setSecondaryColor] = useState("#3b82f6");
  const [welcomeMessage, setWelcomeMessage] = useState("");

  // Terminology state
  const [termPreset, setTermPreset] = useState<TerminologyPresetId>("corporate");
  const [termOverrides, setTermOverrides] = useState<TerminologyOverrides>({});
  const [showTermCustomize, setShowTermCustomize] = useState(false);

  const resolvedTerms = resolveTerminology({ preset: termPreset, overrides: termOverrides });

  useEffect(() => {
    fetch(`/api/institutions/${id}`)
      .then((r) => {
        if (r.status === 403) {
          setFetchError("forbidden");
          return null;
        }
        if (r.status === 404) {
          setFetchError("not-found");
          return null;
        }
        return r.json();
      })
      .then((res) => {
        if (res?.ok) {
          const inst = res.institution;
          setInstitution(inst);
          setName(inst.name);
          setLogoUrl(inst.logoUrl || "");
          setPrimaryColor(inst.primaryColor || "#4f46e5");
          setSecondaryColor(inst.secondaryColor || "#3b82f6");
          setWelcomeMessage(inst.welcomeMessage || "");
          if (inst.terminology) {
            setTermPreset(inst.terminology.preset || "corporate");
            setTermOverrides(inst.terminology.overrides || {});
          }
        } else if (res && !res.ok) {
          setFetchError("not-found");
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    const terminologyConfig: TerminologyConfig = {
      preset: termPreset,
      ...(Object.keys(termOverrides).length > 0 ? { overrides: termOverrides } : {}),
    };

    const res = await fetch(`/api/institutions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        logoUrl: logoUrl || null,
        primaryColor: primaryColor || null,
        secondaryColor: secondaryColor || null,
        welcomeMessage: welcomeMessage || null,
        terminology: terminologyConfig,
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
    return <div className="inst-loading">Loading...</div>;
  }

  if (fetchError === "forbidden") {
    return (
      <div className="inst-forbidden">
        <p className="inst-forbidden-msg">
          You don&apos;t have permission to view this institution.
        </p>
        <button
          onClick={() => router.push("/x")}
          className="inst-link-btn"
        >
          &larr; Go to dashboard
        </button>
      </div>
    );
  }

  if (!institution) {
    return <div className="inst-error">Institution not found</div>;
  }

  return (
    <div className="inst-page">
      <div className="inst-header">
        <button
          onClick={() => router.push("/x/institutions")}
          className="inst-back-btn"
        >
          &larr; Back to Institutions
        </button>
        <h1 className="hf-page-title">
          {institution.name}
        </h1>
        <p className="inst-slug">
          {institution.slug}
        </p>
      </div>

      {/* Branding Preview */}
      <div className="inst-preview">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo preview"
            className="inst-preview-logo"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="inst-preview-avatar" style={{ background: primaryColor }}>
            {name.charAt(0)}
          </div>
        )}
        <div>
          <div className="inst-preview-name">{name || "Institution Name"}</div>
          <div className="inst-preview-stats">
            {institution.userCount} users, {institution.cohortCount} cohorts
          </div>
        </div>
        <div className="inst-preview-swatches">
          <div className="inst-swatch" style={{ background: primaryColor }} title="Primary" />
          <div className="inst-swatch" style={{ background: secondaryColor }} title="Secondary" />
        </div>
      </div>

      {/* Edit Form */}
      <div className="inst-form-card">
        <div className="inst-form-fields">
          <div>
            <label className="inst-label">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Institution name" className="inst-input" />
          </div>

          <div>
            <label className="inst-label">Logo URL</label>
            <input type="text" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" className="inst-input" />
          </div>

          <div>
            <label className="inst-label">Primary Color</label>
            <div className="inst-color-row">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="inst-color-picker"
              />
              <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#4f46e5" className="inst-input hf-flex-1" />
            </div>
          </div>

          <div>
            <label className="inst-label">Secondary Color</label>
            <div className="inst-color-row">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="inst-color-picker"
              />
              <input type="text" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} placeholder="#3b82f6" className="inst-input hf-flex-1" />
            </div>
          </div>

          <div>
            <label className="inst-label">Welcome Message (shown on join page)</label>
            <textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="Welcome to our learning platform!"
              rows={3}
              className="inst-textarea"
            />
          </div>
        </div>
      </div>

      {/* Terminology Profile */}
      <div className="inst-form-card">
        <h2 className="inst-term-title">
          Terminology Profile
        </h2>
        <p className="inst-term-desc">
          Choose how your institution labels key concepts. This affects sidebar navigation and dashboard labels for all users in this institution.
        </p>

        {/* Preset Picker */}
        <div className="inst-preset-grid">
          {PRESET_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => { setTermPreset(opt.id); setTermOverrides({}); setShowTermCustomize(false); }}
              className={`inst-preset-btn ${termPreset === opt.id ? "inst-preset-btn-active" : ""}`}
            >
              <div className="inst-preset-label">
                {opt.label}
              </div>
              <div className="inst-preset-desc">
                {opt.description}
              </div>
            </button>
          ))}
        </div>

        {/* Preview Table */}
        <div className="inst-preview-table">
          <div className="inst-preview-heading">
            Preview
          </div>
          <div className="inst-preview-grid">
            {(["institution", "cohort", "learner", "instructor", "supervisor"] as const).map((key) => (
              <div key={key} className="inst-preview-row">
                <span className="inst-preview-key">{key}</span>
                <span className="inst-preview-value">
                  {resolvedTerms[key]}
                  {termOverrides[key] && (
                    <span className="inst-custom-badge">custom</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Customize Toggle */}
        <button
          onClick={() => setShowTermCustomize(!showTermCustomize)}
          className="inst-customize-btn"
        >
          {showTermCustomize ? "Hide customization" : "Customize individual terms"}
        </button>

        {/* Customize Fields */}
        {showTermCustomize && (
          <div className="inst-customize-fields">
            {(["institution", "cohort", "learner", "instructor", "supervisor"] as const).map((key) => (
              <div key={key}>
                <label className="inst-label inst-label-capitalize">{key}</label>
                <input
                  type="text"
                  value={termOverrides[key] ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTermOverrides((prev) => {
                      if (!val.trim()) {
                        const next = { ...prev };
                        delete next[key];
                        return next;
                      }
                      return { ...prev, [key]: val };
                    });
                  }}
                  placeholder={TERMINOLOGY_PRESETS[termPreset][key]}
                  className="inst-input"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="inst-save-row">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="inst-save-btn"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {message && (
          <span className={`inst-save-message ${message === "Saved" ? "inst-save-success" : "inst-save-error"}`}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
