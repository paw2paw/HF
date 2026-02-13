"use client";

import { useState, useRef } from "react";
import { ConfigField } from "@/components/config-editor/ConfigField";

interface FlowStepCardProps {
  item: Record<string, unknown>;
  index: number;
  total: number;
  onUpdate: (key: string, value: unknown) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: () => void;
  isDragTarget: boolean;
  disabled?: boolean;
}

/** Try common naming fields for a human-readable card title. */
function getTitle(item: Record<string, unknown>): string {
  for (const key of ["name", "title", "label", "phase", "stage", "step", "id"]) {
    if (typeof item[key] === "string" && (item[key] as string).length > 0) {
      return item[key] as string;
    }
  }
  for (const val of Object.values(item)) {
    if (typeof val === "string" && val.length > 0 && val.length < 80) return val;
  }
  return "Untitled";
}

/** Find a description-like field for subtitle. */
function getSubtitle(item: Record<string, unknown>): string | null {
  for (const key of ["description", "operation", "query", "progressMessage", "purpose", "goal"]) {
    if (typeof item[key] === "string" && (item[key] as string).length > 0) {
      return item[key] as string;
    }
  }
  return null;
}

/** Detect a priority/severity for color-coding. */
function getPriority(item: Record<string, unknown>): string | null {
  const p = item.priority as string;
  if (typeof p === "string") return p.toLowerCase();
  const s = item.severity as string;
  if (typeof s === "string") return s.toLowerCase();
  return null;
}

const PRIORITY_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  critical: { border: "#ef4444", bg: "#fef2f2", text: "#dc2626" },
  high: { border: "#f97316", bg: "#fff7ed", text: "#ea580c" },
  medium: { border: "#eab308", bg: "#fefce8", text: "#ca8a04" },
  low: { border: "#22c55e", bg: "#f0fdf4", text: "#16a34a" },
  optional: { border: "#94a3b8", bg: "#f8fafc", text: "#64748b" },
};

export function FlowStepCard({
  item,
  index,
  total,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
  isDragTarget,
  disabled,
}: FlowStepCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const title = getTitle(item);
  const subtitle = getSubtitle(item);
  const priority = getPriority(item);
  const priorityStyle = priority ? PRIORITY_COLORS[priority] : null;

  // Collect string[] arrays as tag badges
  const tagFields: { key: string; values: string[] }[] = [];
  for (const [k, v] of Object.entries(item)) {
    if (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string") && v.length <= 10) {
      tagFields.push({ key: k, values: v as string[] });
    }
  }

  // Numeric fields for inline display
  const numericFields: { key: string; value: string }[] = [];
  for (const [k, v] of Object.entries(item)) {
    if (k === "order" || k === "priority") continue; // already shown
    if (typeof v === "string" && /^\d/.test(v) && k.toLowerCase().includes("duration")) {
      numericFields.push({ key: k, value: v });
    }
  }

  // Boolean flags
  const boolFlags: { key: string; value: boolean }[] = [];
  for (const [k, v] of Object.entries(item)) {
    if (typeof v === "boolean") boolFlags.push({ key: k, value: v });
  }

  const fieldCount = Object.keys(item).length;

  return (
    <div
      ref={cardRef}
      draggable={!disabled}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(index);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver(index);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      style={{
        borderRadius: 12,
        border: isDragTarget
          ? "2px dashed var(--accent-primary, #3b82f6)"
          : `1px solid ${priorityStyle?.border || "var(--border-default, #e5e7eb)"}`,
        background: isDragTarget
          ? "color-mix(in srgb, var(--accent-primary, #3b82f6) 5%, transparent)"
          : expanded
            ? "var(--surface-primary, #fff)"
            : priorityStyle?.bg || "var(--surface-primary, #fff)",
        overflow: "hidden",
        transition: "all 0.2s ease",
        boxShadow: expanded
          ? "0 4px 16px rgba(0,0,0,0.08)"
          : "0 1px 3px rgba(0,0,0,0.04)",
        marginBottom: 12,
      }}
    >
      {/* Card header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "12px 14px",
          cursor: "pointer",
        }}
      >
        {/* Drag handle */}
        {!disabled && (
          <div
            style={{
              flexShrink: 0,
              cursor: "grab",
              color: "var(--text-tertiary, #9ca3af)",
              fontSize: 14,
              lineHeight: "20px",
              userSelect: "none",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            ⠿
          </div>
        )}

        {/* Title + subtitle */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-primary, #111827)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </div>

            {/* Priority badge */}
            {priority && (
              <span
                style={{
                  fontSize: 10,
                  padding: "1px 7px",
                  borderRadius: 10,
                  background: priorityStyle?.bg || "#f3f4f6",
                  color: priorityStyle?.text || "#6b7280",
                  fontWeight: 600,
                  textTransform: "capitalize",
                  flexShrink: 0,
                }}
              >
                {priority}
              </span>
            )}

            {/* Duration */}
            {numericFields.map((f) => (
              <span
                key={f.key}
                style={{
                  fontSize: 10,
                  padding: "1px 7px",
                  borderRadius: 10,
                  background: "#f0f9ff",
                  color: "#0369a1",
                  fontWeight: 500,
                  flexShrink: 0,
                }}
              >
                {f.value}
              </span>
            ))}

            {/* Bool flags */}
            {boolFlags.map((f) => (
              <span
                key={f.key}
                style={{
                  fontSize: 10,
                  padding: "1px 7px",
                  borderRadius: 10,
                  background: f.value ? "#dcfce7" : "#f3f4f6",
                  color: f.value ? "#166534" : "#6b7280",
                  fontWeight: 500,
                  flexShrink: 0,
                }}
              >
                {f.key}
              </span>
            ))}
          </div>

          {/* Subtitle */}
          {subtitle && (
            <div
              style={{
                fontSize: 12,
                color: "var(--text-secondary, #6b7280)",
                marginTop: 3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: expanded ? "normal" : "nowrap",
                lineHeight: "1.4",
              }}
            >
              {subtitle}
            </div>
          )}

          {/* Tag badges (when collapsed) */}
          {!expanded && tagFields.length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
              {tagFields[0].values.slice(0, 5).map((v) => (
                <span
                  key={v}
                  style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: "color-mix(in srgb, var(--accent-primary, #3b82f6) 8%, transparent)",
                    color: "var(--accent-primary, #3b82f6)",
                    fontWeight: 500,
                  }}
                >
                  {v}
                </span>
              ))}
              {tagFields[0].values.length > 5 && (
                <span style={{ fontSize: 10, color: "var(--text-tertiary)", padding: "2px 0" }}>
                  +{tagFields[0].values.length - 5} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right side: reorder + expand */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          {!disabled && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                disabled={index === 0}
                style={{
                  width: 24, height: 24, borderRadius: 6, border: "none",
                  background: "none", cursor: index === 0 ? "default" : "pointer",
                  opacity: index === 0 ? 0.25 : 0.5, fontSize: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--text-secondary, #6b7280)",
                }}
                title="Move up"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                disabled={index === total - 1}
                style={{
                  width: 24, height: 24, borderRadius: 6, border: "none",
                  background: "none", cursor: index === total - 1 ? "default" : "pointer",
                  opacity: index === total - 1 ? 0.25 : 0.5, fontSize: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--text-secondary, #6b7280)",
                }}
                title="Move down"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </>
          )}
          <div
            style={{
              width: 24, height: 24, borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--text-tertiary, #9ca3af)", fontSize: 12,
              transition: "transform 0.2s",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded edit panel */}
      {expanded && (
        <div
          style={{
            borderTop: "1px solid var(--border-default, #e5e7eb)",
            background: "var(--surface-secondary, #f9fafb)",
          }}
        >
          {/* All fields */}
          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 2 }}>
            {Object.entries(item).map(([key, val]) => (
              <ConfigField
                key={key}
                fieldKey={key}
                value={val}
                onChange={(newVal) => onUpdate(key, newVal)}
                disabled={disabled}
                depth={1}
              />
            ))}
          </div>

          {/* Footer with field count + remove */}
          <div
            style={{
              padding: "8px 14px",
              borderTop: "1px solid var(--border-default, #e5e7eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 11, color: "var(--text-tertiary, #9ca3af)" }}>
              {fieldCount} field{fieldCount !== 1 ? "s" : ""}
            </span>
            {!disabled && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  border: "1px solid #fca5a5",
                  background: "#fef2f2",
                  fontSize: 11,
                  color: "#dc2626",
                  cursor: "pointer",
                  fontWeight: 500,
                  transition: "all 0.15s",
                }}
              >
                Remove Step
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
