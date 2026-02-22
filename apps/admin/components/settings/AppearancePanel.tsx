"use client";

import { useState, useEffect } from "react";
import { Sun, Moon, Monitor, Check, Bug } from "lucide-react";
import { useTheme, usePalette, type ThemePreference } from "@/contexts";
import type { PanelProps } from "@/lib/settings-panels";
import "./appearance-panel.css";

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
      <div className="hf-card">
        <h2 className="hf-section-title">Theme</h2>
        <p className="ap-section-desc">Choose your preferred color mode</p>
        <div className="ap-theme-grid">
          {themeOptions.map((option) => {
            const isSelected = mounted && preference === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setPreference(option.value)}
                className={`ap-theme-option${isSelected ? " selected" : ""}`}
              >
                {isSelected && (
                  <div className="ap-check-badge">
                    <Check size={14} strokeWidth={2.5} />
                  </div>
                )}
                <div className="hf-icon-box-lg">
                  <ThemeIcon icon={option.icon} size={22} />
                </div>
                <div className="ap-option-text">
                  <div className="ap-option-label">{option.label}</div>
                  <div className="ap-option-desc">{option.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Color Palettes */}
      <div className="ap-palette-grid">
        {/* Light */}
        <div className="ap-palette-card">
          <div className="ap-palette-header">
            <div className="ap-palette-icon"><ThemeIcon icon="sun" size={18} /></div>
            <h2 className="ap-palette-title">Light Palette</h2>
          </div>
          <p className="ap-palette-desc">Background tones for light mode</p>
          <div className="ap-preset-list">
            {lightPresets.map((preset) => {
              const isSelected = mounted && lightPalette === preset.id;
              const isActive = mounted && resolvedTheme === "light" && isSelected;
              return (
                <button key={preset.id} onClick={() => setLightPalette(preset.id)} className={`ap-preset-btn${isSelected ? " selected" : ""}`} style={{ background: preset.light.surfacePrimary }}>
                  <div className="ap-swatches">
                    {[preset.light.background, preset.light.surfacePrimary, preset.light.surfaceSecondary, preset.light.surfaceTertiary].map((color, i) => (
                      <div key={i} className="ap-swatch ap-swatch-light" style={{ background: color }} />
                    ))}
                  </div>
                  <div className="ap-preset-text">
                    <div className="ap-preset-name">{preset.name}</div>
                    <div className="ap-preset-desc">{preset.description}</div>
                  </div>
                  {mounted && isActive && <div className="ap-active-dot" title="Currently active" />}
                  {mounted && isSelected && !isActive && <div className="ap-check-badge-sm"><Check size={14} strokeWidth={2.5} /></div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dark */}
        <div className="ap-palette-card">
          <div className="ap-palette-header">
            <div className="ap-palette-icon"><ThemeIcon icon="moon" size={18} /></div>
            <h2 className="ap-palette-title">Dark Palette</h2>
          </div>
          <p className="ap-palette-desc">Background tones for dark mode</p>
          <div className="ap-preset-list">
            {darkPresets.map((preset) => {
              const isSelected = mounted && darkPalette === preset.id;
              const isActive = mounted && resolvedTheme === "dark" && isSelected;
              const colors = preset.dark!;
              return (
                <button key={preset.id} onClick={() => setDarkPalette(preset.id)} className={`ap-preset-btn${isSelected ? " selected" : ""}`} style={{ background: colors.surfacePrimary }}>
                  <div className="ap-swatches">
                    {[colors.background, colors.surfacePrimary, colors.surfaceSecondary, colors.surfaceTertiary].map((color, i) => (
                      <div key={i} className="ap-swatch ap-swatch-dark" style={{ background: color }} />
                    ))}
                  </div>
                  <div className="ap-preset-text">
                    <div className="ap-preset-name">{preset.name}</div>
                    <div className="ap-preset-desc">{preset.description}</div>
                  </div>
                  {mounted && isActive && <div className="ap-active-dot" title="Currently active" />}
                  {mounted && isSelected && !isActive && <div className="ap-check-badge-sm"><Check size={14} strokeWidth={2.5} /></div>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Developer Tools */}
      <div className="ap-devtools-card">
        <h2 className="hf-section-title">Developer Tools</h2>
        <p className="ap-section-desc">In-app diagnostic tools</p>
        <button onClick={toggleBugReporter} className="ap-devtools-btn">
          <div className={`ap-bug-icon${bugReporterEnabled ? " enabled" : ""}`}>
            <Bug size={18} />
          </div>
          <div className="ap-devtools-text">
            <div className="ap-devtools-label">Bug Reporter</div>
            <div className="ap-devtools-desc">Floating diagnostic tool — captures errors, diagnoses issues with AI</div>
          </div>
          {/* Toggle switch */}
          <div className={`ap-toggle-track${mounted && bugReporterEnabled ? " on" : ""}`}>
            <div className="ap-toggle-knob" />
          </div>
        </button>
      </div>
    </>
  );
}
