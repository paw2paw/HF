"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Sun, Moon, Monitor, Check, Info, Shield, X, Save,
  Activity, Brain, Target, ShieldCheck, Sparkles, Gauge, Lock, Camera, Mail, Eye, EyeOff,
} from "lucide-react";
import { useTheme, usePalette, useViewMode, type ThemePreference } from "@/contexts";
import { type SettingGroup, type SettingDef, SETTINGS_REGISTRY, EMAIL_TEMPLATE_DEFAULTS } from "@/lib/system-settings";
import { FALLBACK_SETTINGS_REGISTRY } from "@/lib/fallback-settings";
import { renderEmailHtml } from "@/lib/email-render";
import { ChannelsPanel } from "@/components/settings/ChannelsPanel";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";

// ── Icon map for setting groups ─────────────────────

const GROUP_ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  Activity, Brain, Target, ShieldCheck, Sparkles, Gauge, Shield, Camera, Mail,
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
  value: number | boolean | string;
  onChange: (value: number | boolean | string) => void;
}) {
  if (setting.type === "text") {
    return (
      <div style={{ padding: "12px 0", borderBottom: "1px solid var(--border-default)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
            {setting.label}
          </label>
          <input
            type="text"
            value={String(value ?? setting.default)}
            onChange={(e) => onChange(e.target.value)}
            placeholder={setting.placeholder}
            style={{
              width: 200,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid var(--border-default)",
              background: "var(--surface-secondary)",
              color: "var(--text-primary)",
              fontSize: 13,
            }}
          />
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
          {setting.description}
          {setting.default ? (
            <span style={{ fontStyle: "italic", marginLeft: 6, opacity: 0.7 }}>
              (default: {String(setting.default)})
            </span>
          ) : null}
        </p>
      </div>
    );
  }

  if (setting.type === "textarea") {
    return (
      <div style={{ padding: "12px 0", borderBottom: "1px solid var(--border-default)" }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4, display: "block" }}>
          {setting.label}
        </label>
        <textarea
          value={String(value ?? setting.default)}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--border-default)",
            background: "var(--surface-secondary)",
            color: "var(--text-primary)",
            fontSize: 13,
            fontFamily: "inherit",
            resize: "vertical",
            lineHeight: 1.5,
          }}
        />
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
          {setting.description}
        </p>
      </div>
    );
  }

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
  { id: "channels", label: "Channels" },
  { id: "security", label: "Security" },
  { id: "fallbacks", label: "Fallback Defaults" },
];

// ── Main component ──────────────────────────────────

const SIMPLE_TAB_IDS = new Set(["appearance", "email"]);

export default function SettingsPage() {
  const { preference, setPreference, resolvedTheme } = useTheme();
  const { lightPalette, darkPalette, setLightPalette, setDarkPalette, lightPresets, darkPresets } = usePalette();
  const { isAdvanced } = useViewMode();

  // Prevent hydration mismatch — theme/palette state differs server vs client
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Filter tabs based on view mode
  const visibleTabs = isAdvanced ? TABS : TABS.filter((t) => SIMPLE_TAB_IDS.has(t.id));

  // Tab state from URL hash
  const [activeTab, setActiveTab] = useState("appearance");
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && TABS.some((t) => t.id === hash)) setActiveTab(hash);
  }, []);

  // Reset to appearance if current tab is hidden by view mode change
  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab("appearance");
      window.history.replaceState(null, "", "#appearance");
    }
  }, [isAdvanced]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchTab = (id: string) => {
    setActiveTab(id);
    window.history.replaceState(null, "", `#${id}`);
  };

  // Server-side settings state
  const [values, setValues] = useState<Record<string, number | boolean | string>>({});
  const [loaded, setLoaded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Email preview toggles
  const [showMagicLinkPreview, setShowMagicLinkPreview] = useState(false);
  const [showInvitePreview, setShowInvitePreview] = useState(false);

  // Access matrix state
  const [accessMatrix, setAccessMatrix] = useState<{
    roles: string[];
    matrix: Record<string, Record<string, string>>;
  } | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixError, setMatrixError] = useState("");

  // Fallback JSON editor state
  const [fallbackValues, setFallbackValues] = useState<Record<string, unknown>>({});
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [jsonModalKey, setJsonModalKey] = useState("");
  const [jsonModalLabel, setJsonModalLabel] = useState("");
  const [jsonModalText, setJsonModalText] = useState("");
  const [jsonModalError, setJsonModalError] = useState("");

  useEffect(() => {
    fetch("/api/system-settings")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) return;
        const map: Record<string, number | boolean | string> = {};
        const fbMap: Record<string, unknown> = {};
        for (const s of data.settings) {
          if (typeof s.key === "string" && s.key.startsWith("fallback:")) {
            fbMap[s.key] = s.value;
          } else {
            map[s.key] = s.value;
          }
        }
        setValues(map);
        setFallbackValues(fbMap);
      })
      .catch((e) => console.warn("[Settings] Failed to load settings:", e))
      .finally(() => setLoaded(true));
  }, []);

  // Lazy-load access matrix when Security tab is opened
  useEffect(() => {
    if (activeTab !== "security" || accessMatrix || matrixLoading) return;
    setMatrixLoading(true);
    fetch("/api/admin/access-matrix")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.contract) {
          setAccessMatrix({
            roles: data.contract.roles,
            matrix: data.contract.matrix,
          });
        } else {
          setMatrixError(data.error || "Failed to load access matrix");
        }
      })
      .catch((err) => setMatrixError(err.message))
      .finally(() => setMatrixLoading(false));
  }, [activeTab, accessMatrix, matrixLoading]);

  const saveSetting = useCallback((key: string, value: number | boolean | string) => {
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
    (key: string, value: number | boolean | string) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      saveSetting(key, value);
    },
    [saveSetting]
  );

  const getVal = (s: SettingDef) => values[s.key] ?? s.default;

  // ── Render ──────────────────────────────────────────

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <AdvancedBanner />
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
          flexWrap: "wrap",
          gap: 4,
          marginBottom: 24,
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            style={{
              padding: "8px 12px",
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
                      {mounted && isActive && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 2px rgba(34, 197, 94, 0.2)" }} title="Currently active" />}
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
                      {mounted && isActive && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 2px rgba(34, 197, 94, 0.2)" }} title="Currently active" />}
                      {mounted && isSelected && !isActive && <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--accent-primary)", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={14} strokeWidth={2.5} /></div>}
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

      {/* Email Preview — shown when email tab is active */}
      {activeTab === "email" && loaded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
          {/* Magic Link Preview */}
          <div style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 16,
            padding: 24,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                Magic Link Email Preview
              </h3>
              <button
                onClick={() => setShowMagicLinkPreview((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 8,
                  border: "1px solid var(--border-default)",
                  background: showMagicLinkPreview ? "var(--accent-primary)" : "var(--surface-secondary)",
                  color: showMagicLinkPreview ? "white" : "var(--text-primary)",
                  fontSize: 12, fontWeight: 500, cursor: "pointer",
                }}
              >
                {showMagicLinkPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                {showMagicLinkPreview ? "Hide" : "Preview"}
              </button>
            </div>
            {showMagicLinkPreview && (
              <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border-default)" }}>
                <div style={{ padding: "8px 12px", background: "var(--surface-secondary)", fontSize: 11, color: "var(--text-muted)" }}>
                  Subject: <strong style={{ color: "var(--text-primary)" }}>
                    {String(values["email.magic_link.subject"] ?? EMAIL_TEMPLATE_DEFAULTS.magicLinkSubject)}
                  </strong>
                </div>
                <iframe
                  title="Magic link email preview"
                  sandbox=""
                  style={{ width: "100%", height: 500, border: "none", background: "#f5f5f5" }}
                  srcDoc={renderEmailHtml({
                    heading: String(values["email.magic_link.heading"] ?? EMAIL_TEMPLATE_DEFAULTS.magicLinkHeading),
                    bodyHtml: `<p style="font-size:16px;margin:0 0 16px;">${String(values["email.magic_link.body"] ?? EMAIL_TEMPLATE_DEFAULTS.magicLinkBody)}</p>`,
                    buttonText: String(values["email.magic_link.button_text"] ?? EMAIL_TEMPLATE_DEFAULTS.magicLinkButtonText),
                    buttonUrl: "https://example.com/auth/verify?token=abc123",
                    footer: String(values["email.magic_link.footer"] ?? EMAIL_TEMPLATE_DEFAULTS.magicLinkFooter),
                    brandColorStart: String(values["email.shared.brand_color_start"] ?? EMAIL_TEMPLATE_DEFAULTS.sharedBrandColorStart),
                    brandColorEnd: String(values["email.shared.brand_color_end"] ?? EMAIL_TEMPLATE_DEFAULTS.sharedBrandColorEnd),
                  })}
                />
              </div>
            )}
          </div>

          {/* Invite Preview */}
          <div style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 16,
            padding: 24,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                Invite Email Preview
              </h3>
              <button
                onClick={() => setShowInvitePreview((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 8,
                  border: "1px solid var(--border-default)",
                  background: showInvitePreview ? "var(--accent-primary)" : "var(--surface-secondary)",
                  color: showInvitePreview ? "white" : "var(--text-primary)",
                  fontSize: 12, fontWeight: 500, cursor: "pointer",
                }}
              >
                {showInvitePreview ? <EyeOff size={14} /> : <Eye size={14} />}
                {showInvitePreview ? "Hide" : "Preview"}
              </button>
            </div>
            {showInvitePreview && (() => {
              const exampleVars: Record<string, string> = {
                greeting: "Hi Alex,",
                context: "You've been invited to test the <strong>Quality Management</strong> experience.",
                firstName: "Alex",
                domainName: "Quality Management",
              };
              const replaceVars = (t: string) => t.replace(/\{\{(\w+)\}\}/g, (_, k: string) => exampleVars[k] ?? `{{${k}}}`);
              const rawBody = String(values["email.invite.body"] ?? EMAIL_TEMPLATE_DEFAULTS.inviteBody);
              const bodyHtml = replaceVars(rawBody)
                .split("\n")
                .map((line: string) => `<p style="font-size:16px;margin:0 0 16px;">${line}</p>`)
                .join("\n");
              const subject = replaceVars(String(values["email.invite.subject"] ?? EMAIL_TEMPLATE_DEFAULTS.inviteSubject));

              return (
                <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border-default)" }}>
                  <div style={{ padding: "8px 12px", background: "var(--surface-secondary)", fontSize: 11, color: "var(--text-muted)" }}>
                    Subject: <strong style={{ color: "var(--text-primary)" }}>{subject}</strong>
                    <span style={{ marginLeft: 12, fontStyle: "italic" }}>(example: Alex invited to Quality Management)</span>
                  </div>
                  <iframe
                    title="Invite email preview"
                    sandbox=""
                    style={{ width: "100%", height: 500, border: "none", background: "#f5f5f5" }}
                    srcDoc={renderEmailHtml({
                      heading: replaceVars(String(values["email.invite.heading"] ?? EMAIL_TEMPLATE_DEFAULTS.inviteHeading)),
                      bodyHtml,
                      buttonText: replaceVars(String(values["email.invite.button_text"] ?? EMAIL_TEMPLATE_DEFAULTS.inviteButtonText)),
                      buttonUrl: "https://example.com/invite/accept?token=xyz789",
                      footer: replaceVars(String(values["email.invite.footer"] ?? EMAIL_TEMPLATE_DEFAULTS.inviteFooter)),
                      brandColorStart: String(values["email.shared.brand_color_start"] ?? EMAIL_TEMPLATE_DEFAULTS.sharedBrandColorStart),
                      brandColorEnd: String(values["email.shared.brand_color_end"] ?? EMAIL_TEMPLATE_DEFAULTS.sharedBrandColorEnd),
                    })}
                  />
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Channels Tab — Delivery Channel Config */}
      {activeTab === "channels" && (
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              Delivery Channels
            </h2>
          </div>
          <ChannelsPanel />
        </div>
      )}

      {/* Security Tab — Access Matrix Viewer */}
      {activeTab === "security" && (
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
              <Lock size={18} strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              Entity Access Matrix
            </h2>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
            Per-role CRUD permissions and data scopes for all system entities.
            Loaded from the <code style={{ fontSize: 12, padding: "1px 4px", borderRadius: 4, background: "var(--surface-tertiary)" }}>ENTITY_ACCESS_V1</code> contract.
          </p>

          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            {[
              { label: "C", desc: "Create", color: "#22c55e" },
              { label: "R", desc: "Read", color: "#3b82f6" },
              { label: "U", desc: "Update", color: "#f59e0b" },
              { label: "D", desc: "Delete", color: "#ef4444" },
            ].map((op) => (
              <div key={op.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 18, height: 18, borderRadius: 4, fontSize: 10, fontWeight: 700,
                  background: op.color, color: "#fff",
                }}>{op.label}</span>
                <span style={{ color: "var(--text-muted)" }}>{op.desc}</span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 18, height: 18, borderRadius: 4, fontSize: 10, fontWeight: 600,
                background: "var(--surface-tertiary)", color: "var(--text-muted)",
              }}>—</span>
              <span style={{ color: "var(--text-muted)" }}>No access</span>
            </div>
          </div>

          {/* Scope legend */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            {[
              { scope: "ALL", desc: "All records", bg: "var(--status-info-bg)", text: "var(--status-info-text)" },
              { scope: "DOMAIN", desc: "Same domain only", bg: "var(--status-success-bg)", text: "var(--status-success-text)" },
              { scope: "OWN", desc: "Own records only", bg: "var(--status-warning-bg)", text: "var(--status-warning-text)" },
            ].map((s) => (
              <span key={s.scope} style={{
                padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                background: s.bg, color: s.text,
              }}>{s.scope}: {s.desc}</span>
            ))}
          </div>

          {matrixLoading && (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading access matrix...</p>
          )}

          {matrixError && (
            <p style={{ fontSize: 13, color: "#ef4444" }}>{matrixError}</p>
          )}

          {accessMatrix && (
            <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border-default)" }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 700 }}>
                <thead>
                  <tr style={{ background: "var(--surface-secondary)" }}>
                    <th style={{
                      padding: "10px 14px", textAlign: "left", fontWeight: 600,
                      color: "var(--text-primary)", position: "sticky", left: 0,
                      background: "var(--surface-secondary)", borderRight: "1px solid var(--border-default)",
                    }}>Entity</th>
                    {accessMatrix.roles.map((role) => (
                      <th key={role} style={{
                        padding: "10px 8px", textAlign: "center", fontWeight: 600,
                        color: "var(--text-primary)", fontSize: 10, letterSpacing: "0.05em",
                      }}>{role}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(accessMatrix.matrix).map(([entity, roleMap], idx) => (
                    <tr key={entity} style={{
                      background: idx % 2 === 0 ? "var(--surface-primary)" : "var(--surface-secondary)",
                    }}>
                      <td style={{
                        padding: "8px 14px", fontWeight: 500, color: "var(--text-primary)",
                        position: "sticky", left: 0, borderRight: "1px solid var(--border-default)",
                        background: idx % 2 === 0 ? "var(--surface-primary)" : "var(--surface-secondary)",
                      }}>{entity}</td>
                      {accessMatrix.roles.map((role) => {
                        const rule = roleMap[role] || "NONE";
                        const [scope, ops] = rule.split(":");
                        const isNone = scope === "NONE";

                        const scopeColors: Record<string, { bg: string; text: string }> = {
                          ALL: { bg: "var(--status-info-bg)", text: "var(--status-info-text)" },
                          DOMAIN: { bg: "var(--status-success-bg)", text: "var(--status-success-text)" },
                          OWN: { bg: "var(--status-warning-bg)", text: "var(--status-warning-text)" },
                          NONE: { bg: "transparent", text: "var(--text-muted)" },
                        };
                        const sc = scopeColors[scope] || scopeColors.NONE;

                        const opColors: Record<string, string> = {
                          C: "#22c55e", R: "#3b82f6", U: "#f59e0b", D: "#ef4444",
                        };

                        return (
                          <td key={role} style={{ padding: "6px 8px", textAlign: "center" }}>
                            {isNone ? (
                              <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                                <span style={{
                                  padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600,
                                  background: sc.bg, color: sc.text,
                                }}>{scope}</span>
                                <div style={{ display: "flex", gap: 2 }}>
                                  {(ops || "").split("").map((op) => (
                                    <span key={op} style={{
                                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                                      width: 16, height: 16, borderRadius: 3, fontSize: 9, fontWeight: 700,
                                      background: opColors[op] || "#6b7280", color: "#fff",
                                    }}>{op}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: 16, fontSize: 12, color: "var(--text-muted)" }}>
            The access matrix is stored as a contract in the database and cached for 30 seconds.
            To modify permissions, update the <code style={{ fontSize: 11, padding: "1px 4px", borderRadius: 4, background: "var(--surface-tertiary)" }}>ENTITY_ACCESS_V1</code> contract
            via seed scripts or the Fallback Defaults tab.
          </div>
        </div>
      )}

      {/* Fallback Defaults Tab */}
      {activeTab === "fallbacks" && (
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
                          setJsonModalKey(s.key);
                          setJsonModalLabel(s.label);
                          setJsonModalText(
                            hasValue
                              ? JSON.stringify(currentValue, null, 2)
                              : "Not seeded yet. Run npm run db:seed to populate."
                          );
                          setJsonModalError("");
                          setJsonModalOpen(true);
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
      )}

      {/* JSON Editor Modal */}
      {jsonModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setJsonModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 16,
              padding: 24,
              width: "90%",
              maxWidth: 700,
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                {jsonModalLabel}
              </h3>
              <button
                onClick={() => setJsonModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, fontFamily: "monospace" }}>
              {jsonModalKey}
            </div>

            <textarea
              value={jsonModalText}
              onChange={(e) => {
                setJsonModalText(e.target.value);
                setJsonModalError("");
              }}
              style={{
                flex: 1,
                minHeight: 300,
                padding: 16,
                borderRadius: 10,
                border: jsonModalError
                  ? "2px solid var(--status-error-text)"
                  : "1px solid var(--border-default)",
                background: "var(--surface-secondary)",
                color: "var(--text-primary)",
                fontSize: 13,
                fontFamily: "monospace",
                lineHeight: 1.5,
                resize: "vertical",
              }}
            />

            {jsonModalError && (
              <div style={{ fontSize: 12, color: "var(--status-error-text)", marginTop: 8 }}>
                {jsonModalError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setJsonModalOpen(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--border-default)",
                  background: "var(--surface-secondary)",
                  color: "var(--text-primary)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  try {
                    const parsed = JSON.parse(jsonModalText);
                    fetch("/api/system-settings", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ key: jsonModalKey, value: parsed }),
                    })
                      .then((r) => r.json())
                      .then((data) => {
                        if (data.ok) {
                          setFallbackValues((prev) => ({ ...prev, [jsonModalKey]: parsed }));
                          setJsonModalOpen(false);
                        } else {
                          setJsonModalError(data.error || "Failed to save");
                        }
                      })
                      .catch((err) => setJsonModalError(err.message));
                  } catch {
                    setJsonModalError("Invalid JSON — please fix syntax errors before saving");
                  }
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--accent-primary)",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Save size={14} />
                Save
              </button>
            </div>
          </div>
        </div>
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
