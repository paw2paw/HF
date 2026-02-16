"use client";

import { useState } from "react";
import { LayoutGrid, RotateCcw } from "lucide-react";
import {
  type PanelProps,
  type SettingsCategory,
  DEFAULT_CATEGORY_MAP,
  CATEGORY_META,
  SIMPLE_PANEL_IDS,
} from "@/lib/settings-panels";
import { SETTINGS_REGISTRY } from "@/lib/system-settings";

const SETTINGS_KEY = "settings.panel_categories";

const CATEGORIES = Object.entries(CATEGORY_META)
  .sort(([, a], [, b]) => a.order - b.order) as [SettingsCategory, { label: string; order: number }][];

export function PanelLayoutPanel({ values, updateSetting }: PanelProps) {
  // Current overrides from DB (parsed from the stored JSON, or empty)
  const raw = values[SETTINGS_KEY];
  const overrides: Record<string, SettingsCategory> = raw
    ? (typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : {})
    : {};

  // Merged map: defaults + overrides
  const merged = { ...DEFAULT_CATEGORY_MAP, ...overrides };

  // Also include custom panels (they have fixed categories, shown read-only)
  const customPanels: { id: string; label: string; category: SettingsCategory; fixed: boolean }[] = [
    { id: "appearance", label: "Appearance", category: "general", fixed: true },
    { id: "channels", label: "Delivery Channels", category: "communications", fixed: true },
    { id: "security", label: "Access Matrix", category: "security", fixed: true },
    { id: "fallbacks", label: "Fallback Defaults", category: "developer", fixed: true },
  ];

  // Build full panel list
  const allEntries = [
    ...SETTINGS_REGISTRY.map((g) => ({
      id: g.id,
      label: g.label,
      category: merged[g.id] ?? "system" as SettingsCategory,
      fixed: false,
      isDefault: !overrides[g.id],
    })),
    ...customPanels.map((p) => ({ ...p, isDefault: true })),
  ];

  // Group by category for display
  const grouped = new Map<SettingsCategory, typeof allEntries>();
  for (const entry of allEntries) {
    const list = grouped.get(entry.category) ?? [];
    list.push(entry);
    grouped.set(entry.category, list);
  }

  const [saving, setSaving] = useState(false);

  function handleCategoryChange(panelId: string, newCategory: SettingsCategory) {
    const newOverrides = { ...overrides };

    // If setting back to default, remove the override
    if (DEFAULT_CATEGORY_MAP[panelId] === newCategory) {
      delete newOverrides[panelId];
    } else {
      newOverrides[panelId] = newCategory;
    }

    // Save as JSON string
    const value = Object.keys(newOverrides).length > 0
      ? JSON.stringify(newOverrides)
      : "";

    setSaving(true);
    updateSetting(SETTINGS_KEY, value);
    setTimeout(() => setSaving(false), 600);
  }

  function handleResetAll() {
    setSaving(true);
    updateSetting(SETTINGS_KEY, "");
    setTimeout(() => setSaving(false), 600);
  }

  const hasOverrides = Object.keys(overrides).length > 0;

  return (
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
          <LayoutGrid size={18} strokeWidth={1.5} />
        </div>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
          Panel Layout
        </h2>
        {saving && (
          <span style={{ fontSize: 11, color: "var(--accent-primary)", fontStyle: "italic" }}>
            Saving...
          </span>
        )}
      </div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        Controls which sidebar category each settings panel appears in.
        Changes take effect on next page load.
      </p>

      {/* Reset button */}
      {hasOverrides && (
        <button
          onClick={handleResetAll}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            marginBottom: 16,
            borderRadius: 8,
            border: "1px solid var(--border-default)",
            background: "var(--surface-secondary)",
            color: "var(--text-primary)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <RotateCcw size={13} />
          Reset all to defaults
        </button>
      )}

      {/* Category groups */}
      {CATEGORIES.map(([catKey, catMeta]) => {
        const entries = grouped.get(catKey);
        if (!entries || entries.length === 0) return null;

        return (
          <div key={catKey} style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 8,
              paddingBottom: 4,
              borderBottom: "1px solid var(--border-default)",
            }}>
              {catMeta.label}
            </div>

            {entries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                    {entry.label}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                    {entry.id}
                    {SIMPLE_PANEL_IDS.has(entry.id) && (
                      <span style={{
                        marginLeft: 8,
                        padding: "1px 5px",
                        borderRadius: 4,
                        fontSize: 10,
                        background: "var(--status-info-bg)",
                        color: "var(--status-info-text)",
                      }}>
                        simple mode
                      </span>
                    )}
                    {!entry.isDefault && (
                      <span style={{
                        marginLeft: 8,
                        padding: "1px 5px",
                        borderRadius: 4,
                        fontSize: 10,
                        background: "var(--status-warning-bg)",
                        color: "var(--status-warning-text)",
                      }}>
                        overridden
                      </span>
                    )}
                  </div>
                </div>

                {entry.fixed ? (
                  <span style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    fontStyle: "italic",
                    padding: "4px 10px",
                  }}>
                    Fixed
                  </span>
                ) : (
                  <select
                    value={entry.category}
                    onChange={(e) => handleCategoryChange(entry.id, e.target.value as SettingsCategory)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      border: "1px solid var(--border-default)",
                      background: "var(--surface-secondary)",
                      color: "var(--text-primary)",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {CATEGORIES.map(([key, meta]) => (
                      <option key={key} value={key}>
                        {meta.label}
                        {key === DEFAULT_CATEGORY_MAP[entry.id] ? " (default)" : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {/* Legend */}
      <div style={{
        marginTop: 8,
        padding: 12,
        background: "var(--surface-secondary)",
        borderRadius: 8,
        fontSize: 12,
        color: "var(--text-muted)",
      }}>
        Auto panels from <code style={{ fontSize: 11, padding: "1px 4px", borderRadius: 4, background: "var(--surface-tertiary)" }}>SETTINGS_REGISTRY</code> can
        be reassigned to any category.
        Custom panels (Appearance, Channels, Security, Fallbacks) have fixed categories.
        New registry entries auto-appear under <strong>System</strong> by default.
      </div>
    </div>
  );
}
