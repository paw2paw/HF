"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTerminology } from "@/contexts/TerminologyContext";
import {
  type TerminologyPresetId,
  type TerminologyOverrides,
  TERMINOLOGY_PRESETS,
  PRESET_OPTIONS,
  resolveTerminology,
} from "@/lib/terminology/types";

const TERM_KEYS = ["institution", "cohort", "learner", "instructor", "supervisor"] as const;

export default function EducatorSettingsPage() {
  const { data: session } = useSession();
  const { terms, refresh } = useTerminology();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [termPreset, setTermPreset] = useState<TerminologyPresetId>("school");
  const [termOverrides, setTermOverrides] = useState<TerminologyOverrides>({});
  const [showTermCustomize, setShowTermCustomize] = useState(false);

  const canEdit = ["ADMIN", "SUPERADMIN"].includes(
    (session?.user as { role?: string })?.role ?? ""
  );

  const resolvedTerms = resolveTerminology({
    preset: termPreset,
    overrides: termOverrides,
  });

  useEffect(() => {
    fetch("/api/institution/terminology")
      .then((r) => r.json())
      .then((res) => {
        if (res?.ok) {
          if (res.preset) setTermPreset(res.preset);
          if (res.overrides) {
            setTermOverrides(res.overrides);
            if (Object.keys(res.overrides).length > 0) {
              setShowTermCustomize(true);
            }
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/institution/terminology", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preset: termPreset,
        ...(Object.keys(termOverrides).length > 0
          ? { overrides: termOverrides }
          : {}),
      }),
    });

    const data = await res.json();
    if (data.ok) {
      setMessage("Saved");
      refresh();
      setTimeout(() => setMessage(""), 2000);
    } else {
      setMessage(data.error || "Save failed");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{ padding: 32, color: "var(--text-muted)", fontSize: 14 }}>
        Loading...
      </div>
    );
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
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 4,
          }}
        >
          Settings
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Configure terminology for your {terms.institution.toLowerCase()}
        </p>
      </div>

      {/* Terminology Profile */}
      <div
        style={{
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 4,
          }}
        >
          Terminology Profile
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            marginBottom: 16,
          }}
        >
          Choose how your {terms.institution.toLowerCase()} labels key concepts.
          This affects sidebar navigation and dashboard labels for all users.
        </p>

        {/* Preset Picker */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 10,
            marginBottom: 16,
          }}
        >
          {PRESET_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                if (!canEdit) return;
                setTermPreset(opt.id);
                setTermOverrides({});
                setShowTermCustomize(false);
              }}
              disabled={!canEdit}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "12px 14px",
                background:
                  termPreset === opt.id
                    ? "var(--surface-active)"
                    : "var(--surface-secondary)",
                border:
                  termPreset === opt.id
                    ? "2px solid var(--accent-primary)"
                    : "1px solid var(--border-default)",
                borderRadius: 10,
                cursor: canEdit ? "pointer" : "default",
                textAlign: "left",
                transition: "all 0.15s",
                opacity: canEdit ? 1 : 0.7,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: 2,
                }}
              >
                {opt.label}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {opt.description}
              </div>
            </button>
          ))}
        </div>

        {/* Preview Table */}
        <div
          style={{
            background: "var(--surface-secondary)",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 8,
            }}
          >
            Preview
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr",
              gap: "4px 12px",
              fontSize: 13,
            }}
          >
            {TERM_KEYS.map((key) => (
              <div key={key} style={{ display: "contents" }}>
                <span
                  style={{
                    color: "var(--text-muted)",
                    textTransform: "capitalize",
                  }}
                >
                  {key}
                </span>
                <span
                  style={{
                    color: "var(--text-primary)",
                    fontWeight: 500,
                  }}
                >
                  {resolvedTerms[key]}
                  {termOverrides[key] && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--badge-purple-text)",
                        marginLeft: 6,
                      }}
                    >
                      custom
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Customize Toggle */}
        {canEdit && (
          <button
            onClick={() => setShowTermCustomize(!showTermCustomize)}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent-primary)",
              cursor: "pointer",
              fontSize: 13,
              padding: 0,
              fontWeight: 500,
            }}
          >
            {showTermCustomize
              ? "Hide customization"
              : "Customize individual terms"}
          </button>
        )}

        {/* Customize Fields */}
        {showTermCustomize && canEdit && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: 12,
            }}
          >
            {TERM_KEYS.map((key) => (
              <div key={key}>
                <label style={{ ...labelStyle, textTransform: "capitalize" }}>
                  {key}
                </label>
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
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Read-only notice for non-admins */}
      {!canEdit && (
        <div
          style={{
            padding: "12px 16px",
            background: "var(--surface-secondary)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--text-muted)",
            marginBottom: 16,
          }}
        >
          Only administrators can change terminology settings.
        </div>
      )}

      {/* Save Button */}
      {canEdit && (
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "12px 24px",
              background: saving
                ? "var(--border-default)"
                : "var(--button-primary-bg)",
              color: saving
                ? "var(--text-muted)"
                : "var(--button-primary-text)",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          {message && (
            <span
              style={{
                fontSize: 13,
                color:
                  message === "Saved"
                    ? "var(--status-success-text)"
                    : "var(--status-error-text)",
              }}
            >
              {message}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
