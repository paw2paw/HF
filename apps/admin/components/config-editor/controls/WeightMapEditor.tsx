"use client";

import { useCallback, useState } from "react";

interface WeightMapEditorProps {
  label: string;
  value: Record<string, number>;
  onChange: (value: Record<string, number>) => void;
  disabled?: boolean;
}

/**
 * Mini horizontal fader UI for Record<string, number>.
 * Each key gets a slider row. Supports add/remove keys.
 */
export function WeightMapEditor({ label, value, onChange, disabled }: WeightMapEditorProps) {
  const [newKey, setNewKey] = useState("");
  const entries = Object.entries(value);

  // Infer the range from existing values
  const maxVal = Math.max(1, ...entries.map(([, v]) => v));
  const step = maxVal <= 1 ? 0.01 : maxVal <= 10 ? 0.1 : 1;

  const updateValue = useCallback(
    (key: string, val: number) => {
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
      onChange({ ...value, [trimmed]: 0 });
      setNewKey("");
    }
  }, [newKey, value, onChange]);

  return (
    <div style={{ padding: "6px 0" }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {entries.map(([key, val]) => {
          const pct = (val / maxVal) * 100;
          return (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  minWidth: 80,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={key}
              >
                {key}
              </span>
              <div style={{ flex: 1, position: "relative", height: 18, display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    height: 4,
                    borderRadius: 2,
                    background: "var(--border-default, #e5e7eb)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    width: `${pct}%`,
                    height: 4,
                    borderRadius: 2,
                    background: "var(--accent-primary, #4f46e5)",
                  }}
                />
                <input
                  type="range"
                  min={0}
                  max={maxVal}
                  step={step}
                  value={val}
                  onChange={(e) => updateValue(key, parseFloat(e.target.value))}
                  disabled={disabled}
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: 18,
                    opacity: 0,
                    cursor: disabled ? "not-allowed" : "pointer",
                    margin: 0,
                  }}
                />
              </div>
              <span style={{ fontSize: 11, fontFamily: "monospace", minWidth: 36, textAlign: "right", color: "var(--text-primary)" }}>
                {val.toFixed(maxVal <= 1 ? 2 : 1)}
              </span>
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
                    padding: "0 2px",
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
