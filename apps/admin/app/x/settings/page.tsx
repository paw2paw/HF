"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Sun, Moon, Monitor, Check, Info,
  Activity, Brain, Target, ShieldCheck, Sparkles, Gauge,
} from "lucide-react";
import { useTheme, usePalette, type ThemePreference } from "@/contexts";
import { type SettingGroup, type SettingDef, SETTINGS_REGISTRY } from "@/lib/system-settings";

// ── Icon map for setting groups ─────────────────────

const GROUP_ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  Activity, Brain, Target, ShieldCheck, Sparkles, Gauge,
};

// ── Theme helpers ───────────────────────────────────

const themeIcons: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  sun: Sun, moon: Moon, monitor: Monitor,
};

const themeOptions: { value: ThemePreference; label: string; icon: string; description: string }[] = [
  { value: "light", label: "Light", icon: "sun", description: "Bright and clear" },
  { value: "dark", label: "Dark", icon: "moon", description: "Easy on the eyes" },
  { value: "system", label: "System", icon: "monitor", description: "Match your device" },
];

function ThemeIcon({ icon, size = 20 }: { icon: string; size?: number }) {
  const Icon = themeIcons[icon];
  if (!Icon) return null;
  return <Icon size={size} strokeWidth={1.5} />;
}

// ── Shared components ───────────────────────────────

function SettingInput({
  setting,
  value,
  onChange,
}: {
  setting: SettingDef;
  value: number | boolean;
  onChange: (value: number | boolean) => void;
}) {
  if (setting.type === "bool") {
    return (
      <div style={{ padding: "12px 0", borderBottom: "1px solid var(--border-default)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{setting.label}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {setting.description}
              <span style={{ fontStyle: "italic", marginLeft: 6, opacity: 0.7 }}>
                (default: {String(setting.default)})
              </span>
            </div>
          </div>
          <button
            onClick={() => onChange(!value)}
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              border: "none",
              background: value ? "var(--accent-primary)" : "var(--surface-tertiary)",
              cursor: "pointer",
              position: "relative",
              transition: "background 0.15s ease",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "white",
                position: "absolute",
                top: 3,
                left: value ? 23 : 3,
                transition: "left 0.15s ease",
              }}
            />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid var(--border-default)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
          {setting.label}
        </label>
        <input
          type="number"
          value={value as number}
          onChange={(e) => onChange(Number(e.target.value))}
          min={setting.min}
          max={setting.max}
          step={setting.step ?? 1}
          style={{
            width: 90,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid var(--border-default)",
            background: "var(--surface-secondary)",
            color: "var(--text-primary)",
            fontSize: 13,
            textAlign: "right",
          }}
        />
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
        {setting.description}
        <span style={{ fontStyle: "italic", marginLeft: 6, opacity: 0.7 }}>
          (default: {setting.default})
        </span>
      </p>
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────

const TABS = [
  { id: "appearance", label: "Appearance" },
  ...SETTINGS_REGISTRY.map((g) => ({ id: g.id, label: g.label })),
];

// ── Main component ──────────────────────────────────

export default function SettingsPage() {
  const { preference, setPreference, resolvedTheme } = useTheme();
  const { lightPalette, darkPalette, setLightPalette, setDarkPalette, lightPresets, darkPresets } = usePalette();

  // Tab state from URL hash
  const [activeTab, setActiveTab] = useState("appearance");
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && TABS.some((t) => t.id === hash)) setActiveTab(hash);
  }, []);

  const switchTab = (id: string) => {
    setActiveTab(id);
    window.history.replaceState(null, "", `#${id}`);
  };

  // Server-side settings state
  const [values, setValues] = useState<Record<string, number | boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    fetch("/api/system-settings")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) return;
        const map: Record<string, number | boolean> = {};
        for (const s of data.settings) {
          map[s.key] = s.value;
        }
        setValues(map);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const saveSetting = useCallback((key: string, value: number | boolean) => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch("/api/system-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      }).catch(console.error);
    }, 500);
  }, []);

  const updateSetting = useCallback(
    (key: string, value: number | boolean) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      saveSetting(key, value);
    },
    [saveSetting]
  );

  const getVal = (s: SettingDef) => values[s.key] ?? s.default;

  // ── Render ──────────────────────────────────────────

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
          Settings
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Appearance and system configuration
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 24,
          borderBottom: "1px solid var(--border-default)",
          overflowX: "auto",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            style={{
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? "var(--accent-primary)" : "var(--text-muted)",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid var(--accent-primary)" : "2px solid transparent",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Appearance Tab */}
      {activeTab === "appearance" && (
        <>
          {/* Theme Mode */}
          <div
            style={{
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
              Theme
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              Choose your preferred color mode
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {themeOptions.map((option) => {
                const isSelected = preference === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setPreference(option.value)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 10,
                      padding: "20px 16px",
                      borderRadius: 12,
                      border: isSelected ? "2px solid var(--accent-primary)" : "1px solid var(--border-default)",
                      background: isSelected ? "var(--surface-secondary)" : "var(--surface-primary)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      position: "relative",
                    }}
                  >
                    {isSelected && (
                      <div style={{ position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: "50%", background: "var(--accent-primary)", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Check size={14} strokeWidth={2.5} />
                      </div>
                    )}
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--surface-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", color: isSelected ? "var(--accent-primary)" : "var(--text-muted)" }}>
                      <ThemeIcon icon={option.icon} size={22} />
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{option.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{option.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Palettes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Light */}
            <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 16, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ color: "var(--text-muted)" }}><ThemeIcon icon="sun" size={18} /></div>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Light Palette</h2>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Background tones for light mode</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lightPresets.map((preset) => {
                  const isSelected = lightPalette === preset.id;
                  const isActive = resolvedTheme === "light" && isSelected;
                  return (
                    <button key={preset.id} onClick={() => setLightPalette(preset.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, border: isSelected ? "2px solid var(--accent-primary)" : "1px solid var(--border-default)", background: preset.light.surfacePrimary, cursor: "pointer", transition: "all 0.15s ease" }}>
                      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                        {[preset.light.background, preset.light.surfacePrimary, preset.light.surfaceSecondary, preset.light.surfaceTertiary].map((color, i) => (
                          <div key={i} style={{ width: 16, height: 16, borderRadius: 4, background: color, border: "1px solid rgba(0,0,0,0.1)" }} />
                        ))}
                      </div>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{preset.name}</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>{preset.description}</div>
                      </div>
                      {isActive && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 2px rgba(34, 197, 94, 0.2)" }} title="Currently active" />}
                      {isSelected && !isActive && <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--accent-primary)", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={14} strokeWidth={2.5} /></div>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dark */}
            <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 16, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ color: "var(--text-muted)" }}><ThemeIcon icon="moon" size={18} /></div>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Dark Palette</h2>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Background tones for dark mode</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {darkPresets.map((preset) => {
                  const isSelected = darkPalette === preset.id;
                  const isActive = resolvedTheme === "dark" && isSelected;
                  const colors = preset.dark!;
                  return (
                    <button key={preset.id} onClick={() => setDarkPalette(preset.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, border: isSelected ? "2px solid var(--accent-primary)" : "1px solid #3f3f46", background: colors.surfacePrimary, cursor: "pointer", transition: "all 0.15s ease" }}>
                      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                        {[colors.background, colors.surfacePrimary, colors.surfaceSecondary, colors.surfaceTertiary].map((color, i) => (
                          <div key={i} style={{ width: 16, height: 16, borderRadius: 4, background: color, border: "1px solid rgba(255,255,255,0.1)" }} />
                        ))}
                      </div>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#e5e7eb" }}>{preset.name}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{preset.description}</div>
                      </div>
                      {isActive && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 2px rgba(34, 197, 94, 0.2)" }} title="Currently active" />}
                      {isSelected && !isActive && <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--accent-primary)", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={14} strokeWidth={2.5} /></div>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Dynamic settings tabs */}
      {SETTINGS_REGISTRY.map((group) =>
        activeTab === group.id ? (
          <div
            key={group.id}
            style={{
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 16,
              padding: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{ color: "var(--text-muted)" }}>
                {GROUP_ICONS[group.icon] ? (() => { const I = GROUP_ICONS[group.icon]; return <I size={18} strokeWidth={1.5} />; })() : null}
              </div>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                {group.label}
              </h2>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              {group.description}
            </p>

            {!loaded ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading...</p>
            ) : (
              <div>
                {group.settings.map((s) => (
                  <SettingInput
                    key={s.key}
                    setting={s}
                    value={getVal(s)}
                    onChange={(v) => updateSetting(s.key, v)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: "var(--surface-secondary)",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
          <Info size={18} strokeWidth={1.5} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 2 }}>
            Settings saved automatically
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {activeTab === "appearance"
              ? "Theme preferences are stored locally in your browser"
              : "Pipeline and system settings are saved to the server (30s cache)"}
          </div>
        </div>
      </div>
    </div>
  );
}
