"use client";

import { useState, useCallback, useMemo, useRef } from "react";

// Types
export interface ParameterConfig {
  parameterId: string;
  name: string;
  domainGroup: string;
  definition?: string;
  scaleType?: string;
  directionality?: string;
  // EQ values
  enabled: boolean;
  weight: number;
  biasValue: number | null;
  thresholdLow: number | null;
  thresholdHigh: number | null;
  // Defaults for comparison
  defaultWeight?: number;
  defaultEnabled?: boolean;
}

export interface DomainGroup {
  name: string;
  parameters: ParameterConfig[];
  collapsed?: boolean;
}

interface ParameterEqualizerProps {
  parameters: ParameterConfig[];
  onChange?: (parameters: ParameterConfig[]) => void;
  onSave?: (parameters: ParameterConfig[]) => void;
  readOnly?: boolean;
  compact?: boolean;
  showPresets?: boolean;
  title?: string;
}

// Color schemes for domain groups
const domainColors: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  "Communication Style": { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af", accent: "#60a5fa" },
  "Emotional Intelligence": { bg: "#fdf4ff", border: "#a855f7", text: "#6b21a8", accent: "#c084fc" },
  "Cognitive Style": { bg: "#ecfdf5", border: "#10b981", text: "#047857", accent: "#34d399" },
  "Social Dynamics": { bg: "#fef3c7", border: "#f59e0b", text: "#92400e", accent: "#fbbf24" },
  "Behavioral Patterns": { bg: "#fce7f3", border: "#ec4899", text: "#9d174d", accent: "#f472b6" },
  "Decision Making": { bg: "#e0e7ff", border: "#6366f1", text: "#3730a3", accent: "#818cf8" },
  default: { bg: "#f3f4f6", border: "#6b7280", text: "#374151", accent: "#9ca3af" },
};

function getDomainColor(domain: string) {
  return domainColors[domain] || domainColors.default;
}

// Vertical fader component for EQ-style control - compact
function VerticalFader({
  value,
  onChange,
  min,
  max,
  step,
  defaultValue,
  disabled,
  color,
  height = 90,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  defaultValue?: number;
  disabled?: boolean;
  color?: string;
  height?: number;
}) {
  const isDefault = defaultValue !== undefined && Math.abs(value - defaultValue) < 0.001;
  const percentage = ((value - min) / (max - min)) * 100;
  const defaultPercentage = defaultValue !== undefined ? ((defaultValue - min) / (max - min)) * 100 : 50;
  const faderColor = color || "#3b82f6";

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    // Inverted: top = max, bottom = min
    const newPercentage = 1 - clickY / rect.height;
    const newValue = min + newPercentage * (max - min);
    const snapped = Math.round(newValue / step) * step;
    onChange(Math.max(min, Math.min(max, snapped)));
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      {/* Value display */}
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: isDefault ? "#9ca3af" : "#374151",
          minWidth: 28,
          textAlign: "center",
        }}
      >
        {value.toFixed(1)}
      </span>

      {/* Fader track */}
      <div
        onClick={handleClick}
        style={{
          width: 10,
          height,
          background: "#e5e7eb",
          borderRadius: 5,
          position: "relative",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {/* Fill bar from bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: `${percentage}%`,
            background: `linear-gradient(to top, ${faderColor}, ${faderColor}cc)`,
            borderRadius: 5,
            transition: "height 0.1s ease",
          }}
        />

        {/* Default marker line */}
        {defaultValue !== undefined && !isDefault && (
          <div
            style={{
              position: "absolute",
              bottom: `${defaultPercentage}%`,
              left: -2,
              right: -2,
              height: 2,
              background: "#9ca3af",
              transform: "translateY(50%)",
            }}
            title={`Default: ${defaultValue}`}
          />
        )}

        {/* Center line marker (at 1.0 for weight 0-2 scale) */}
        <div
          style={{
            position: "absolute",
            bottom: "50%",
            left: -1,
            right: -1,
            height: 1,
            background: "#d1d5db",
            transform: "translateY(50%)",
          }}
        />

        {/* Knob/handle */}
        <div
          style={{
            position: "absolute",
            bottom: `${percentage}%`,
            left: "50%",
            transform: "translate(-50%, 50%)",
            width: 16,
            height: 8,
            background: "#fff",
            border: `2px solid ${faderColor}`,
            borderRadius: 3,
            boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
          }}
        />
      </div>
    </div>
  );
}

// Single parameter fader column (vertical EQ-style) - compact
function ParameterFader({
  param,
  onChange,
  readOnly,
  color,
  faderHeight = 90,
}: {
  param: ParameterConfig;
  onChange: (updated: ParameterConfig) => void;
  readOnly?: boolean;
  color: string;
  faderHeight?: number;
}) {
  const handleToggle = useCallback(() => {
    if (readOnly) return;
    onChange({ ...param, enabled: !param.enabled });
  }, [param, onChange, readOnly]);

  const handleWeightChange = useCallback(
    (weight: number) => {
      if (readOnly) return;
      onChange({ ...param, weight });
    },
    [param, onChange, readOnly]
  );

  const isModified =
    param.weight !== (param.defaultWeight ?? 1.0) ||
    param.enabled !== (param.defaultEnabled ?? true);

  // Truncate name for display - shorter
  const displayName = param.name.length > 8 ? param.name.slice(0, 6) + ".." : param.name;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "4px 2px",
        width: 40,
        opacity: param.enabled ? 1 : 0.4,
        transition: "opacity 0.15s ease",
      }}
    >
      {/* Enable checkbox at top */}
      <button
        onClick={handleToggle}
        disabled={readOnly}
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          border: `2px solid ${param.enabled ? color : "#d1d5db"}`,
          background: param.enabled ? color : "transparent",
          cursor: readOnly ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginBottom: 4,
          padding: 0,
        }}
      >
        {param.enabled && (
          <svg width="7" height="7" viewBox="0 0 20 20" fill="white">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {/* Vertical fader */}
      <VerticalFader
        value={param.weight}
        onChange={handleWeightChange}
        min={0}
        max={2}
        step={0.1}
        defaultValue={param.defaultWeight ?? 1.0}
        disabled={readOnly || !param.enabled}
        color={color}
        height={faderHeight}
      />

      {/* Modified indicator */}
      {isModified && (
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#f59e0b",
            marginTop: 2,
          }}
          title="Modified"
        />
      )}

      {/* Parameter name */}
      <div
        style={{
          marginTop: isModified ? 2 : 7,
          fontSize: 8,
          fontWeight: 500,
          color: param.enabled ? "#374151" : "#9ca3af",
          textAlign: "center",
          lineHeight: 1.1,
          width: 38,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={param.name}
      >
        {displayName}
      </div>
    </div>
  );
}

// Compact domain group box - fits content, draggable
function DomainGroupBox({
  group,
  onChange,
  readOnly,
  compact,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  group: DomainGroup;
  onChange: (params: ParameterConfig[]) => void;
  readOnly?: boolean;
  compact?: boolean;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}) {
  const [collapsed, setCollapsed] = useState(group.collapsed ?? false);
  const colors = getDomainColor(group.name);

  const enabledCount = group.parameters.filter((p) => p.enabled).length;
  const modifiedCount = group.parameters.filter(
    (p) =>
      p.weight !== (p.defaultWeight ?? 1.0) ||
      p.enabled !== (p.defaultEnabled ?? true) ||
      (p.biasValue !== null && p.biasValue !== 0)
  ).length;

  const handleParamChange = useCallback(
    (updated: ParameterConfig) => {
      const newParams = group.parameters.map((p) =>
        p.parameterId === updated.parameterId ? updated : p
      );
      onChange(newParams);
    },
    [group.parameters, onChange]
  );

  const handleEnableAll = useCallback(() => {
    if (readOnly) return;
    const allEnabled = group.parameters.every((p) => p.enabled);
    const newParams = group.parameters.map((p) => ({ ...p, enabled: !allEnabled }));
    onChange(newParams);
  }, [group.parameters, onChange, readOnly]);

  const handleResetGroup = useCallback(() => {
    if (readOnly) return;
    const newParams = group.parameters.map((p) => ({
      ...p,
      weight: p.defaultWeight ?? 1.0,
      enabled: p.defaultEnabled ?? true,
      biasValue: null,
    }));
    onChange(newParams);
  }, [group.parameters, onChange, readOnly]);

  const faderHeight = compact ? 70 : 90;
  const faderWidth = 44; // Width per fader
  const contentWidth = group.parameters.length * faderWidth + 40; // params + y-axis

  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        borderRadius: 10,
        overflow: "hidden",
        opacity: isDragging ? 0.5 : 1,
        verticalAlign: "top",
        transition: "opacity 0.15s, box-shadow 0.15s",
        boxShadow: isDragging ? `0 4px 12px ${colors.border}44` : "none",
      }}
    >
      {/* Compact header */}
      <div
        style={{
          padding: "6px 10px",
          background: `linear-gradient(135deg, ${colors.border}22, ${colors.border}11)`,
          borderBottom: collapsed ? "none" : `1px solid ${colors.border}33`,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {/* Drag handle - ONLY this is draggable */}
        {!readOnly && (
          <div
            draggable
            onDragStart={onDragStart}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              opacity: 0.6,
              cursor: "grab",
              padding: "4px 2px",
              marginLeft: -4,
              borderRadius: 3,
            }}
            title="Drag to reorder"
            onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseOut={(e) => (e.currentTarget.style.opacity = "0.6")}
          >
            <div style={{ width: 14, height: 2, background: colors.text, borderRadius: 1 }} />
            <div style={{ width: 14, height: 2, background: colors.text, borderRadius: 1 }} />
            <div style={{ width: 14, height: 2, background: colors.text, borderRadius: 1 }} />
          </div>
        )}

        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: colors.border,
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600, fontSize: 12, color: colors.text, whiteSpace: "nowrap" }}>
          {group.name}
        </span>
        <span
          style={{
            fontSize: 10,
            padding: "1px 6px",
            background: colors.border,
            color: "white",
            borderRadius: 8,
            fontWeight: 500,
          }}
        >
          {enabledCount}/{group.parameters.length}
        </span>
        {modifiedCount > 0 && (
          <span
            style={{
              fontSize: 10,
              padding: "1px 6px",
              background: "#f59e0b",
              color: "white",
              borderRadius: 8,
              fontWeight: 500,
            }}
          >
            {modifiedCount}
          </span>
        )}

        {/* Action buttons - compact */}
        {!readOnly && (
          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEnableAll();
              }}
              style={{
                fontSize: 9,
                padding: "2px 6px",
                background: "white",
                border: `1px solid ${colors.border}`,
                borderRadius: 3,
                color: colors.text,
                cursor: "pointer",
              }}
              title="Toggle all parameters"
            >
              All
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleResetGroup();
              }}
              style={{
                fontSize: 9,
                padding: "2px 6px",
                background: "white",
                border: `1px solid ${colors.border}`,
                borderRadius: 3,
                color: colors.text,
                cursor: "pointer",
              }}
              title="Reset to defaults"
            >
              Reset
            </button>
          </div>
        )}

        <svg
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill={colors.text}
          style={{
            transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }}
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {/* Parameters - tight horizontal layout */}
      {!collapsed && (
        <div
          style={{
            padding: "8px 6px",
            display: "flex",
            gap: 0,
            alignItems: "flex-end",
          }}
        >
          {/* Y-axis label */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: faderHeight + 45,
              paddingRight: 4,
              borderRight: `1px solid ${colors.border}33`,
              marginRight: 4,
            }}
          >
            <span style={{ fontSize: 8, color: "#9ca3af" }}>2.0</span>
            <span style={{ fontSize: 8, color: "#6b7280", fontWeight: 500 }}>W</span>
            <span style={{ fontSize: 8, color: "#9ca3af" }}>0.0</span>
          </div>

          {/* Parameter faders in a tight row */}
          {group.parameters.map((param) => (
            <ParameterFader
              key={param.parameterId}
              param={param}
              onChange={handleParamChange}
              readOnly={readOnly}
              color={colors.border}
              faderHeight={faderHeight}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Main equalizer component
export function ParameterEqualizer({
  parameters,
  onChange,
  onSave,
  readOnly = false,
  compact = false,
  showPresets = true,
  title = "Parameter Equalizer",
}: ParameterEqualizerProps) {
  // Track domain group order (for drag reorder)
  const [groupOrder, setGroupOrder] = useState<string[]>([]);
  const [draggedGroup, setDraggedGroup] = useState<string | null>(null);

  // Group parameters by domain
  const domainGroups = useMemo(() => {
    const groups: Record<string, ParameterConfig[]> = {};
    for (const param of parameters) {
      const domain = param.domainGroup || "Other";
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(param);
    }

    // Get all domain names
    const allDomains = Object.keys(groups).sort();

    // Use stored order if available, otherwise default sort
    const orderedDomains =
      groupOrder.length > 0
        ? [...groupOrder.filter((d) => groups[d]), ...allDomains.filter((d) => !groupOrder.includes(d))]
        : allDomains;

    return orderedDomains.map((name) => ({
      name,
      parameters: (groups[name] || []).sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [parameters, groupOrder]);

  // Initialize group order
  useMemo(() => {
    if (groupOrder.length === 0 && domainGroups.length > 0) {
      setGroupOrder(domainGroups.map((g) => g.name));
    }
  }, [domainGroups, groupOrder.length]);

  // Count totals
  const totalParams = parameters.length;
  const enabledParams = parameters.filter((p) => p.enabled).length;
  const modifiedParams = parameters.filter(
    (p) =>
      p.weight !== (p.defaultWeight ?? 1.0) ||
      p.enabled !== (p.defaultEnabled ?? true) ||
      (p.biasValue !== null && p.biasValue !== 0)
  ).length;

  const handleGroupChange = useCallback(
    (groupName: string, newParams: ParameterConfig[]) => {
      if (!onChange) return;
      const updated = parameters.map((p) => {
        const match = newParams.find((np) => np.parameterId === p.parameterId);
        return match || p;
      });
      onChange(updated);
    },
    [parameters, onChange]
  );

  const handleResetAll = useCallback(() => {
    if (!onChange) return;
    const reset = parameters.map((p) => ({
      ...p,
      weight: p.defaultWeight ?? 1.0,
      enabled: p.defaultEnabled ?? true,
      biasValue: null,
    }));
    onChange(reset);
  }, [parameters, onChange]);

  // Drag and drop handlers
  const handleDragStart = useCallback((groupName: string) => {
    setDraggedGroup(groupName);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetGroup: string) => {
    e.preventDefault();
    if (!draggedGroup || draggedGroup === targetGroup) return;
  }, [draggedGroup]);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetGroup: string) => {
      e.preventDefault();
      if (!draggedGroup || draggedGroup === targetGroup) {
        setDraggedGroup(null);
        return;
      }

      setGroupOrder((prev) => {
        const order = prev.length > 0 ? [...prev] : domainGroups.map((g) => g.name);
        const draggedIdx = order.indexOf(draggedGroup);
        const targetIdx = order.indexOf(targetGroup);

        if (draggedIdx === -1 || targetIdx === -1) return prev;

        // Remove dragged and insert at target position
        order.splice(draggedIdx, 1);
        order.splice(targetIdx, 0, draggedGroup);

        return order;
      });

      setDraggedGroup(null);
    },
    [draggedGroup, domainGroups]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedGroup(null);
  }, []);

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          background: "linear-gradient(135deg, #1f2937 0%, #374151 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#fff" }}>
            {title}
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af" }}>
            {enabledParams}/{totalParams} enabled
            {modifiedParams > 0 && ` • ${modifiedParams} modified`}
            {" • Drag to reorder groups"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {!readOnly && (
            <button
              onClick={handleResetAll}
              style={{
                padding: "6px 12px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 5,
                color: "#fff",
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Reset All
            </button>
          )}
          {onSave && !readOnly && (
            <button
              onClick={() => onSave(parameters)}
              style={{
                padding: "6px 12px",
                background: "#10b981",
                border: "none",
                borderRadius: 5,
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Save
            </button>
          )}
        </div>
      </div>

      {/* Presets bar (optional) - more compact */}
      {showPresets && (
        <div
          style={{
            padding: "8px 16px",
            background: "#f9fafb",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 10, color: "#6b7280" }}>Presets:</span>
          <button
            onClick={() => {
              if (!onChange) return;
              onChange(
                parameters.map((p) => ({
                  ...p,
                  enabled: true,
                  weight: 1.0,
                  biasValue: null,
                }))
              );
            }}
            style={{
              padding: "3px 10px",
              background: "#fff",
              border: "1px solid #d1d5db",
              borderRadius: 4,
              fontSize: 10,
              cursor: readOnly ? "default" : "pointer",
              opacity: readOnly ? 0.5 : 1,
            }}
            disabled={readOnly}
          >
            Balanced
          </button>
          <button
            onClick={() => {
              if (!onChange) return;
              onChange(
                parameters.map((p) => ({
                  ...p,
                  enabled: true,
                  weight: p.domainGroup === "Emotional Intelligence" ? 1.5 : 0.8,
                  biasValue: null,
                }))
              );
            }}
            style={{
              padding: "3px 10px",
              background: "#fdf4ff",
              border: "1px solid #e9d5ff",
              borderRadius: 4,
              fontSize: 10,
              color: "#7e22ce",
              cursor: readOnly ? "default" : "pointer",
              opacity: readOnly ? 0.5 : 1,
            }}
            disabled={readOnly}
          >
            Empathy
          </button>
          <button
            onClick={() => {
              if (!onChange) return;
              onChange(
                parameters.map((p) => ({
                  ...p,
                  enabled: true,
                  weight: p.domainGroup === "Cognitive Style" ? 1.5 : 0.8,
                  biasValue: null,
                }))
              );
            }}
            style={{
              padding: "3px 10px",
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: 4,
              fontSize: 10,
              color: "#047857",
              cursor: readOnly ? "default" : "pointer",
              opacity: readOnly ? 0.5 : 1,
            }}
            disabled={readOnly}
          >
            Cognitive
          </button>
        </div>
      )}

      {/* Domain groups - HORIZONTAL FLOW */}
      <div
        style={{
          padding: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "flex-start",
        }}
        onDragEnd={handleDragEnd}
      >
        {domainGroups.map((group) => (
          <DomainGroupBox
            key={group.name}
            group={group}
            onChange={(params) => handleGroupChange(group.name, params)}
            readOnly={readOnly}
            compact={compact}
            isDragging={draggedGroup === group.name}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              handleDragStart(group.name);
            }}
            onDragOver={(e) => handleDragOver(e, group.name)}
            onDrop={(e) => handleDrop(e, group.name)}
          />
        ))}
      </div>
    </div>
  );
}

export default ParameterEqualizer;
