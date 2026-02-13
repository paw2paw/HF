/**
 * Shared Vertical Slider Component
 * Used across the app for consistent LED slider visualization
 * Based on the PlaybookBuilder design
 */

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Sparkline } from "./Sparkline";

export interface VerticalSliderProps {
  /** Current value (0-1) */
  value: number;
  /** Target value to compare against (0-1), shown as marker */
  targetValue?: number;
  /** Secondary value (0-1), shown as right bar */
  secondaryValue?: number;
  /** Base/default value (0-1) before adjustments — shown as a dashed marker when value differs */
  baseValue?: number;
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
  /** Historical measurement values (0-1), sorted oldest to newest */
  historyPoints?: number[];
  /** Whether to show sparkline below the slider */
  showSparkline?: boolean;
  /** Labels for sparkline history points (e.g., call dates) */
  sparklineLabels?: string[];
}

export function VerticalSlider({
  value,
  targetValue,
  secondaryValue,
  baseValue,
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
  historyPoints = [],
  showSparkline = true,
  sparklineLabels,
}: VerticalSliderProps) {
  const ticks = [0, 25, 50, 75, 100];
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Determine if we should show as active/modified
  const isHighlighted = isModified || isActive || isDragging;
  const activeColor = isModified ? "#fbbf24" : color.primary;
  const glowColor = isModified ? "#f59e0b" : color.glow;

  // Helper: create alpha variant of a color that works with both hex and CSS variables
  // Uses color-mix() which handles var() references correctly
  const withAlpha = (c: string, pct: number) =>
    `color-mix(in srgb, ${c} ${pct}%, transparent)`;

  // Calculate value from Y position within track
  const calculateValueFromY = useCallback((clientY: number) => {
    if (!trackRef.current || !onChange) return;
    const rect = trackRef.current.getBoundingClientRect();
    // Invert: top of track = 100%, bottom = 0%
    const relativeY = rect.bottom - clientY;
    const percentage = Math.max(0, Math.min(100, (relativeY / rect.height) * 100));
    // Snap to 5% increments
    const snapped = Math.round(percentage / 5) * 5;
    onChange(snapped / 100);
  }, [onChange]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!editable || !onChange) return;
    e.preventDefault();
    setIsDragging(true);
    calculateValueFromY(e.clientY);
  }, [editable, onChange, calculateValueFromY]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!editable || !onChange) return;
    setIsDragging(true);
    calculateValueFromY(e.touches[0].clientY);
  }, [editable, onChange, calculateValueFromY]);

  // Global mouse/touch move and up handlers
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      calculateValueFromY(e.clientY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      calculateValueFromY(e.touches[0].clientY);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, calculateValueFromY]);

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
          color: isHighlighted ? activeColor : "var(--slider-value-text)",
          marginBottom: 6,
          fontFamily: "ui-monospace, monospace",
          textShadow: isHighlighted ? `0 0 8px ${withAlpha(glowColor, 25)}` : "none",
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
                    color: "var(--slider-gauge-text)",
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
                    background: tick === 50 ? "var(--slider-gauge-line-mid)" : "var(--slider-gauge-line)",
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Vertical slider track */}
        <div
          ref={trackRef}
          onClick={onClick}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          title={tooltip}
          style={{
            position: "relative",
            width: secondaryValue !== undefined ? width : 24,
            height,
            background: "linear-gradient(180deg, var(--slider-track-bg-start) 0%, var(--slider-track-bg-end) 100%)",
            borderRadius: 4,
            border: (isActive || isDragging) ? `2px solid ${activeColor}` : "1px solid var(--slider-border)",
            boxShadow: (isActive || isDragging)
              ? `0 0 12px ${withAlpha(glowColor, 25)}, inset 0 2px 4px rgba(0,0,0,0.2)`
              : "inset 0 2px 4px rgba(0,0,0,0.1)",
            overflow: "hidden",
            cursor: editable ? (isDragging ? "grabbing" : "grab") : (onClick ? "pointer" : "default"),
            transition: isDragging ? "none" : "border-color 0.2s, box-shadow 0.2s",
            userSelect: "none",
            touchAction: editable ? "none" : "auto",
          }}
        >
          {/* 50% midpoint reference line */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: "50%",
              height: 1,
              background: "var(--slider-gauge-line-mid)",
              zIndex: 1,
              pointerEvents: "none",
            }}
          />

          {/* Primary value bar */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 2,
              right: secondaryValue !== undefined ? "50%" : 2,
              height: `${Math.max(2, value * 100)}%`,
              background: isHighlighted
                ? `linear-gradient(180deg, ${activeColor} 0%, ${withAlpha(glowColor, 60)} 100%)`
                : "linear-gradient(180deg, var(--slider-bar-default-start) 0%, var(--slider-bar-default-end) 100%)",
              borderRadius: "2px",
              transition: isDragging ? "none" : "height 0.1s ease-out",
              zIndex: 2,
              boxShadow: isHighlighted ? `0 0 12px ${withAlpha(glowColor, 38)}` : "none",
              pointerEvents: "none",
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
                background: `linear-gradient(180deg, ${color.primary} 0%, ${withAlpha(color.glow, 60)} 100%)`,
                borderRadius: "2px",
                transition: "height 0.1s ease-out",
                zIndex: 2,
                opacity: 0.85,
                pointerEvents: "none",
              }}
            />
          )}

          {/* History measurement notches (right-side only so they don't look like reference lines) */}
          {historyPoints.length > 1 && historyPoints.map((point, i) => (
            <div
              key={`history-${i}`}
              style={{
                position: "absolute",
                left: "auto",
                right: 0,
                width: 6,
                bottom: `${Math.max(1, Math.min(99, point * 100))}%`,
                height: 2,
                background: color.primary,
                borderRadius: "1px 0 0 1px",
                opacity: 0.2 + (i / (historyPoints.length - 1)) * 0.6,
                zIndex: 3,
                pointerEvents: "none",
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
                background: "var(--slider-target-marker)",
                borderRadius: 1,
                zIndex: 4,
                pointerEvents: "none",
              }}
            />
          )}

          {/* Base value marker — dashed line showing the original/system value before adjustments */}
          {baseValue !== undefined && Math.abs(baseValue - value) > 0.01 && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: `${baseValue * 100}%`,
                height: 0,
                borderTop: "2px dashed var(--text-placeholder)",
                opacity: 0.6,
                zIndex: 4,
                pointerEvents: "none",
              }}
              title={`Base: ${(baseValue * 100).toFixed(0)}%`}
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
            color: "var(--slider-label-text)",
            textAlign: "center",
            maxWidth: width + 20,
            wordBreak: "break-word",
            lineHeight: 1.2,
          }}
        >
          {label}
        </div>
      )}

      {/* Sparkline */}
      {showSparkline && historyPoints.length >= 2 && (
        <div style={{ marginTop: 4 }}>
          <Sparkline
            history={historyPoints}
            color={color.primary}
            width={width}
            height={24}
            label={label}
            historyLabels={sparklineLabels}
          />
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
        background: "linear-gradient(180deg, var(--surface-secondary) 0%, var(--surface-primary) 100%)",
        borderRadius: 16,
        padding: 20,
        border: "1px solid var(--border-default)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.03)",
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
          borderBottom: "1px solid var(--border-default)",
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
            color: "var(--text-primary)",
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
