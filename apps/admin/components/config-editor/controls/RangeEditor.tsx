"use client";

interface RangeEditorProps {
  label: string;
  value: { min: number; max: number; [extra: string]: unknown };
  onChange: (value: { min: number; max: number; [extra: string]: unknown }) => void;
  disabled?: boolean;
}

/**
 * Dual number inputs for { min, max } range objects.
 * Shows a visual bar between the two values.
 */
export function RangeEditor({ label, value, onChange, disabled }: RangeEditorProps) {
  const rangeMax = Math.max(1, value.max, value.min);
  const leftPct = (value.min / rangeMax) * 100;
  const rightPct = (value.max / rangeMax) * 100;

  const inputStyle: React.CSSProperties = {
    width: 64,
    padding: "3px 6px",
    borderRadius: 4,
    border: "1px solid var(--border-default, #d1d5db)",
    background: disabled ? "var(--surface-disabled)" : "var(--surface-primary, #fff)",
    fontSize: 11,
    fontFamily: "monospace",
    color: "var(--text-primary)",
    textAlign: "center",
  };

  return (
    <div style={{ padding: "6px 0" }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>{label}</div>
      {/* Visual range bar */}
      <div style={{ height: 8, borderRadius: 4, background: "var(--border-default, #e5e7eb)", position: "relative", marginBottom: 8 }}>
        <div
          style={{
            position: "absolute",
            left: `${leftPct}%`,
            width: `${rightPct - leftPct}%`,
            height: "100%",
            borderRadius: 4,
            background: "var(--accent-primary, #4f46e5)",
            opacity: 0.6,
          }}
        />
      </div>
      {/* Number inputs */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>min</span>
          <input
            type="number"
            value={value.min}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onChange({ ...value, min: v });
            }}
            disabled={disabled}
            step={rangeMax <= 1 ? 0.01 : 1}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1, borderTop: "1px dashed var(--border-default, #d1d5db)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>max</span>
          <input
            type="number"
            value={value.max}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onChange({ ...value, max: v });
            }}
            disabled={disabled}
            step={rangeMax <= 1 ? 0.01 : 1}
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );
}
