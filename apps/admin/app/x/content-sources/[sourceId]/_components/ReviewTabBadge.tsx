"use client";

export function ReviewTabBadge({ reviewed, total }: { reviewed: number; total: number }) {
  if (total === 0) return null;
  const color =
    reviewed === total
      ? "var(--status-success-text, #16a34a)"
      : reviewed > 0
        ? "var(--status-warning-text)"
        : "var(--text-muted)";
  return (
    <span style={{ fontSize: 11, color, fontWeight: 600, marginLeft: 4 }}>
      {reviewed}/{total}
    </span>
  );
}
