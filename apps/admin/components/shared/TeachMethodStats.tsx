"use client";

import { TEACH_METHOD_CONFIG } from "@/lib/content-trust/resolve-config";

type MethodStat = {
  teachMethod: string;
  count: number;
};

type TeachMethodStatsProps = {
  methods: MethodStat[];
  total: number;
  /** Smaller chip variant for source pages */
  compact?: boolean;
};

/**
 * Horizontal row of stat chips showing TP counts per teachMethod.
 * Used on Course detail (Overview tab) and Source detail pages.
 */
export function TeachMethodStats({
  methods,
  total,
  compact,
}: TeachMethodStatsProps) {
  if (!methods || methods.length === 0 || total === 0) return null;

  const visible = methods.filter((m) => m.count > 0);
  if (visible.length === 0) return null;

  return (
    <div className={`hf-flex hf-gap-${compact ? "sm" : "md"} hf-flex-wrap`}>
      {visible.map((m) => {
        const cfg =
          TEACH_METHOD_CONFIG[
            m.teachMethod as keyof typeof TEACH_METHOD_CONFIG
          ];
        const icon = cfg?.icon || "?";
        const label = cfg?.label || m.teachMethod;

        return (
          <div
            key={m.teachMethod}
            className="hf-stat-card hf-stat-card-compact"
          >
            <div className={compact ? "hf-text-sm hf-text-bold" : "hf-stat-value-sm"}>
              {icon} {m.count}
            </div>
            <div className="hf-text-xs hf-text-muted">{label}</div>
          </div>
        );
      })}
    </div>
  );
}
