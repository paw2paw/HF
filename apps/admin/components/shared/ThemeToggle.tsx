"use client";

import { useTheme, type ThemePreference } from "@/contexts";

const themeOptions: { value: ThemePreference; label: string; icon: string }[] = [
  { value: "system", label: "System", icon: "🖥️" },
  { value: "light", label: "Light", icon: "☀️" },
  { value: "dark", label: "Dark", icon: "🌙" },
];

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <div
      style={{
        display: "inline-flex",
        borderRadius: 8,
        border: "1px solid var(--border-default)",
        overflow: "hidden",
        background: "var(--surface-secondary)",
      }}
    >
      {themeOptions.map((option) => {
        const isActive = preference === option.value;
        return (
          <button
            key={option.value}
            onClick={() => setPreference(option.value)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "var(--button-primary-text)" : "var(--text-secondary)",
              background: isActive ? "var(--button-primary-bg)" : "transparent",
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            title={`${option.label} theme`}
          >
            <span style={{ fontSize: 14 }}>{option.icon}</span>
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Compact version for sidebar/header
export function ThemeToggleCompact() {
  const { preference, resolvedTheme, toggleTheme } = useTheme();

  const icon = preference === "system"
    ? "🖥️"
    : resolvedTheme === "dark"
      ? "🌙"
      : "☀️";

  const label = preference === "system"
    ? `System (${resolvedTheme})`
    : preference === "dark"
      ? "Dark"
      : "Light";

  return (
    <button
      onClick={toggleTheme}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        fontSize: 12,
        color: "var(--text-muted)",
        background: "transparent",
        border: "1px solid var(--border-default)",
        borderRadius: 6,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
      title={`Theme: ${label} (click to cycle)`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
