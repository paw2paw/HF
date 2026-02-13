"use client";

import { useState, useCallback } from "react";
import { ConfigField } from "../ConfigField";

interface ObjectListEditorProps {
  label: string;
  value: Record<string, unknown>[];
  onChange: (value: Record<string, unknown>[]) => void;
  disabled?: boolean;
  depth?: number;
}

/**
 * Renders object[] as expandable cards.
 * Each card header shows a summary (first string field or index).
 * Expanded card recursively renders ConfigField for each property.
 */
export function ObjectListEditor({ label, value, onChange, disabled, depth = 0 }: ObjectListEditorProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const getCardSummary = useCallback((item: Record<string, unknown>, index: number): string => {
    // Find the first short string field for a human-readable summary
    for (const [k, v] of Object.entries(item)) {
      if (typeof v === "string" && v.length > 0 && v.length < 60) {
        return `${k}: ${v}`;
      }
    }
    // Fall back to first key with a name-like value
    const nameKey = Object.keys(item).find((k) => /name|id|slug|label|title/i.test(k));
    if (nameKey && item[nameKey]) return String(item[nameKey]);
    return `Item ${index + 1}`;
  }, []);

  const updateItem = useCallback(
    (index: number, key: string, newValue: unknown) => {
      const updated = value.map((item, i) => {
        if (i !== index) return item;
        return { ...item, [key]: newValue };
      });
      onChange(updated);
    },
    [value, onChange],
  );

  const removeItem = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange],
  );

  const addItem = useCallback(() => {
    // Clone structure from first item (with empty/default values) or create empty object
    if (value.length > 0) {
      const template: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value[0])) {
        if (typeof v === "string") template[k] = "";
        else if (typeof v === "number") template[k] = 0;
        else if (typeof v === "boolean") template[k] = false;
        else if (Array.isArray(v)) template[k] = [];
        else if (v && typeof v === "object") template[k] = {};
        else template[k] = null;
      }
      onChange([...value, template]);
    } else {
      onChange([...value, {}]);
    }
    setExpandedIndex(value.length);
  }, [value, onChange]);

  return (
    <div style={{ padding: "6px 0" }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {value.map((item, index) => {
          const isExpanded = expandedIndex === index;
          return (
            <div
              key={index}
              style={{
                border: "1px solid var(--border-default, #e5e7eb)",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              {/* Card header */}
              <div
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  background: isExpanded ? "var(--surface-secondary, #f9fafb)" : "var(--surface-primary, #fff)",
                  cursor: "pointer",
                  fontSize: 11,
                  color: "var(--text-primary)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                  <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                    {isExpanded ? "v" : ">"}
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {getCardSummary(item, index)}
                  </span>
                </div>
                <span style={{ fontSize: 10, color: "var(--text-tertiary)", flexShrink: 0 }}>
                  {Object.keys(item).length} fields
                </span>
              </div>
              {/* Expanded content */}
              {isExpanded && (
                <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border-default, #e5e7eb)" }}>
                  {Object.entries(item).map(([key, val]) => (
                    <ConfigField
                      key={key}
                      fieldKey={key}
                      value={val}
                      onChange={(newVal) => updateItem(index, key, newVal)}
                      disabled={disabled}
                      depth={depth + 1}
                    />
                  ))}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      style={{
                        marginTop: 6,
                        padding: "3px 8px",
                        borderRadius: 4,
                        border: "1px solid var(--status-error-border, #fca5a5)",
                        background: "var(--status-error-bg, #fef2f2)",
                        fontSize: 10,
                        color: "var(--status-error-text, #dc2626)",
                        cursor: "pointer",
                      }}
                    >
                      Remove item
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!disabled && (
        <button
          type="button"
          onClick={addItem}
          style={{
            marginTop: 6,
            padding: "4px 10px",
            borderRadius: 4,
            border: "1px dashed var(--border-default, #d1d5db)",
            background: "none",
            fontSize: 11,
            cursor: "pointer",
            color: "var(--text-secondary)",
            width: "100%",
          }}
        >
          + Add item
        </button>
      )}
    </div>
  );
}
