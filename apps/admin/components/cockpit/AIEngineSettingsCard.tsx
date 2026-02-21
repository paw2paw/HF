"use client";

import { useState, useEffect } from "react";

type AIEngine = "mock" | "claude" | "openai";

const AI_ENGINES: { value: AIEngine; label: string; description: string; envKey?: string }[] = [
  { value: "mock", label: "Mock", description: "Pattern-based scoring (no API calls)" },
  { value: "claude", label: "Claude", description: "Anthropic Claude API", envKey: "ANTHROPIC_API_KEY" },
  { value: "openai", label: "OpenAI", description: "OpenAI GPT API", envKey: "OPENAI_HF_MVP_KEY" },
];

export default function AIEngineSettingsCard() {
  // Default to claude for real AI inference
  const [engine, setEngine] = useState<AIEngine>("claude");
  const [saved, setSaved] = useState(false);
  const [envStatus, setEnvStatus] = useState<Record<string, boolean>>({});

  // Load from localStorage and check env vars on mount
  useEffect(() => {
    const stored = localStorage.getItem("hf_ai_engine");
    if (stored && (stored === "mock" || stored === "claude" || stored === "openai")) {
      setEngine(stored);
    }

    // Check which API keys are configured
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => {
        const envChecks = data.checks?.env?.details?.optional || {};
        setEnvStatus({
          claude: !!envChecks.ANTHROPIC_API_KEY,
          openai: !!envChecks.OPENAI_HF_MVP_KEY || !!envChecks.OPENAI_API_KEY,
        });
      })
      .catch((e) => console.warn("[AIEngine] Failed to check env status:", e));
  }, []);

  const handleChange = (newEngine: AIEngine) => {
    setEngine(newEngine);
    localStorage.setItem("hf_ai_engine", newEngine);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isEngineAvailable = (eng: AIEngine): boolean => {
    if (eng === "mock") return true;
    if (eng === "claude") return envStatus.claude ?? false;
    if (eng === "openai") return envStatus.openai ?? false;
    return false;
  };

  return (
    <div
      style={{
        background: "var(--surface-primary)",
        border: "1px solid var(--border-default)",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>AI Engine</h3>
        {saved && (
          <span style={{ fontSize: 11, color: "var(--status-success-text)" }}>Saved</span>
        )}
      </div>

      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        Select which AI engine to use for analysis operations (MEASURE, LEARN, etc).
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        {AI_ENGINES.map((eng) => {
          const available = isEngineAvailable(eng.value);
          const isSelected = engine === eng.value;

          return (
            <button
              key={eng.value}
              onClick={() => available && handleChange(eng.value)}
              disabled={!available}
              style={{
                flex: 1,
                padding: "12px 16px",
                background: isSelected ? "var(--surface-selected, #eef2ff)" : available ? "var(--surface-secondary)" : "var(--surface-secondary)",
                border: `2px solid ${isSelected ? "var(--accent-primary)" : "var(--border-default)"}`,
                borderRadius: 8,
                cursor: available ? "pointer" : "not-allowed",
                textAlign: "center",
                opacity: available ? 1 : 0.5,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: isSelected ? "var(--accent-primary)" : available ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                {eng.label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: isSelected ? "var(--badge-indigo-text, #6366f1)" : "var(--text-muted)",
                  marginTop: 4,
                }}
              >
                {eng.description}
              </div>
              {eng.envKey && (
                <div
                  style={{
                    fontSize: 10,
                    marginTop: 6,
                    color: available ? "var(--status-success-text)" : "var(--status-error-text)",
                  }}
                >
                  {available ? "API key configured" : `Missing ${eng.envKey}`}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-muted)" }}>
        Setting takes effect immediately for new op runs. Mock mode uses pattern-based scoring without API calls.
      </div>
    </div>
  );
}
