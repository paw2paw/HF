/**
 * Shared Vertical Slider Component
 * Used across the app for consistent LED slider visualization
 * Based on the PlaybookBuilder design
 */

import React from "react";

export interface VerticalSliderProps {
  /** Current value (0-1) */
  value: number;
  /** Target value to compare against (0-1), shown as marker */
  targetValue?: number;
  /** Secondary value (0-1), shown as right bar */
  secondaryValue?: number;
  /** Color configuration */
  color?: {
    primary: string;
    glow: string;
  };
  /** Whether this slider is interactive */
  editable?: boolean;
  /** Change handler for editable sliders */
  onChange?: (value: number) => void;
  /** Whether this slider has been modified */
  isModified?: boolean;
  /** Label to show below slider */
  label?: string;
  /** Tooltip text */
  tooltip?: string;
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Whether to show gauge ticks */
  showGauge?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Whether this slider is in an expanded/active state */
  isActive?: boolean;
}

export function VerticalSlider({
  value,
  targetValue,
  secondaryValue,
  color = { primary: "#a78bfa", glow: "#8b5cf6" },
  editable = false,
  onChange,
  isModified = false,
  label,
  tooltip,
  width = 56,
  height = 140,
  showGauge = true,
  onClick,
  isActive = false,
}: VerticalSliderProps) {
  const ticks = [0, 25, 50, 75, 100];

  // Determine if we should show as active/modified
  const isHighlighted = isModified || isActive;
  const activeColor = isModified ? "#fbbf24" : color.primary;
  const glowColor = isModified ? "#f59e0b" : color.glow;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width,
      }}
    >
      {/* Value display */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: isHighlighted ? activeColor : "#71717a",
          marginBottom: 6,
          fontFamily: "ui-monospace, monospace",
          textShadow: isHighlighted ? `0 0 8px ${glowColor}40` : "none",
        }}
      >
        {(value * 100).toFixed(0)}
      </div>

      {/* Slider container */}
      <div style={{ display: "flex", gap: 4 }}>
        {/* Gauge ticks (left side) */}
        {showGauge && (
          <div
            style={{
              display: "flex",
              flexDirection: "column-reverse",
              justifyContent: "space-between",
              height,
              paddingTop: 2,
              paddingBottom: 2,
            }}
          >
            {ticks.map((tick) => (
              <div key={tick} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <span
                  style={{
                    fontSize: 7,
                    color: "#52525b",
                    width: 14,
                    textAlign: "right",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {tick}
                </span>
                <div
                  style={{
                    width: 4,
                    height: 1,
                    background: tick === 50 ? "#52525b" : "#3f3f46",
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Vertical slider track */}
        <div
          onClick={onClick}
          title={tooltip}
          style={{
            position: "relative",
            width: secondaryValue !== undefined ? width : 24,
            height,
            background: "linear-gradient(180deg, #1f1f23 0%, #18181b 100%)",
            borderRadius: 4,
            border: isActive ? `2px solid ${activeColor}` : "1px solid #27272a",
            boxShadow: isActive
              ? `0 0 12px ${glowColor}40, inset 0 2px 4px rgba(0,0,0,0.5)`
              : "inset 0 2px 4px rgba(0,0,0,0.5)",
            overflow: "hidden",
            cursor: onClick ? "pointer" : editable ? "pointer" : "default",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
        >
          {/* Gauge lines inside track */}
          {ticks.map((tick) => (
            <div
              key={tick}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: `${tick}%`,
                height: 1,
                background: tick === 50 ? "#3f3f46" : "#27272a",
              }}
            />
          ))}

          {/* Primary value bar */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 2,
              right: secondaryValue !== undefined ? "50%" : 2,
              height: `${Math.max(2, value * 100)}%`,
              background: isHighlighted
                ? `linear-gradient(180deg, ${activeColor} 0%, ${glowColor}99 100%)`
                : "linear-gradient(180deg, #52525b 0%, #3f3f46 100%)",
              borderRadius: "2px",
              transition: "height 0.1s ease-out",
              boxShadow: isHighlighted ? `0 0 12px ${glowColor}60` : "none",
            }}
          />

          {/* Secondary value bar (if provided) */}
          {secondaryValue !== undefined && (
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: "50%",
                right: 2,
                height: `${Math.max(2, secondaryValue * 100)}%`,
                background: `linear-gradient(180deg, ${color.primary} 0%, ${color.glow}99 100%)`,
                borderRadius: "2px",
                transition: "height 0.1s ease-out",
                opacity: 0.85,
              }}
            />
          )}

          {/* LED segments overlay */}
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 2,
                right: 2,
                bottom: `${i * 10 + 5}%`,
                height: 1,
                background: "#18181b",
                opacity: 0.5,
              }}
            />
          ))}

          {/* Target marker (if different from value) */}
          {targetValue !== undefined && targetValue !== value && (
            <div
              style={{
                position: "absolute",
                left: -2,
                right: -2,
                bottom: `${targetValue * 100}%`,
                height: 2,
                background: "#71717a",
                borderRadius: 1,
              }}
            />
          )}

          {/* Interactive slider input (invisible) */}
          {editable && onChange && (
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={value * 100}
              onChange={(e) => onChange(parseInt(e.target.value) / 100)}
              style={{
                position: "absolute",
                width: height,
                height: 24,
                transform: "rotate(-90deg)",
                transformOrigin: `${height / 2}px ${height / 2}px`,
                cursor: "pointer",
                opacity: 0,
                left: -(height - 24) / 2,
                top: 0,
              }}
            />
          )}
        </div>
      </div>

      {/* Label */}
      {label && (
        <div
          style={{
            marginTop: 8,
            fontSize: 9,
            color: "#71717a",
            textAlign: "center",
            maxWidth: width + 20,
            wordBreak: "break-word",
            lineHeight: 1.2,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

/**
 * Slider Group Component - Groups sliders with a header
 */
export interface SliderGroupProps {
  title: string;
  color?: { primary: string; glow: string };
  children: React.ReactNode;
}

export function SliderGroup({ title, color = { primary: "#a78bfa", glow: "#8b5cf6" }, children }: SliderGroupProps) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, #18181b 0%, #0f0f11 100%)",
        borderRadius: 16,
        padding: 20,
        border: "1px solid #27272a",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      {/* Group Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
          paddingBottom: 10,
          borderBottom: "1px solid #27272a",
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color.primary,
            boxShadow: `0 0 8px ${color.glow}`,
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#e4e4e7",
            letterSpacing: "0.5px",
          }}
        >
          {title}
        </span>
      </div>

      {/* Sliders */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}
