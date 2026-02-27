"use client";

import type { SectionId } from "@/lib/holographic/permissions";
import type { ReadinessLevel } from "@/hooks/useHolographicState";

interface HoloMapCardProps {
  section: SectionId;
  label: string;
  summary: string;
  status: ReadinessLevel;
  active: boolean;
  onClick: () => void;
}

export function HoloMapCard({
  section,
  label,
  summary,
  status,
  active,
  onClick,
}: HoloMapCardProps) {
  const classes = [
    "hp-map-card",
    active && "hp-map-card-active",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={classes}
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      data-section={section}
    >
      <div className="hp-map-card-header">
        <span className="hp-map-card-dot" data-status={status} />
        <span className="hp-map-card-label">{label}</span>
      </div>
      {summary && (
        <div className="hp-map-card-summary">{summary}</div>
      )}
    </button>
  );
}
