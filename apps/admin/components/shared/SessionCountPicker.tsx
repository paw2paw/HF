"use client";

const TEMPLATES = [
  { label: "Quick Intro", sessions: 6 },
  { label: "Standard", sessions: 12 },
  { label: "Deep Dive", sessions: 20 },
] as const;

const PRESET_COUNTS = TEMPLATES.map((t) => t.sessions);

interface SessionCountRecommendation {
  min: number;
  recommended: number;
  max: number;
  breakdown: {
    onboarding: number;
    teaching: number;
    review: number;
    assess: number;
    consolidation: number;
  };
  effectiveMaxTPs: number;
  totalTPs: number;
  totalModules: number;
}

interface AdvisoryCheck {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  affectedSessions?: number[];
}

interface SessionCountPickerProps {
  value: number | null;
  onChange: (count: number | null) => void;
  /** Override the label. Defaults to "Suggested number of sessions" */
  label?: string;
  /** Hide the built-in label (when parent provides its own via FieldHint) */
  hideLabel?: boolean;
  /** AI-computed recommendation based on content analysis */
  recommendation?: SessionCountRecommendation | null;
  /** Distribution advisory warnings */
  advisories?: AdvisoryCheck[] | null;
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  error: { bg: "color-mix(in srgb, var(--status-error) 8%, transparent)", border: "var(--status-error)", color: "var(--status-error)" },
  warning: { bg: "color-mix(in srgb, var(--status-warning) 8%, transparent)", border: "var(--status-warning)", color: "var(--status-warning)" },
  info: { bg: "color-mix(in srgb, var(--accent-primary) 5%, transparent)", border: "var(--border-default)", color: "var(--text-muted)" },
};

export function SessionCountPicker({ value, onChange, label, hideLabel, recommendation, advisories }: SessionCountPickerProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      {!hideLabel && (
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
          {label ?? "Suggested number of sessions"}
        </div>
      )}

      {/* Recommendation banner */}
      {recommendation && recommendation.totalTPs > 0 && (
        <div style={{
          padding: "8px 12px",
          borderRadius: 8,
          background: "color-mix(in srgb, var(--accent-primary) 6%, transparent)",
          border: "1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)",
          marginBottom: 10,
          fontSize: 12,
          lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
            Suggested: {recommendation.recommended} sessions
            <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 8 }}>
              (min {recommendation.min} · max {recommendation.max})
            </span>
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
            {recommendation.breakdown.onboarding} onboarding · {recommendation.breakdown.teaching} teaching · {recommendation.breakdown.review} review · {recommendation.breakdown.assess} assess · {recommendation.breakdown.consolidation} consolidation
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 2 }}>
            Based on {recommendation.totalTPs} teaching points across {recommendation.totalModules} topics
          </div>
          {!value && (
            <button
              onClick={() => onChange(recommendation.recommended)}
              style={{
                marginTop: 6,
                padding: "4px 10px",
                borderRadius: 5,
                border: "1px solid var(--accent-primary)",
                background: "var(--accent-primary)",
                color: "white",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Use suggested ({recommendation.recommended})
            </button>
          )}
        </div>
      )}

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
      {value && !recommendation && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
          Starting target: {value} sessions. The system adjusts based on your content once extracted.
        </div>
      )}

      {/* Advisory warnings */}
      {advisories && advisories.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {advisories.map((a, i) => {
            const style = SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.info;
            return (
              <div
                key={`${a.id}-${i}`}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  background: style.bg,
                  border: `1px solid ${style.border}`,
                  fontSize: 11,
                  color: style.color,
                  lineHeight: 1.4,
                }}
              >
                {a.message}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
