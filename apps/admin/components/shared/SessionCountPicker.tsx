"use client";

const TEMPLATES = [
  { label: "Quick Intro", sessions: 6 },
  { label: "Standard", sessions: 12 },
  { label: "Deep Dive", sessions: 20 },
] as const;

const PRESET_COUNTS = TEMPLATES.map((t) => t.sessions);

interface SessionCountPickerProps {
  value: number | null;
  onChange: (count: number | null) => void;
}

export function SessionCountPicker({ value, onChange }: SessionCountPickerProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
        How many sessions?
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {TEMPLATES.map((t) => (
          <button
            key={t.sessions}
            onClick={() => onChange(t.sessions)}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: `1px solid ${value === t.sessions ? "var(--accent-primary)" : "var(--border-default)"}`,
              background: value === t.sessions ? "color-mix(in srgb, var(--accent-primary) 10%, transparent)" : "var(--surface-primary)",
              color: value === t.sessions ? "var(--accent-primary)" : "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t.label} ({t.sessions})
          </button>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="number"
            min={1}
            max={100}
            placeholder="Custom"
            value={value && !PRESET_COUNTS.includes(value as any) ? value : ""}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              onChange(v > 0 && v <= 100 ? v : null);
            }}
            style={{
              width: 72,
              padding: "5px 8px",
              borderRadius: 6,
              border: `1px solid ${value && !PRESET_COUNTS.includes(value as any) ? "var(--accent-primary)" : "var(--border-default)"}`,
              background: "var(--surface-primary)",
              color: "var(--text-primary)",
              fontSize: 12,
            }}
          />
        </div>
        {value && (
          <button
            onClick={() => onChange(null)}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 11 }}
          >
            Clear
          </button>
        )}
      </div>
      {value && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
          AI will generate a {value}-session plan with onboarding, teaching, review, and assessment phases.
        </div>
      )}
    </div>
  );
}
