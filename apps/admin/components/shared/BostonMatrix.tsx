"use client";

import React, { useRef, useCallback, useState, useEffect } from "react";
import type { MatrixAxisDef, MatrixPreset } from "@/lib/domain/agent-tuning";
import { snap5 } from "@/lib/domain/agent-tuning";

// ── Types ──────────────────────────────────────────────

interface BostonMatrixProps {
  xAxis: MatrixAxisDef;
  yAxis: MatrixAxisDef;
  value: { x: number; y: number };
  presets: MatrixPreset[];
  onChange: (pos: { x: number; y: number }) => void;
  activePreset?: string | null;
  disabled?: boolean;
  compact?: boolean;
}

// ── Constants ──────────────────────────────────────────

const GRID_SIZE = 240;
const GRID_SIZE_COMPACT = 180;
const DOT_SIZE = 18;
const PRESET_SIZE = 10;
const PADDING = 28;

// ── Component ──────────────────────────────────────────

export function BostonMatrix({
  xAxis,
  yAxis,
  value,
  presets,
  onChange,
  activePreset,
  disabled = false,
  compact = false,
}: BostonMatrixProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const gridSize = compact ? GRID_SIZE_COMPACT : GRID_SIZE;
  const totalSize = gridSize + PADDING * 2;

  // Convert value (0-1) to pixel position
  const valueToPx = useCallback(
    (v: number, axis: "x" | "y"): number => {
      const clamped = Math.max(0, Math.min(1, v));
      // x: left to right, y: bottom to top (invert for CSS)
      if (axis === "x") return PADDING + clamped * gridSize;
      return PADDING + (1 - clamped) * gridSize;
    },
    [gridSize],
  );

  // Convert pixel position to value (0-1)
  const pxToValue = useCallback(
    (px: number, axis: "x" | "y"): number => {
      const relative = (px - PADDING) / gridSize;
      if (axis === "x") return snap5(Math.max(0, Math.min(1, relative)));
      return snap5(Math.max(0, Math.min(1, 1 - relative)));
    },
    [gridSize],
  );

  const handlePointerEvent = useCallback(
    (e: React.PointerEvent | PointerEvent) => {
      if (disabled) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = pxToValue(e.clientX - rect.left, "x");
      const y = pxToValue(e.clientY - rect.top, "y");
      onChange({ x, y });
    },
    [disabled, pxToValue, onChange],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      setDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      handlePointerEvent(e);
    },
    [disabled, handlePointerEvent],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragging) handlePointerEvent(e);
    },
    [dragging, handlePointerEvent],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  // Grid lines at 0.25, 0.5, 0.75
  const gridLines = compact ? [0.5] : [0.25, 0.5, 0.75];

  const dotX = valueToPx(value.x, "x");
  const dotY = valueToPx(value.y, "y");

  return (
    <div className="hf-matrix-wrapper">
      {/* Matrix grid */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="hf-matrix-grid"
        style={{
          width: totalSize,
          height: totalSize,
          cursor: disabled ? "default" : "crosshair",
        }}
      >
        {/* Background */}
        <div
          className="hf-matrix-bg"
          style={{
            left: PADDING,
            top: PADDING,
            width: gridSize,
            height: gridSize,
          }}
        />

        {/* Grid lines */}
        {gridLines.map((frac) => (
          <React.Fragment key={frac}>
            {/* Vertical */}
            <div
              className="hf-matrix-gridline"
              style={{
                left: PADDING + frac * gridSize,
                top: PADDING,
                width: 1,
                height: gridSize,
                background: frac === 0.5
                  ? "color-mix(in srgb, var(--border-default) 80%, transparent)"
                  : "color-mix(in srgb, var(--border-default) 40%, transparent)",
              }}
            />
            {/* Horizontal */}
            <div
              className="hf-matrix-gridline"
              style={{
                left: PADDING,
                top: PADDING + (1 - frac) * gridSize,
                width: gridSize,
                height: 1,
                background: frac === 0.5
                  ? "color-mix(in srgb, var(--border-default) 80%, transparent)"
                  : "color-mix(in srgb, var(--border-default) 40%, transparent)",
              }}
            />
          </React.Fragment>
        ))}

        {/* Axis labels */}
        {!compact && (
          <>
            {/* X axis */}
            <div
              className="hf-matrix-axis-label"
              style={{ left: PADDING, bottom: 4 }}
            >
              {xAxis.lowLabel}
            </div>
            <div
              className="hf-matrix-axis-label"
              style={{ right: PADDING, bottom: 4, textAlign: "right" }}
            >
              {xAxis.highLabel}
            </div>
            {/* Y axis */}
            <div
              className="hf-matrix-axis-label hf-matrix-axis-label-y"
              style={{ left: 2, top: PADDING }}
            >
              {yAxis.highLabel}
            </div>
            <div
              className="hf-matrix-axis-label hf-matrix-axis-label-y"
              style={{ left: 2, bottom: PADDING }}
            >
              {yAxis.lowLabel}
            </div>
          </>
        )}

        {/* Preset markers */}
        {presets.map((preset) => {
          const px = valueToPx(preset.x, "x");
          const py = valueToPx(preset.y, "y");
          const isActive = activePreset === preset.id;

          return (
            <div
              key={preset.id}
              title={`${preset.name}: ${preset.description}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!disabled) onChange({ x: preset.x, y: preset.y });
              }}
              className="hf-matrix-preset"
              style={{
                left: px - PRESET_SIZE / 2,
                top: py - PRESET_SIZE / 2,
                width: PRESET_SIZE,
                height: PRESET_SIZE,
                background: isActive
                  ? "var(--accent-primary)"
                  : "color-mix(in srgb, var(--text-muted) 40%, transparent)",
                border: isActive
                  ? "2px solid var(--accent-primary)"
                  : "1px solid var(--text-muted)",
                cursor: disabled ? "default" : "pointer",
              }}
            />
          );
        })}

        {/* User dot */}
        <div
          className="hf-matrix-dot"
          style={{
            left: dotX - DOT_SIZE / 2,
            top: dotY - DOT_SIZE / 2,
            width: DOT_SIZE,
            height: DOT_SIZE,
            transition: dragging ? "none" : "all 0.1s ease",
          }}
        />
      </div>

      {/* Preset chips below matrix */}
      <div className="hf-matrix-chips" style={{ maxWidth: totalSize }}>
        {presets.map((preset) => {
          const isActive = activePreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                if (!disabled) onChange({ x: preset.x, y: preset.y });
              }}
              disabled={disabled}
              title={preset.description}
              className={`hf-matrix-chip${isActive ? ' hf-matrix-chip-active' : ''}`}
              style={{ cursor: disabled ? "default" : "pointer" }}
            >
              {preset.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
