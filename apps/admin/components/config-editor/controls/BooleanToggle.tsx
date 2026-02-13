"use client";

interface BooleanToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function BooleanToggle({ label, value, onChange, disabled }: BooleanToggleProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!value)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          border: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          background: value ? "var(--accent-primary, #4f46e5)" : "var(--border-default, #d1d5db)",
          position: "relative",
          transition: "background 0.15s",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            background: "#fff",
            position: "absolute",
            top: 2,
            left: value ? 18 : 2,
            transition: "left 0.15s",
            boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
          }}
        />
      </button>
    </div>
  );
}
