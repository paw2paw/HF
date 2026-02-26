"use client";

/** Labelled progress bar for a single BEH adaptation target (0.0–1.0). */

type AdaptationBarProps = {
  label: string;
  value: number | null;
};

function toLabel(v: number): string {
  if (v >= 0.75) return "High";
  if (v >= 0.45) return "Mid";
  return "Low";
}

export function AdaptationBar({ label, value }: AdaptationBarProps) {
  return (
    <div className="diff-target-row">
      <span className="diff-target-label">{label}</span>
      {value === null ? (
        <span className="diff-target-no-data">—</span>
      ) : (
        <>
          <div className="diff-target-bar-bg">
            {/* width is data-driven — the one accepted exception to no-inline-styles */}
            <div
              className="diff-target-bar-fill"
              style={{ width: `${Math.round(value * 100)}%` }}
            />
          </div>
          <span className="diff-target-value">{toLabel(value)}</span>
        </>
      )}
    </div>
  );
}
