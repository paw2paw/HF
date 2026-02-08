"use client";

import { useTheme, usePalette, type ThemePreference } from "@/contexts";

const themeOptions: { value: ThemePreference; label: string; icon: string; description: string }[] = [
  { value: "light", label: "Light", icon: "sun", description: "Bright and clear" },
  { value: "dark", label: "Dark", icon: "moon", description: "Easy on the eyes" },
  { value: "system", label: "System", icon: "monitor", description: "Match your device" },
];

function ThemeIcon({ icon, size = 20 }: { icon: string; size?: number }) {
  const iconStyle = { width: size, height: size, strokeWidth: 1.5 };

  if (icon === "sun") {
    return (
      <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    );
  }
  if (icon === "moon") {
    return (
      <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
    );
  }
  if (icon === "monitor") {
    return (
      <svg {...iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    );
  }
  return null;
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function SettingsPage() {
  const { preference, setPreference, resolvedTheme } = useTheme();
  const { lightPalette, darkPalette, setLightPalette, setDarkPalette, lightPresets, darkPresets } = usePalette();

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
          Appearance
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Customize the look and feel of the application
        </p>
      </div>

      {/* Theme Mode Section */}
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
                  border: isSelected
                    ? "2px solid var(--accent-primary)"
                    : "1px solid var(--border-default)",
                  background: isSelected ? "var(--surface-secondary)" : "var(--surface-primary)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  position: "relative",
                }}
              >
                {isSelected && (
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "var(--accent-primary)",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CheckIcon />
                  </div>
                )}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "var(--surface-tertiary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isSelected ? "var(--accent-primary)" : "var(--text-muted)",
                  }}
                >
                  <ThemeIcon icon={option.icon} size={22} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                    {option.label}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {option.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Color Palettes - Two Column Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Light Mode Palettes */}
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ color: "var(--text-muted)" }}>
              <ThemeIcon icon="sun" size={18} />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              Light Palette
            </h2>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            Background tones for light mode
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lightPresets.map((preset) => {
              const isSelected = lightPalette === preset.id;
              const isActive = resolvedTheme === "light" && isSelected;
              return (
                <button
                  key={preset.id}
                  onClick={() => setLightPalette(preset.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: isSelected
                      ? "2px solid var(--accent-primary)"
                      : "1px solid var(--border-default)",
                    background: preset.light.surfacePrimary,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    position: "relative",
                  }}
                >
                  {/* Color swatches */}
                  <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                    {[preset.light.background, preset.light.surfacePrimary, preset.light.surfaceSecondary, preset.light.surfaceTertiary].map((color, i) => (
                      <div
                        key={i}
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          background: color,
                          border: "1px solid rgba(0,0,0,0.1)",
                        }}
                      />
                    ))}
                  </div>

                  {/* Label */}
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
                      {preset.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>
                      {preset.description}
                    </div>
                  </div>

                  {/* Active/Selected indicator */}
                  {isActive && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#22c55e",
                        boxShadow: "0 0 0 2px rgba(34, 197, 94, 0.2)",
                      }}
                      title="Currently active"
                    />
                  )}
                  {isSelected && !isActive && (
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "var(--accent-primary)",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <CheckIcon />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dark Mode Palettes */}
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ color: "var(--text-muted)" }}>
              <ThemeIcon icon="moon" size={18} />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              Dark Palette
            </h2>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            Background tones for dark mode
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {darkPresets.map((preset) => {
              const isSelected = darkPalette === preset.id;
              const isActive = resolvedTheme === "dark" && isSelected;
              const colors = preset.dark!;
              return (
                <button
                  key={preset.id}
                  onClick={() => setDarkPalette(preset.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: isSelected
                      ? "2px solid var(--accent-primary)"
                      : "1px solid #3f3f46",
                    background: colors.surfacePrimary,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    position: "relative",
                  }}
                >
                  {/* Color swatches */}
                  <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                    {[colors.background, colors.surfacePrimary, colors.surfaceSecondary, colors.surfaceTertiary].map((color, i) => (
                      <div
                        key={i}
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          background: color,
                          border: "1px solid rgba(255,255,255,0.1)",
                        }}
                      />
                    ))}
                  </div>

                  {/* Label */}
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#e5e7eb" }}>
                      {preset.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      {preset.description}
                    </div>
                  </div>

                  {/* Active/Selected indicator */}
                  {isActive && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#22c55e",
                        boxShadow: "0 0 0 2px rgba(34, 197, 94, 0.2)",
                      }}
                      title="Currently active"
                    />
                  )}
                  {isSelected && !isActive && (
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "var(--accent-primary)",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <CheckIcon />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Info */}
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
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "var(--surface-tertiary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            fontSize: 18,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 2 }}>
            Settings saved automatically
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Your preferences are stored locally in your browser and sync across tabs
          </div>
        </div>
      </div>
    </div>
  );
}
