"use client";

import type { ReadinessLevel } from "@/hooks/useHolographicState";

interface ReadinessBarProps {
  passed: number;
  total: number;
  level: ReadinessLevel;
}

export function ReadinessBar({ passed, total, level }: ReadinessBarProps) {
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <div className="hp-readiness-bar">
      <div className="hp-readiness-track">
        <div
          className="hp-readiness-fill"
          data-level={level}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="hp-readiness-label">
        {passed}/{total}
      </span>
    </div>
  );
}
