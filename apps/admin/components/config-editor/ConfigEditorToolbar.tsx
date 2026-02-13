"use client";

interface ConfigEditorToolbarProps {
  mode: "visual" | "json";
  onModeChange: (mode: "visual" | "json") => void;
  onCollapseAll?: () => void;
}

export function ConfigEditorToolbar({ mode, onModeChange, onCollapseAll }: ConfigEditorToolbarProps) {
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "4px 12px",
    borderRadius: 4,
    border: "none",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: active ? 600 : 400,
    color: active ? "var(--accent-primary, #4f46e5)" : "var(--text-tertiary, #9ca3af)",
    background: active ? "var(--surface-secondary, #f0f0ff)" : "transparent",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", gap: 2, background: "var(--surface-secondary, #f9fafb)", borderRadius: 6, padding: 2 }}>
        <button type="button" onClick={() => onModeChange("visual")} style={tabStyle(mode === "visual")}>
          Visual
        </button>
        <button type="button" onClick={() => onModeChange("json")} style={tabStyle(mode === "json")}>
          JSON
        </button>
      </div>
      {mode === "visual" && onCollapseAll && (
        <button
          type="button"
          onClick={onCollapseAll}
          style={{
            fontSize: 10,
            color: "var(--text-tertiary, #9ca3af)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Collapse all
        </button>
      )}
    </div>
  );
}
