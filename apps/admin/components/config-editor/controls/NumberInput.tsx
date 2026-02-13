"use client";

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function NumberInput({ label, value, onChange, disabled }: NumberInputProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        disabled={disabled}
        style={{
          width: 80,
          padding: "4px 8px",
          borderRadius: 4,
          border: "1px solid var(--border-default, #d1d5db)",
          background: disabled ? "var(--surface-disabled)" : "var(--surface-primary, #fff)",
          fontSize: 12,
          fontFamily: "monospace",
          color: "var(--text-primary)",
          textAlign: "right",
        }}
      />
    </div>
  );
}
