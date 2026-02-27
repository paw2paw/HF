"use client";

import { useHolo } from "@/hooks/useHolographicState";
import { ReadinessBar } from "./ReadinessBar";
import type { ReadinessLevel } from "@/hooks/useHolographicState";
import {
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

interface HoloHeaderProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function HoloHeader({ collapsed, onToggleCollapse }: HoloHeaderProps) {
  const { state } = useHolo();

  // Count readiness
  const values = Object.values(state.readinessMap);
  const passed = values.filter((v) => v === "ready").length;
  const total = values.length;
  const level: ReadinessLevel =
    passed === total
      ? "ready"
      : passed >= total * 0.75
        ? "almost"
        : passed > 0
          ? "incomplete"
          : "none";

  const typeLabel = state.institution?.type?.name;
  const subtitle = [typeLabel, state.slug].filter(Boolean).join(" \u00B7 ");

  return (
    <div className="hp-map-header">
      <div className="hp-map-title-row">
        {!collapsed && (
          <span className="hp-map-name">
            {state.name || "Untitled"}
          </span>
        )}
        <button
          className="hp-collapse-btn"
          onClick={onToggleCollapse}
          title={collapsed ? "Expand map" : "Collapse map"}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
      {!collapsed && (
        <>
          {subtitle && <div className="hp-map-subtitle">{subtitle}</div>}
          <ReadinessBar passed={passed} total={total} level={level} />
        </>
      )}
    </div>
  );
}
