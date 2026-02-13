"use client";

import { useCallback } from "react";
import { ConfigField } from "../ConfigField";

interface NestedObjectEditorProps {
  label: string;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  disabled?: boolean;
  depth?: number;
}

/**
 * Recursive sub-section for nested objects.
 * Renders each property via ConfigField (which dispatches to the right control).
 * Beyond maxDepth, falls back to inline JSON.
 */
export function NestedObjectEditor({ label, value, onChange, disabled, depth = 0 }: NestedObjectEditorProps) {
  const updateField = useCallback(
    (key: string, newValue: unknown) => {
      onChange({ ...value, [key]: newValue });
    },
    [value, onChange],
  );

  return (
    <div style={{ padding: "6px 0" }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{label}</div>
      <div
        style={{
          paddingLeft: 12,
          borderLeft: `2px solid var(--border-default, #e5e7eb)`,
        }}
      >
        {Object.entries(value).map(([key, val]) => (
          <ConfigField
            key={key}
            fieldKey={key}
            value={val}
            onChange={(newVal) => updateField(key, newVal)}
            disabled={disabled}
            depth={depth + 1}
          />
        ))}
      </div>
    </div>
  );
}
