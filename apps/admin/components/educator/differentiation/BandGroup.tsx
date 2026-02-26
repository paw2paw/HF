"use client";

import { useState } from "react";
import type { DiffStudent, DiffStudentTargets } from "@/app/api/educator/classrooms/[id]/differentiation/route";
import { StudentDiffRow } from "./StudentDiffRow";

// ─── Band summary: "What they get" chip row ───────────────────────────────────

type TargetEntry = { key: keyof DiffStudentTargets; label: string };

const TARGET_ENTRIES: TargetEntry[] = [
  { key: "scaffolding",          label: "Scaffolding" },
  { key: "challengeLevel",       label: "Challenge" },
  { key: "exampleRichness",      label: "Examples" },
  { key: "conceptDensity",       label: "Density" },
  { key: "socratiicQuestioning", label: "Socratic Q." },
  { key: "explanationDepth",     label: "Explanation" },
];

function computeBandTargetAvg(students: DiffStudent[], key: keyof DiffStudentTargets): number | null {
  const values = students
    .map((s) => s.targets[key])
    .filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function chipLevel(v: number): "high" | "mid" | "low" {
  if (v >= 0.65) return "high";
  if (v >= 0.4) return "mid";
  return "low";
}

function BandSummary({ students }: { students: DiffStudent[] }) {
  const entries = TARGET_ENTRIES
    .map(({ key, label }) => ({ label, avg: computeBandTargetAvg(students, key) }))
    .filter((e) => e.avg !== null) as { label: string; avg: number }[];

  if (entries.length === 0) return null;

  return (
    <div className="diff-band-summary">
      {entries.map(({ label, avg }) => {
        const level = chipLevel(avg);
        const cls =
          level === "high"
            ? "diff-band-target-chip diff-band-target-chip-high"
            : level === "low"
            ? "diff-band-target-chip diff-band-target-chip-low"
            : "diff-band-target-chip";
        return (
          <span key={label} className={cls}>
            {label} {level}
          </span>
        );
      })}
    </div>
  );
}

// ─── Band config map ──────────────────────────────────────────────────────────

type BandConfig = {
  label: string;
  dotColor: string;
  borderCls: string;
};

export const BAND_CONFIGS: Record<string, BandConfig> = {
  // Mastery
  foundation: { label: "Foundation",    dotColor: "var(--status-error-text)",   borderCls: "diff-band-foundation" },
  developing: { label: "Developing",    dotColor: "var(--status-warning-text)", borderCls: "diff-band-developing" },
  advanced:   { label: "Advanced",      dotColor: "var(--status-success-text)", borderCls: "diff-band-advanced" },
  noData:     { label: "Not yet called",dotColor: "var(--text-muted)",          borderCls: "diff-band-noData" },
  // Triage
  attention:  { label: "Needs Attention", dotColor: "var(--status-error-text)",   borderCls: "diff-band-attention" },
  active:     { label: "Active",          dotColor: "var(--status-info-text)",    borderCls: "diff-band-active" },
  advancing:  { label: "Advancing",       dotColor: "var(--status-success-text)", borderCls: "diff-band-advancing" },
  inactive:   { label: "Inactive",        dotColor: "var(--status-warning-text)", borderCls: "diff-band-inactive" },
  new:        { label: "New",             dotColor: "var(--text-muted)",          borderCls: "diff-band-new" },
  // Pace
  fast:         { label: "Fast",         dotColor: "var(--status-success-text)", borderCls: "diff-band-fast" },
  moderate:     { label: "Moderate",     dotColor: "var(--status-info-text)",    borderCls: "diff-band-moderate" },
  slow:         { label: "Slow",         dotColor: "var(--status-warning-text)", borderCls: "diff-band-slow" },
  self_directed:{ label: "Self-directed",dotColor: "var(--accent-secondary)",    borderCls: "diff-band-moderate" },
  unknown:      { label: "Pace unknown", dotColor: "var(--text-muted)",          borderCls: "diff-band-unknown" },
};

// ─── BandGroup ────────────────────────────────────────────────────────────────

type Props = {
  bandKey: string;
  students: DiffStudent[];
  expandedId: string | null;
  onExpand: (id: string | null) => void;
  defaultOpen?: boolean;
};

export function BandGroup({ bandKey, students, expandedId, onExpand, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const cfg = BAND_CONFIGS[bandKey] ?? {
    label: bandKey,
    dotColor: "var(--text-muted)",
    borderCls: "diff-band-noData",
  };

  if (students.length === 0) return null;

  const handleToggleStudent = (id: string) => {
    onExpand(expandedId === id ? null : id);
  };

  return (
    <div className="diff-band">
      {/* Band header */}
      <div
        className={`diff-band-header ${cfg.borderCls}`}
        onClick={() => setOpen((o) => !o)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span
          className="diff-band-dot"
          style={{ background: cfg.dotColor }}
        />
        <span className="diff-band-name">{cfg.label}</span>
        <span className="diff-band-count">· {students.length}</span>
        <span className={`diff-band-chevron${open ? " diff-band-chevron-open" : ""}`}>▶</span>
      </div>

      {/* "What they get" summary — always visible */}
      <BandSummary students={students} />

      {/* Student rows — shown when expanded */}
      {open && (
        <div className="diff-band-students">
          {students.map((s) => (
            <StudentDiffRow
              key={s.id}
              student={s}
              isExpanded={expandedId === s.id}
              onToggle={handleToggleStudent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
