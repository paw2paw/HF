"use client";

/**
 * CategoryTreemap — squarified treemap visualization for content category distribution.
 * Extracted from CourseIntelligenceTab for reuse on the dashboard.
 */

import { getCategoryStyle } from "@/lib/content-categories";
import { CONTENT_CATEGORIES } from "@/lib/content-categories";

// ── Squarify layout ──────────────────────────────────

type TreemapRect = { cat: string; count: number; x: number; y: number; w: number; h: number };

function squarify(
  items: Array<{ cat: string; count: number }>,
  width: number,
  height: number,
): TreemapRect[] {
  const total = items.reduce((s, i) => s + i.count, 0);
  if (total === 0 || items.length === 0) return [];

  const areas = items.map((i) => ({ ...i, area: (i.count / total) * width * height }));
  const rects: TreemapRect[] = [];
  let x = 0, y = 0, w = width, h = height;

  function layoutRow(row: typeof areas, rowArea: number, short: number, isHoriz: boolean): void {
    const long = rowArea / short;
    let offset = 0;
    for (const item of row) {
      const size = item.area / long;
      if (isHoriz) {
        rects.push({ cat: item.cat, count: item.count, x, y: y + offset, w: long, h: size });
      } else {
        rects.push({ cat: item.cat, count: item.count, x: x + offset, y, w: size, h: long });
      }
      offset += size;
    }
    if (isHoriz) { x += long; w -= long; }
    else { y += long; h -= long; }
  }

  function worst(row: typeof areas, short: number): number {
    const rowArea = row.reduce((s, i) => s + i.area, 0);
    let max = 0;
    for (const item of row) {
      const long = rowArea / short;
      const size = item.area / long;
      const ratio = Math.max(long / size, size / long);
      if (ratio > max) max = ratio;
    }
    return max;
  }

  let remaining = [...areas];
  while (remaining.length > 0) {
    const short = Math.min(w, h);
    const isHoriz = h <= w;
    const row: typeof areas = [remaining[0]];
    remaining = remaining.slice(1);

    while (remaining.length > 0) {
      const candidate = [...row, remaining[0]];
      if (worst(candidate, short) <= worst(row, short)) {
        row.push(remaining[0]);
        remaining = remaining.slice(1);
      } else {
        break;
      }
    }
    const rowArea = row.reduce((s, i) => s + i.area, 0);
    layoutRow(row, rowArea, short, isHoriz);
  }
  return rects;
}

// ── Component ────────────────────────────────────────

export function CategoryTreemap({
  categoryCounts,
  className,
}: {
  categoryCounts: Record<string, number>;
  className?: string;
}): React.ReactElement | null {
  const total = Object.values(categoryCounts).reduce((s, c) => s + c, 0);
  if (total === 0) return null;

  const entries = Object.entries(categoryCounts)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1]);

  const rects = squarify(
    entries.map(([cat, count]) => ({ cat, count })),
    100,
    100,
  );

  return (
    <div className={`cat-treemap-container${className ? ` ${className}` : ""}`}>
      <div className="cat-treemap">
        {rects.map((r) => {
          const meta = CONTENT_CATEGORIES[r.cat] ?? getCategoryStyle(r.cat);
          const pct = Math.round((r.count / total) * 100);
          const showLabel = r.w > 15 && r.h > 18;
          const showCount = r.w > 10 && r.h > 12;
          return (
            <div
              key={r.cat}
              className="cat-treemap-cell"
              style={{
                left: `${r.x}%`,
                top: `${r.y}%`,
                width: `${r.w}%`,
                height: `${r.h}%`,
                background: meta.color,
              }}
              data-label={`${meta.label}: ${r.count} (${pct}%)`}
            >
              {showLabel && <span className="cat-treemap-label">{meta.label}</span>}
              {showCount && <span className="cat-treemap-count">{r.count}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
