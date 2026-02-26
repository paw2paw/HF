"use client";

import Link from "next/link";
import type { DiffStudent } from "@/app/api/educator/classrooms/[id]/differentiation/route";
import type { TriageCategory, Momentum } from "@/lib/caller-utils";
import { AdaptationBar } from "./AdaptationBar";

// ─── Triage chip ──────────────────────────────────────────────────────────────

const TRIAGE_CONFIG: Record<TriageCategory, { label: string; cls: string }> = {
  attention: { label: "Needs attention", cls: "diff-triage-attention" },
  advancing: { label: "Advancing", cls: "diff-triage-advancing" },
  active:    { label: "Active",    cls: "diff-triage-active" },
  inactive:  { label: "Inactive",  cls: "diff-triage-inactive" },
  new:       { label: "New",       cls: "diff-triage-new" },
};

// ─── Momentum arrow ───────────────────────────────────────────────────────────

const MOMENTUM_ARROW: Record<Momentum, string> = {
  accelerating: "↗",
  steady:       "→",
  slowing:      "↘",
  new:          "·",
};

// ─── Mastery dots (5) ─────────────────────────────────────────────────────────

function MasteryDots({ mastery }: { mastery: number | null }) {
  const filled = mastery === null ? 0 : Math.round(mastery * 5);
  return (
    <div className="diff-mastery-dots" title={mastery !== null ? `${Math.round(mastery * 100)}% mastery` : "No data"}>
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className={`diff-mastery-dot${i < filled ? " diff-mastery-dot-filled" : ""}`}
        />
      ))}
    </div>
  );
}

// ─── Inline expanded panel (Level 2) ─────────────────────────────────────────

function ExpandedPanel({ student }: { student: DiffStudent }) {
  const { targets, pacePreference, keyMemories, id } = student;
  const hasAnyTarget = Object.values(targets).some((v) => v !== null);

  return (
    <div className="diff-student-expand">
      {/* Meta: pace */}
      <div className="diff-expand-meta">
        <span className="diff-expand-meta-item">
          <span className="diff-expand-meta-label">Pace:</span>
          {pacePreference ? pacePreference.replace("_", " ") : "not yet measured"}
        </span>
        <span className="diff-expand-meta-item">
          <span className="diff-expand-meta-label">Calls:</span>
          {student.totalCalls}
        </span>
      </div>

      {/* Adaptation targets */}
      {hasAnyTarget ? (
        <div className="diff-targets-grid">
          <AdaptationBar label="Scaffolding"   value={targets.scaffolding} />
          <AdaptationBar label="Challenge"     value={targets.challengeLevel} />
          <AdaptationBar label="Examples"      value={targets.exampleRichness} />
          <AdaptationBar label="Density"       value={targets.conceptDensity} />
          <AdaptationBar label="Socratic Q."   value={targets.socratiicQuestioning} />
          <AdaptationBar label="Explanation"   value={targets.explanationDepth} />
        </div>
      ) : (
        <p className="diff-target-no-data" style={{ marginBottom: 12 }}>
          Adaptation targets appear after the first session is processed.
        </p>
      )}

      {/* Key memories */}
      {keyMemories.length > 0 && (
        <div className="diff-memories">
          {keyMemories.map((m, i) => (
            <div key={i} className="diff-memory-item">
              <span className="diff-memory-bullet">◆</span>{m}
            </div>
          ))}
        </div>
      )}

      <Link href={`/x/educator/students/${id}`} className="diff-profile-link">
        Full Profile →
      </Link>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  student: DiffStudent;
  isExpanded: boolean;
  onToggle: (id: string) => void;
};

export function StudentDiffRow({ student, isExpanded, onToggle }: Props) {
  const triageCfg = TRIAGE_CONFIG[student.triage];
  const momentumArrow = MOMENTUM_ARROW[student.momentum];

  return (
    <div className="diff-student-row">
      {/* Collapsed summary row */}
      <div
        className="diff-student-summary"
        onClick={() => onToggle(student.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onToggle(student.id)}
        aria-expanded={isExpanded}
      >
        <span className="diff-student-name">{student.name ?? "Unnamed"}</span>
        <MasteryDots mastery={student.mastery} />
        <span className={`diff-triage-chip ${triageCfg.cls}`}>
          {triageCfg.label}
        </span>
        <span className="diff-momentum">{momentumArrow}</span>
        <span className="diff-diagnostic">{student.diagnostic}</span>
        <span className={`diff-expand-toggle${isExpanded ? " diff-expand-toggle-open" : ""}`}>▶</span>
      </div>

      {/* Expanded detail panel */}
      {isExpanded && <ExpandedPanel student={student} />}
    </div>
  );
}
