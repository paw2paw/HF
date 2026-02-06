/**
 * Sparkline Component
 * Small inline chart showing trend over time
 * Clickable to show detailed history chart
 */

import React, { useState } from "react";
import { HistoryChartModal } from "./HistoryChartModal";

export interface SparklineProps {
  /** Historical values (0-1), sorted oldest to newest */
  history: number[];
  /** Color for the sparkline */
  color: string;
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Label for the parameter being visualized */
  label?: string;
  /** Labels for each history point (e.g., call dates) */
  historyLabels?: string[];
  /** Whether to show the sparkline (hidden if < 2 data points) */
  showIfEmpty?: boolean;
}

export function Sparkline({
  history,
  color,
  width = 56,
  height = 24,
  label,
  historyLabels,
  showIfEmpty = false,
}: SparklineProps) {
  const [showModal, setShowModal] = useState(false);

  // Don't render if not enough data
  if (!showIfEmpty && history.length < 2) {
    return null;
  }

  const svgW = width;
  const svgH = height;
  const padX = 2;
  const padY = 3;
  const plotW = svgW - padX * 2;
  const plotH = svgH - padY * 2;

  // Build polyline points
  const points = history
    .map((val, i) => {
      const x = padX + (i / Math.max(1, history.length - 1)) * plotW;
      const y = padY + (1 - val) * plotH;
      return `${x},${y}`;
    })
    .join(" ");

  // Build area path
  const areaPath =
    history.length > 0
      ? [
          `M ${padX},${padY + (1 - history[0]) * plotH}`,
          ...history.map((val, i) => {
            const x = padX + (i / Math.max(1, history.length - 1)) * plotW;
            const y = padY + (1 - val) * plotH;
            return `L ${x},${y}`;
          }),
          `L ${padX + plotW},${padY + plotH}`,
          `L ${padX},${padY + plotH}`,
          "Z",
        ].join(" ")
      : "";

  const lastPoint = history[history.length - 1];
  const lastX = padX + plotW;
  const lastY = padY + (1 - (lastPoint || 0)) * plotH;

  return (
    <>
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{
          display: "block",
          cursor: "pointer",
          transition: "opacity 0.2s",
        }}
        onClick={() => setShowModal(true)}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "0.8";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        aria-label={`Click to view detailed history (${history.length} data points)`}
      >
        {/* Area fill */}
        {areaPath && <path d={areaPath} fill={color} opacity={0.1} />}

        {/* Trend line */}
        {history.length > 1 && (
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.7}
          />
        )}

        {/* Latest value dot */}
        {history.length > 0 && (
          <circle cx={lastX} cy={lastY} r={2} fill={color} opacity={0.9} />
        )}
      </svg>

      {/* Detailed history modal */}
      {showModal && (
        <HistoryChartModal
          history={history}
          historyLabels={historyLabels}
          color={color}
          label={label || "Parameter History"}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
