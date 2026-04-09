"use client";

import { Users2 } from "lucide-react";
import { getSessionTypeColor, getSessionTypeLabel } from "@/lib/lesson-plan/session-ui";
import type { SessionEntry, StudentProgress } from "@/lib/lesson-plan/types";

export interface ClassProgressSectionProps {
  entries: SessionEntry[];
  studentProgress: StudentProgress[];
}

export function ClassProgressSection({ entries, studentProgress }: ClassProgressSectionProps) {
  if (studentProgress.length === 0) {
    return (
      <div className="hf-mt-xl">
        <div className="hf-flex hf-items-center hf-gap-sm hf-mb-sm">
          <Users2 size={16} className="hf-text-muted" />
          <span className="hf-section-title hf-mb-0">Class Progress</span>
        </div>
        <p className="hf-text-sm hf-text-muted">
          No students enrolled yet.
        </p>
      </div>
    );
  }

  const sp = studentProgress;
  const total = sp.length;

  return (
    <div className="hf-mt-xl">
      <div className="hf-flex hf-flex-between hf-items-center hf-mb-md">
        <div className="hf-flex hf-items-center hf-gap-sm">
          <Users2 size={16} className="hf-text-muted" />
          <span className="hf-section-title hf-mb-0">Class Progress</span>
        </div>
        <span className="hf-text-xs hf-text-muted">{total} enrolled</span>
      </div>
      <div className="hf-card-compact cd-progress-section">
        {entries.map((entry) => {
          const completed = sp.filter((s) => s.currentSession !== null && s.currentSession > entry.session);
          const active = sp.filter((s) => s.currentSession === entry.session);
          const reached = completed.length + active.length;
          const pct = total > 0 ? Math.round((reached / total) * 100) : 0;
          const allDone = total > 0 && completed.length === total;
          const hasActive = active.length > 0;
          const typeColor = getSessionTypeColor(entry.type);

          return (
            <div key={entry.session} className="cd-progress-row">
              <span className="cd-progress-num hf-text-xs hf-text-muted">{entry.session}</span>
              <span
                className="cd-session-type hf-text-xs"
                style={{ "--session-color": typeColor } as React.CSSProperties}
              >
                {getSessionTypeLabel(entry.type)}
              </span>
              <div className="cd-progress-bar">
                <div
                  className="cd-progress-fill"
                  style={{
                    width: `${pct}%`,
                    background: allDone
                      ? "var(--status-success-text)"
                      : hasActive
                        ? "var(--status-info-text)"
                        : "var(--border-default)",
                  }}
                />
              </div>
              <span className="cd-progress-count hf-text-xs">
                {allDone ? (
                  <span style={{ color: "var(--status-success-text)" }}>&#10003; {total}</span>
                ) : hasActive ? (
                  <span style={{ color: "var(--status-info-text)" }}>&#9654; {active.length}/{total}</span>
                ) : (
                  <span className="hf-text-muted">{reached}/{total}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Active + not-started summary */}
      {(() => {
        const active = sp.filter((s) => s.currentSession !== null && s.currentSession > 0);
        const notStarted = sp.filter((s) => s.currentSession === null);
        if (active.length === 0 && notStarted.length === 0) return null;
        return (
          <div className="hf-mt-sm">
            {active.length > 0 && (
              <div className="hf-text-xs hf-text-muted">
                <span className="hf-text-bold">Active: </span>
                {active.map((s) => {
                  const se = entries.find((e) => e.session === s.currentSession);
                  return `${s.name} \u2192 Session ${s.currentSession}${se ? ` (${getSessionTypeLabel(se.type)})` : ""}`;
                }).join(" \u00b7 ")}
              </div>
            )}
            {notStarted.length > 0 && (
              <div className="hf-text-xs hf-text-muted hf-mt-xs">
                <span className="hf-text-bold">Not started: </span>
                {notStarted.map((s) => s.name).join(", ")}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
