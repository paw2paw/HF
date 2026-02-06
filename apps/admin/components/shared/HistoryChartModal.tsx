/**
 * History Chart Modal
 * Shows detailed history in a larger, nice-looking chart when clicking sparkline
 */

"use client";

import React, { useEffect } from "react";

export interface HistoryChartModalProps {
  /** Historical values (0-1), sorted oldest to newest */
  history: number[];
  /** Labels for each history point */
  historyLabels?: string[];
  /** Color for the chart */
  color: string;
  /** Label for the parameter */
  label: string;
  /** Close handler */
  onClose: () => void;
}

export function HistoryChartModal({
  history,
  historyLabels,
  color,
  label,
  onClose,
}: HistoryChartModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Calculate stats
  const min = Math.min(...history);
  const max = Math.max(...history);
  const avg = history.reduce((sum, v) => sum + v, 0) / history.length;
  const latest = history[history.length - 1];
  const trend =
    history.length >= 2
      ? history[history.length - 1] - history[history.length - 2]
      : 0;

  // Chart dimensions
  const chartW = 640;
  const chartH = 320;
  const padX = 40;
  const padY = 20;
  const plotW = chartW - padX * 2;
  const plotH = chartH - padY * 2;

  // Build chart data
  const points = history
    .map((val, i) => {
      const x = padX + (i / Math.max(1, history.length - 1)) * plotW;
      const y = padY + (1 - val) * plotH;
      return { x, y, value: val, index: i };
    });

  // Build area path
  const areaPath =
    history.length > 0
      ? [
          `M ${padX},${padY + plotH}`,
          ...points.map((p) => `L ${p.x},${p.y}`),
          `L ${points[points.length - 1].x},${padY + plotH}`,
          "Z",
        ].join(" ")
      : "";

  // Build line path
  const linePath =
    points.length > 0
      ? `M ${points.map((p) => `${p.x},${p.y}`).join(" L ")}`
      : "";

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface-primary)",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 24px 48px rgba(0,0,0,0.3)",
          border: "1px solid var(--border-default)",
          maxWidth: "90vw",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 8,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
            }}
          >
            {history.length} measurement{history.length !== 1 ? "s" : ""} over time
          </div>
        </div>

        {/* Stats Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <StatCard label="Latest" value={latest} color={color} />
          <StatCard label="Average" value={avg} color="var(--text-secondary)" />
          <StatCard label="Minimum" value={min} color="var(--status-error-text)" />
          <StatCard label="Maximum" value={max} color="var(--status-success-text)" />
          <StatCard
            label="Trend"
            value={trend}
            color={
              trend > 0
                ? "var(--status-success-text)"
                : trend < 0
                ? "var(--status-error-text)"
                : "var(--text-secondary)"
            }
            suffix={trend > 0 ? " ↑" : trend < 0 ? " ↓" : " →"}
            showSign
          />
        </div>

        {/* Chart */}
        <div
          style={{
            background: "var(--surface-secondary)",
            borderRadius: 12,
            padding: 24,
            border: "1px solid var(--border-default)",
          }}
        >
          <svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
            {/* Y-axis grid lines */}
            {yTicks.map((tick) => {
              const y = padY + (1 - tick) * plotH;
              return (
                <g key={tick}>
                  <line
                    x1={padX}
                    y1={y}
                    x2={padX + plotW}
                    y2={y}
                    stroke={
                      tick === 0.5
                        ? "var(--border-default)"
                        : "var(--border-subtle)"
                    }
                    strokeWidth={tick === 0.5 ? 1.5 : 1}
                    strokeDasharray={tick === 0.5 ? "4,4" : "2,2"}
                    opacity={0.3}
                  />
                  <text
                    x={padX - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize={11}
                    fill="var(--text-muted)"
                    fontFamily="ui-monospace, monospace"
                  >
                    {(tick * 100).toFixed(0)}
                  </text>
                </g>
              );
            })}

            {/* Area fill */}
            {areaPath && <path d={areaPath} fill={color} opacity={0.12} />}

            {/* Line */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data points */}
            {points.map((point, i) => (
              <g key={i}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={4}
                  fill={color}
                  stroke="var(--surface-primary)"
                  strokeWidth={2}
                />
                {/* Label on hover */}
                <title>
                  {historyLabels?.[i] || `Point ${i + 1}`}
                  {"\n"}
                  Value: {(point.value * 100).toFixed(0)}%
                </title>
              </g>
            ))}

            {/* X-axis labels (show first, middle, last if we have labels) */}
            {historyLabels && historyLabels.length > 0 && (
              <>
                {[0, Math.floor(history.length / 2), history.length - 1]
                  .filter((idx, i, arr) => arr.indexOf(idx) === i) // Remove duplicates
                  .map((idx) => {
                    const point = points[idx];
                    if (!point) return null;
                    return (
                      <text
                        key={idx}
                        x={point.x}
                        y={chartH - 5}
                        textAnchor="middle"
                        fontSize={10}
                        fill="var(--text-muted)"
                      >
                        {historyLabels[idx]}
                      </text>
                    );
                  })}
              </>
            )}
          </svg>
        </div>

        {/* Close button */}
        <div style={{ marginTop: 24, textAlign: "right" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 24px",
              background: color,
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.8";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  suffix = "",
  showSign = false,
}: {
  label: string;
  value: number;
  color: string;
  suffix?: string;
  showSign?: boolean;
}) {
  const displayValue = showSign && value > 0 ? `+${(value * 100).toFixed(0)}` : `${(value * 100).toFixed(0)}`;

  return (
    <div
      style={{
        background: "var(--surface-secondary)",
        borderRadius: 8,
        padding: 12,
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          marginBottom: 4,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color,
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {displayValue}
        {suffix}
      </div>
    </div>
  );
}
