"use client";

import { useState, useEffect } from "react";

type LogLevel = "full" | "med" | "off";

const LOG_LEVELS: { value: LogLevel; label: string; description: string }[] = [
  { value: "full", label: "Full", description: "All log entries including debug" },
  { value: "med", label: "Medium", description: "Info, warn, and error only" },
  { value: "off", label: "Off", description: "No logs (only final result)" },
];

export default function LoggingSettingsCard() {
  const [logLevel, setLogLevel] = useState<LogLevel>("full");
  const [saved, setSaved] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("hf_log_level");
    if (stored && (stored === "full" || stored === "med" || stored === "off")) {
      setLogLevel(stored);
    }
  }, []);

  const handleChange = (level: LogLevel) => {
    setLogLevel(level);
    localStorage.setItem("hf_log_level", level);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Op Logging Level</h3>
        {saved && (
          <span style={{ fontSize: 11, color: "#10b981" }}>Saved</span>
        )}
      </div>

      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
        Controls the verbosity of logs shown in the op execution panel on caller detail pages.
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        {LOG_LEVELS.map((level) => (
          <button
            key={level.value}
            onClick={() => handleChange(level.value)}
            style={{
              flex: 1,
              padding: "12px 16px",
              background: logLevel === level.value ? "#eef2ff" : "#f9fafb",
              border: `2px solid ${logLevel === level.value ? "#4f46e5" : "#e5e7eb"}`,
              borderRadius: 8,
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: logLevel === level.value ? "#4f46e5" : "#374151",
              }}
            >
              {level.label}
            </div>
            <div
              style={{
                fontSize: 11,
                color: logLevel === level.value ? "#6366f1" : "#9ca3af",
                marginTop: 4,
              }}
            >
              {level.description}
            </div>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: "#9ca3af" }}>
        Setting takes effect immediately for new op runs. Stored locally in your browser.
      </div>
    </div>
  );
}
