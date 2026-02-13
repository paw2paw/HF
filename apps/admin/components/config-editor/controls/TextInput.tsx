"use client";

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  multiline?: boolean;
}

export function TextInput({ label, value, onChange, disabled, multiline }: TextInputProps) {
  const sharedStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    borderRadius: 4,
    border: "1px solid var(--border-default, #d1d5db)",
    background: disabled ? "var(--surface-disabled)" : "var(--surface-primary, #fff)",
    fontSize: 12,
    color: "var(--text-primary)",
    resize: multiline ? "vertical" : undefined,
  };

  return (
    <div style={{ padding: "6px 0" }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{label}</div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={3}
          style={sharedStyle}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={sharedStyle}
        />
      )}
    </div>
  );
}
