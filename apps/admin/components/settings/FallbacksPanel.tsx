"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { FALLBACK_SETTINGS_REGISTRY } from "@/lib/fallback-settings";
import { JsonEditorModal } from "./JsonEditorModal";
import type { PanelProps } from "@/lib/settings-panels";

export function FallbacksPanel({ fallbackValues, loaded, updateFallback }: PanelProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKey, setModalKey] = useState("");
  const [modalLabel, setModalLabel] = useState("");
  const [modalText, setModalText] = useState("");

  const handleSave = async (key: string, parsed: unknown) => {
    const res = await fetch("/api/system-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: parsed }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Failed to save");
    updateFallback(key, parsed);
  };

  return (
    <>
      <div
        style={{
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          borderRadius: 16,
          padding: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ color: "var(--text-muted)" }}>
            <Shield size={18} strokeWidth={1.5} />
          </div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
            {FALLBACK_SETTINGS_REGISTRY.label}
          </h2>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          {FALLBACK_SETTINGS_REGISTRY.description}
        </p>

        {!loaded ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading...</p>
        ) : (
          <div>
            {FALLBACK_SETTINGS_REGISTRY.settings.map((s) => {
              const currentValue = fallbackValues[s.key];
              const hasValue = currentValue !== undefined;
              return (
                <div
                  key={s.key}
                  style={{
                    padding: "14px 0",
                    borderBottom: "1px solid var(--border-default)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                        {s.label}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                        {s.description}
                      </div>
                      <div style={{ fontSize: 11, color: hasValue ? "var(--accent-primary)" : "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>
                        {hasValue ? "Stored in database" : "Using hardcoded default (not yet seeded)"}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setModalKey(s.key);
                        setModalLabel(s.label);
                        setModalText(
                          hasValue
                            ? JSON.stringify(currentValue, null, 2)
                            : "Not seeded yet. Run npm run db:seed to populate."
                        );
                        setModalOpen(true);
                      }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--border-default)",
                        background: "var(--surface-secondary)",
                        color: "var(--text-primary)",
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: "pointer",
                        flexShrink: 0,
                        marginLeft: 16,
                      }}
                    >
                      {hasValue ? "Edit" : "View"}
                    </button>
                  </div>
                  {hasValue && (
                    <pre
                      style={{
                        marginTop: 10,
                        padding: 14,
                        borderRadius: 10,
                        background: "var(--surface-secondary)",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-secondary)",
                        fontSize: 12,
                        fontFamily: "monospace",
                        lineHeight: 1.5,
                        overflowX: "auto",
                        maxHeight: 260,
                        overflowY: "auto",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {JSON.stringify(currentValue, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <JsonEditorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        label={modalLabel}
        settingKey={modalKey}
        initialText={modalText}
        onSave={handleSave}
      />
    </>
  );
}
