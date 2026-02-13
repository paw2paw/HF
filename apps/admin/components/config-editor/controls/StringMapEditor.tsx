"use client";

import { useCallback, useState } from "react";

interface StringMapEditorProps {
  label: string;
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  disabled?: boolean;
}

/**
 * Key-value pair editor for Record<string, string>.
 * Shows each pair as an editable row with remove button.
 */
export function StringMapEditor({ label, value, onChange, disabled }: StringMapEditorProps) {
  const [newKey, setNewKey] = useState("");
  const entries = Object.entries(value);

  const updateValue = useCallback(
    (key: string, val: string) => {
      onChange({ ...value, [key]: val });
    },
    [value, onChange],
  );

  const removeKey = useCallback(
    (key: string) => {
      const next = { ...value };
      delete next[key];
      onChange(next);
    },
    [value, onChange],
  );

  const addKey = useCallback(() => {
    const trimmed = newKey.trim();
    if (trimmed && !(trimmed in value)) {
      onChange({ ...value, [trimmed]: "" });
      setNewKey("");
    }
  }, [newKey, value, onChange]);

  return (
    <div style={{ padding: "6px 0" }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {entries.map(([key, val]) => {
          const isTemplate = val.includes("{") && val.includes("}");
          return (
            <div key={key} style={{ display: "flex", alignItems: "start", gap: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  minWidth: 80,
                  paddingTop: 5,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={key}
              >
                {key}
              </span>
              <input
                type="text"
                value={val}
                onChange={(e) => updateValue(key, e.target.value)}
                disabled={disabled}
                style={{
                  flex: 1,
                  padding: "3px 6px",
                  borderRadius: 4,
                  border: "1px solid var(--border-default, #d1d5db)",
                  fontSize: 11,
                  fontFamily: isTemplate ? "monospace" : "inherit",
                  color: "var(--text-primary)",
                  background: disabled ? "var(--surface-disabled)" : "var(--surface-primary, #fff)",
                }}
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeKey(key)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11,
                    color: "var(--text-tertiary, #9ca3af)",
                    padding: "4px 2px",
                  }}
                >
                  x
                </button>
              )}
            </div>
          );
        })}
      </div>
      {!disabled && (
        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addKey();
              }
            }}
            placeholder="Add key..."
            style={{
              flex: 1,
              padding: "3px 6px",
              borderRadius: 4,
              border: "1px solid var(--border-default, #d1d5db)",
              fontSize: 11,
              color: "var(--text-primary)",
              background: "var(--surface-primary, #fff)",
            }}
          />
          <button
            type="button"
            onClick={addKey}
            style={{
              padding: "3px 8px",
              borderRadius: 4,
              border: "1px solid var(--border-default, #d1d5db)",
              background: "var(--surface-primary, #fff)",
              fontSize: 11,
              cursor: "pointer",
              color: "var(--text-primary)",
            }}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
