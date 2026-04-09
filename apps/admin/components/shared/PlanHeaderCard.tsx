"use client";

import { Sparkles, RefreshCw } from "lucide-react";
import { getLessonPlanModel } from "@/lib/lesson-plan/models";
import { PlanSummary } from "@/app/x/courses/_components/PlanSummary";
import type { SessionEntry } from "@/lib/lesson-plan/types";

export interface PlanHeaderCardProps {
  entries: SessionEntry[];
  model?: string | null;
  generatedAt?: string | null;
  estimatedSessions?: number;
  regenerating?: boolean;
  regenSessionCount?: number | null;
  onRegenSessionCountChange?: (n: number | null) => void;
  onRegenerate?: () => void;
  readonly?: boolean;
  curriculumId?: string | null;
}

export function PlanHeaderCard({
  entries,
  model,
  generatedAt,
  regenerating = false,
  regenSessionCount,
  onRegenSessionCountChange,
  onRegenerate,
  readonly = false,
  curriculumId,
}: PlanHeaderCardProps) {
  const totalTPs = entries.reduce((sum, e) => sum + (e.assertionCount || 0), 0);
  const totalDuration = entries.reduce((sum, e) => sum + (e.estimatedDurationMins || 0), 0);

  return (
    <div className="cd-plan-header hf-card hf-mb-lg">
      <div className="hf-flex hf-flex-between hf-items-center hf-mb-sm">
        <div className="hf-flex hf-items-center hf-gap-sm">
          <Sparkles size={18} className="hf-text-accent" />
          <span className="hf-section-title hf-mb-0">Your Lesson Plan</span>
        </div>
        {!readonly && curriculumId && onRegenerate && (
          <div className="hf-flex hf-items-center hf-gap-sm">
            <label className="hf-flex hf-items-center hf-gap-xs hf-text-xs hf-text-muted">
              Sessions
              <input
                type="number"
                min={1}
                max={100}
                value={regenSessionCount ?? ""}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  onRegenSessionCountChange?.(v > 0 && v <= 100 ? v : null);
                }}
                className="hf-input hf-input-sm"
                style={{ width: 56 }}
              />
            </label>
            <button onClick={onRegenerate} disabled={regenerating} className="hf-btn hf-btn-secondary hf-btn-sm">
              {regenerating ? (
                <><div className="hf-spinner hf-spinner-xs" /> Regenerating...</>
              ) : (
                <><RefreshCw size={13} /> Regenerate Plan</>
              )}
            </button>
          </div>
        )}
      </div>
      <div className="hf-flex hf-items-center hf-gap-md hf-mb-sm">
        <span className="hf-text-sm hf-text-primary">
          {entries.length} session{entries.length !== 1 ? "s" : ""}
        </span>
        {model && (
          <span className="hf-chip hf-chip-sm">{getLessonPlanModel(model).label}</span>
        )}
        {totalTPs > 0 && (
          <span className="hf-text-xs hf-text-muted">{totalTPs} teaching points</span>
        )}
        {totalDuration > 0 && (
          <span className="hf-text-xs hf-text-muted">~{totalDuration} min total</span>
        )}
      </div>
      <PlanSummary
        state={regenerating ? "generating" : "ready"}
        sessions={entries.map((e) => ({ type: e.type, label: e.label }))}
      />
      {generatedAt && (
        <div className="hf-text-xs hf-text-muted hf-mt-sm">
          Generated {new Date(generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </div>
      )}
    </div>
  );
}
