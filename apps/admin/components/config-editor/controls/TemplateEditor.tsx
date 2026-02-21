"use client";

import { useMemo } from "react";

interface TemplateEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Editor for template strings with {placeholder} tokens highlighted.
 * Shows a live preview below the input.
 */
export function TemplateEditor({ label, value, onChange, disabled }: TemplateEditorProps) {
  const highlighted = useMemo(() => {
    const parts: Array<{ text: string; isToken: boolean }> = [];
    const regex = /\{([^}]+)\}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(value)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: value.slice(lastIndex, match.index), isToken: false });
      }
      parts.push({ text: match[0], isToken: true });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < value.length) {
      parts.push({ text: value.slice(lastIndex), isToken: false });
    }
    return parts;
  }, [value]);

  return (
    <div style={{ padding: "6px 0" }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{label}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "6px 8px",
          borderRadius: 4,
          border: "1px solid var(--border-default, #d1d5db)",
          background: disabled ? "var(--surface-disabled)" : "var(--surface-primary, #fff)",
          fontSize: 12,
          fontFamily: "monospace",
          color: "var(--text-primary)",
        }}
      />
      {/* Preview with highlighted tokens */}
      <div
        style={{
          marginTop: 4,
          padding: "4px 8px",
          borderRadius: 4,
          background: "var(--surface-secondary, #f9fafb)",
          fontSize: 11,
          lineHeight: 1.6,
        }}
      >
        {highlighted.map((part, i) =>
          part.isToken ? (
            <span
              key={i}
              style={{
                background: "var(--accent-bg, #ede9fe)",
                color: "var(--accent-primary)",
                padding: "1px 4px",
                borderRadius: 3,
                fontWeight: 500,
                fontSize: 10,
              }}
            >
              {part.text}
            </span>
          ) : (
            <span key={i} style={{ color: "var(--text-secondary)" }}>{part.text}</span>
          ),
        )}
      </div>
    </div>
  );
}
