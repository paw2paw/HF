"use client";

import { useState, useCallback } from "react";

interface TagListEditorProps {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

export function TagListEditor({ label, value, onChange, disabled }: TagListEditorProps) {
  const [input, setInput] = useState("");

  const addTag = useCallback(() => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setInput("");
    }
  }, [input, value, onChange]);

  const removeTag = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange],
  );

  return (
    <div style={{ padding: "6px 0" }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: value.length > 0 ? 6 : 0 }}>
        {value.map((tag, i) => (
          <span
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              borderRadius: 12,
              background: "var(--surface-secondary, #f3f4f6)",
              border: "1px solid var(--border-default, #e5e7eb)",
              fontSize: 11,
              color: "var(--text-primary)",
            }}
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(i)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "var(--text-tertiary, #9ca3af)",
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                x
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div style={{ display: "flex", gap: 4 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Type and press Enter..."
            style={{
              flex: 1,
              padding: "4px 8px",
              borderRadius: 4,
              border: "1px solid var(--border-default, #d1d5db)",
              background: "var(--surface-primary, #fff)",
              fontSize: 11,
              color: "var(--text-primary)",
            }}
          />
          <button
            type="button"
            onClick={addTag}
            style={{
              padding: "4px 10px",
              borderRadius: 4,
              border: "1px solid var(--border-default, #d1d5db)",
              background: "var(--surface-primary, #fff)",
              fontSize: 11,
              cursor: "pointer",
              color: "var(--text-primary)",
            }}
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
