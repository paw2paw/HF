"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

interface ParameterConfig {
  parameterId: string;
  name: string;
  domainGroup: string;
  enabled: boolean;
  weight: number;
}

interface CompactEqualizerProps {
  onConfigChange?: (params: ParameterConfig[]) => void;
  agentId?: string;
}

// Color schemes for domain groups
const domainColors: Record<string, string> = {
  "Communication Style": "#3b82f6",
  "Emotional Intelligence": "#a855f7",
  "Cognitive Style": "#10b981",
  "Social Dynamics": "#f59e0b",
  "Behavioral Patterns": "#ec4899",
  "Decision Making": "#6366f1",
  default: "#6b7280",
};

function getDomainColor(domain: string): string {
  return domainColors[domain] || domainColors.default;
}

// Vertical fader component for compact EQ
function CompactFader({
  value,
  onChange,
  color,
  disabled,
  name,
  enabled,
  onToggle,
}: {
  value: number;
  onChange: (v: number) => void;
  color: string;
  disabled?: boolean;
  name: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  const percentage = (value / 2) * 100;
  const displayName = name.length > 8 ? name.slice(0, 6) + ".." : name;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !enabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const newValue = 2 * (1 - clickY / rect.height);
    onChange(Math.max(0, Math.min(2, Math.round(newValue * 10) / 10)));
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        minWidth: 36,
        opacity: enabled ? 1 : 0.4,
      }}
    >
      {/* Enable checkbox */}
      <button
        onClick={onToggle}
        style={{
          width: 12,
          height: 12,
          borderRadius: 2,
          border: `1.5px solid ${enabled ? color : "#d1d5db"}`,
          background: enabled ? color : "transparent",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        {enabled && (
          <svg width="6" height="6" viewBox="0 0 20 20" fill="white">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {/* Value */}
      <span
        style={{
          fontSize: 8,
          color: value === 1 ? "#9ca3af" : "#374151",
          fontWeight: value === 1 ? 400 : 600,
        }}
      >
        {value.toFixed(1)}
      </span>

      {/* Fader track */}
      <div
        onClick={handleClick}
        style={{
          width: 8,
          height: 50,
          background: "#e5e7eb",
          borderRadius: 4,
          position: "relative",
          cursor: disabled || !enabled ? "not-allowed" : "pointer",
        }}
      >
        {/* Fill bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: `${percentage}%`,
            background: `linear-gradient(to top, ${color}, ${color}cc)`,
            borderRadius: 4,
            transition: "height 0.1s ease",
          }}
        />
        {/* Center line */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: -2,
            right: -2,
            height: 1,
            background: "#d1d5db",
          }}
        />
        {/* Knob */}
        <div
          style={{
            position: "absolute",
            bottom: `${percentage}%`,
            left: "50%",
            transform: "translate(-50%, 50%)",
            width: 14,
            height: 8,
            background: "#fff",
            border: `1.5px solid ${color}`,
            borderRadius: 2,
            boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
          }}
        />
      </div>

      {/* Name */}
      <span
        style={{
          fontSize: 7,
          color: enabled ? "#374151" : "#9ca3af",
          textAlign: "center",
          maxWidth: 36,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={name}
      >
        {displayName}
      </span>
    </div>
  );
}

export function CompactEqualizer({ onConfigChange, agentId }: CompactEqualizerProps) {
  const [parameters, setParameters] = useState<ParameterConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch parameters
  useEffect(() => {
    fetch("/api/parameters?range=[0,99]")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const params: ParameterConfig[] = data.map((p: any) => ({
            parameterId: p.parameterId,
            name: p.name,
            domainGroup: p.domainGroup || "Other",
            enabled: true,
            weight: 1.0,
          }));
          setParameters(params);
        } else {
          setError("Failed to load parameters");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Group by domain
  const domainGroups = useMemo(() => {
    const groups: Record<string, ParameterConfig[]> = {};
    for (const param of parameters) {
      const domain = param.domainGroup;
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(param);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [parameters]);

  // Handle weight change
  const handleWeightChange = useCallback(
    (parameterId: string, weight: number) => {
      const updated = parameters.map((p) =>
        p.parameterId === parameterId ? { ...p, weight } : p
      );
      setParameters(updated);
      onConfigChange?.(updated);
    },
    [parameters, onConfigChange]
  );

  // Handle single param toggle
  const handleToggleParam = useCallback(
    (parameterId: string) => {
      const updated = parameters.map((p) =>
        p.parameterId === parameterId ? { ...p, enabled: !p.enabled } : p
      );
      setParameters(updated);
      onConfigChange?.(updated);
    },
    [parameters, onConfigChange]
  );

  // Handle domain toggle
  const handleDomainToggle = useCallback(
    (domain: string) => {
      const domainParams = parameters.filter((p) => p.domainGroup === domain);
      const allEnabled = domainParams.every((p) => p.enabled);
      const updated = parameters.map((p) =>
        p.domainGroup === domain ? { ...p, enabled: !allEnabled } : p
      );
      setParameters(updated);
      onConfigChange?.(updated);
    },
    [parameters, onConfigChange]
  );

  // Reset all
  const handleReset = useCallback(() => {
    const reset = parameters.map((p) => ({ ...p, weight: 1.0, enabled: true }));
    setParameters(reset);
    onConfigChange?.(reset);
  }, [parameters, onConfigChange]);

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: "center", color: "#6b7280", fontSize: 12 }}>
        Loading parameters...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16, color: "#dc2626", fontSize: 12 }}>
        {error}
      </div>
    );
  }

  const modifiedCount = parameters.filter((p) => p.weight !== 1.0 || !p.enabled).length;

  return (
    <div
      style={{
        background: "#f9fafb",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 12px",
          background: "linear-gradient(135deg, #374151 0%, #4b5563 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>
            Quick Equalizer
          </div>
          <div style={{ fontSize: 10, color: "#9ca3af" }}>
            {parameters.filter((p) => p.enabled).length}/{parameters.length} enabled
            {modifiedCount > 0 && ` • ${modifiedCount} modified`}
          </div>
        </div>
        <button
          onClick={handleReset}
          style={{
            padding: "4px 8px",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 4,
            color: "#fff",
            fontSize: 10,
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      </div>

      {/* EQ Faders by Domain - Horizontal layout */}
      <div style={{ padding: 12 }}>
        {domainGroups.map(([domain, params]) => {
          const color = getDomainColor(domain);
          const enabledCount = params.filter((p) => p.enabled).length;

          return (
            <div key={domain} style={{ marginBottom: 16 }}>
              {/* Domain header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 6,
                  paddingBottom: 4,
                  borderBottom: `1px solid ${color}33`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                  }}
                  onClick={() => handleDomainToggle(domain)}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: color,
                    }}
                  />
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#374151" }}>
                    {domain}
                  </span>
                  <span style={{ fontSize: 9, color: "#9ca3af" }}>
                    {enabledCount}/{params.length}
                  </span>
                </div>
              </div>

              {/* Parameter faders in a horizontal row */}
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  flexWrap: "nowrap",
                  overflowX: "auto",
                  paddingBottom: 4,
                }}
              >
                {params.slice(0, 8).map((param) => (
                  <CompactFader
                    key={param.parameterId}
                    value={param.weight}
                    onChange={(v) => handleWeightChange(param.parameterId, v)}
                    color={color}
                    disabled={false}
                    name={param.name}
                    enabled={param.enabled}
                    onToggle={() => handleToggleParam(param.parameterId)}
                  />
                ))}
                {params.length > 8 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      color: "#6b7280",
                      padding: "0 8px",
                      minWidth: 40,
                    }}
                  >
                    +{params.length - 8}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer with link to full EQ */}
      <div
        style={{
          padding: "8px 12px",
          borderTop: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 10, color: "#6b7280" }}>
          Quick view • Click domain to toggle
        </span>
      </div>
    </div>
  );
}

export default CompactEqualizer;
