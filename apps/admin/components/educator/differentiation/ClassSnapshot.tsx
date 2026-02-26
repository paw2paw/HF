"use client";

import type { DiffStudent } from "@/app/api/educator/classrooms/[id]/differentiation/route";

type Props = { students: DiffStudent[] };

type DistRow = { label: string; count: number; colorVar: string };

function DistBar({ rows, total }: { rows: DistRow[]; total: number }) {
  if (total === 0) return <span className="diff-target-no-data">No data yet</span>;
  return (
    <>
      {rows.map((r) => (
        <div className="diff-dist-row" key={r.label}>
          <span className="diff-dist-label">{r.label}</span>
          <div className="diff-dist-bar-bg">
            <div
              className="diff-dist-bar-fill"
              style={{
                width: `${Math.round((r.count / total) * 100)}%`,
                background: `var(${r.colorVar})`,
              }}
            />
          </div>
          <span className="diff-dist-count">{r.count}</span>
        </div>
      ))}
    </>
  );
}

export function ClassSnapshot({ students }: Props) {
  const total = students.length;

  // Mastery distribution
  const masteryRows: DistRow[] = [
    {
      label: "Foundation",
      count: students.filter((s) => s.masteryBand === "foundation").length,
      colorVar: "--status-error-text",
    },
    {
      label: "Developing",
      count: students.filter((s) => s.masteryBand === "developing").length,
      colorVar: "--status-warning-text",
    },
    {
      label: "Advanced",
      count: students.filter((s) => s.masteryBand === "advanced").length,
      colorVar: "--status-success-text",
    },
    {
      label: "Not started",
      count: students.filter((s) => s.masteryBand === "noData").length,
      colorVar: "--text-muted",
    },
  ].filter((r) => r.count > 0);

  // Engagement distribution
  const engagementRows: DistRow[] = [
    {
      label: "Needs attention",
      count: students.filter((s) => s.triage === "attention").length,
      colorVar: "--status-error-text",
    },
    {
      label: "Active",
      count: students.filter((s) => s.triage === "active").length,
      colorVar: "--status-info-text",
    },
    {
      label: "Advancing",
      count: students.filter((s) => s.triage === "advancing").length,
      colorVar: "--status-success-text",
    },
    {
      label: "Inactive",
      count: students.filter((s) => s.triage === "inactive").length,
      colorVar: "--status-warning-text",
    },
    {
      label: "New",
      count: students.filter((s) => s.triage === "new").length,
      colorVar: "--text-muted",
    },
  ].filter((r) => r.count > 0);

  // Pace distribution
  const paceRows: DistRow[] = [
    {
      label: "Fast",
      count: students.filter((s) => s.pacePreference === "fast").length,
      colorVar: "--status-success-text",
    },
    {
      label: "Moderate",
      count: students.filter((s) => s.pacePreference === "moderate").length,
      colorVar: "--status-info-text",
    },
    {
      label: "Slow",
      count: students.filter((s) => s.pacePreference === "slow").length,
      colorVar: "--status-warning-text",
    },
    {
      label: "Self-directed",
      count: students.filter((s) => s.pacePreference === "self_directed").length,
      colorVar: "--accent-secondary",
    },
    {
      label: "Not yet known",
      count: students.filter((s) => !s.pacePreference).length,
      colorVar: "--text-muted",
    },
  ].filter((r) => r.count > 0);

  return (
    <div className="diff-snapshot-grid">
      <div className="hf-card-compact diff-snapshot-card">
        <div className="diff-snapshot-title">Mastery Spread</div>
        <DistBar rows={masteryRows} total={total} />
      </div>
      <div className="hf-card-compact diff-snapshot-card">
        <div className="diff-snapshot-title">Engagement</div>
        <DistBar rows={engagementRows} total={total} />
      </div>
      <div className="hf-card-compact diff-snapshot-card">
        <div className="diff-snapshot-title">Pace</div>
        <DistBar rows={paceRows} total={total} />
      </div>
    </div>
  );
}
