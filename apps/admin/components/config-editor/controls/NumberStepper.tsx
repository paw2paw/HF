"use client";

interface NumberStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

export function NumberStepper({
  label,
  value,
  onChange,
  disabled,
  min = 0,
  max = 999,
  step = 1,
}: NumberStepperProps) {
  const btnStyle: React.CSSProperties = {
    width: 26,
    height: 26,
    borderRadius: 4,
    border: "1px solid var(--border-default, #d1d5db)",
    background: "var(--surface-primary, #fff)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text-primary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
          style={btnStyle}
        >
          -
        </button>
        <span
          style={{
            minWidth: 32,
            textAlign: "center",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "monospace",
            color: "var(--text-primary)",
          }}
        >
          {value}
        </span>
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
          style={btnStyle}
        >
          +
        </button>
      </div>
    </div>
  );
}
