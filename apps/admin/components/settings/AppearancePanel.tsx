"use client";

import { useState, useEffect } from "react";
import { Sun, Moon, Monitor, Check, Bug } from "lucide-react";
import { useTheme, usePalette, type ThemePreference } from "@/contexts";
import type { PanelProps } from "@/lib/settings-panels";

const BUG_REPORTER_KEY = "ui.bugReporter";

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

// ── Component ───────────────────────────────────────

export function AppearancePanel(_props: PanelProps) {
  const { preference, setPreference, resolvedTheme } = useTheme();
  const { lightPalette, darkPalette, setLightPalette, setDarkPalette, lightPresets, darkPresets } = usePalette();

  // Prevent hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Bug reporter toggle (localStorage)
  const [bugReporterEnabled, setBugReporterEnabled] = useState(true);
  useEffect(() => {
    const stored = localStorage.getItem(BUG_REPORTER_KEY);
    if (stored !== null) setBugReporterEnabled(stored !== "false");
  }, []);
  const toggleBugReporter = () => {
    const next = !bugReporterEnabled;
    setBugReporterEnabled(next);
    localStorage.setItem(BUG_REPORTER_KEY, String(next));
    // Dispatch storage event so BugReportButton picks it up immediately
    window.dispatchEvent(new StorageEvent("storage", { key: BUG_REPORTER_KEY, newValue: String(next) }));
  };

  return (
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
            const isSelected = mounted && preference === option.value;
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
              const isSelected = mounted && lightPalette === preset.id;
              const isActive = mounted && resolvedTheme === "light" && isSelected;
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
                  {mounted && isActive && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--status-success-text)", boxShadow: "0 0 0 2px color-mix(in srgb, var(--status-success-text) 20%, transparent)" }} title="Currently active" />}
                  {mounted && isSelected && !isActive && <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--accent-primary)", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={14} strokeWidth={2.5} /></div>}
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
              const isSelected = mounted && darkPalette === preset.id;
              const isActive = mounted && resolvedTheme === "dark" && isSelected;
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
                  {mounted && isActive && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--status-success-text)", boxShadow: "0 0 0 2px color-mix(in srgb, var(--status-success-text) 20%, transparent)" }} title="Currently active" />}
                  {mounted && isSelected && !isActive && <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--accent-primary)", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={14} strokeWidth={2.5} /></div>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Developer Tools */}
      <div
        style={{
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          borderRadius: 16,
          padding: 24,
          marginTop: 24,
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
          Developer Tools
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
          In-app diagnostic tools
        </p>
        <button
          onClick={toggleBugReporter}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            borderRadius: 10,
            border: "1px solid var(--border-default)",
            background: "var(--surface-primary)",
            cursor: "pointer",
            width: "100%",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", color: bugReporterEnabled ? "var(--status-error-text)" : "var(--text-muted)" }}>
            <Bug size={18} />
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>Bug Reporter</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Floating diagnostic tool — captures errors, diagnoses issues with AI</div>
          </div>
          {/* Toggle switch */}
          <div
            style={{
              width: 40,
              height: 22,
              borderRadius: 11,
              background: mounted && bugReporterEnabled ? "var(--accent-primary)" : "var(--surface-tertiary)",
              position: "relative",
              transition: "background 0.2s ease",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "var(--surface-primary)",
                position: "absolute",
                top: 2,
                left: mounted && bugReporterEnabled ? 20 : 2,
                transition: "left 0.2s ease",
                boxShadow: "0 1px 3px color-mix(in srgb, var(--text-primary) 20%, transparent)",
              }}
            />
          </div>
        </button>
      </div>
    </>
  );
}
