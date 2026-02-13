"use client";

import { useState, useCallback } from "react";

interface RawJsonFallbackProps {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

export function RawJsonFallback({ label, value, onChange, disabled }: RawJsonFallbackProps) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(
    (raw: string) => {
      setText(raw);
      try {
        const parsed = JSON.parse(raw);
        setError(null);
        onChange(parsed);
      } catch (e: any) {
        setError(e.message);
      }
    },
    [onChange],
  );

  return (
    <div style={{ padding: "6px 0" }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{label}</div>
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        rows={4}
        style={{
          width: "100%",
          padding: "6px 8px",
          borderRadius: 4,
          border: error ? "1px solid var(--status-error-border, #ef4444)" : "1px solid var(--border-default, #d1d5db)",
          background: error ? "var(--status-error-bg, #fef2f2)" : disabled ? "var(--surface-disabled)" : "var(--surface-primary, #fff)",
          fontSize: 11,
          fontFamily: "monospace",
          color: "var(--text-primary)",
          resize: "vertical",
        }}
      />
      {error && (
        <div style={{ fontSize: 10, color: "var(--status-error-text, #ef4444)", marginTop: 2 }}>
          {error}
        </div>
      )}
    </div>
  );
}
