"use client";

import { RotateCcw, PlayCircle } from "lucide-react";
import type { PendingWizardTask } from "@/hooks/useWizardResume";

/**
 * WizardResumeBanner — shows a "Continue where you left off?" prompt
 * when a user has an unfinished wizard task.
 *
 * Uses hf-card styling, CSS vars only (no hardcoded hex).
 */

interface WizardResumeBannerProps {
  task: PendingWizardTask;
  onResume: () => void;
  onDiscard: () => void;
  label?: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function WizardResumeBanner({ task, onResume, onDiscard, label }: WizardResumeBannerProps) {
  const displayLabel = label || task.taskType.replace(/_/g, " ");
  const wizardStep = task.context?._wizardStep;
  const stepInfo = wizardStep !== undefined ? `Step ${wizardStep + 1}` : null;

  return (
    <div className="hf-card" style={{ maxWidth: 560, margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Continue {displayLabel}?
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
            Started {timeAgo(task.startedAt)}
            {stepInfo && <> &middot; {stepInfo}</>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onResume} className="hf-btn hf-btn-primary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <PlayCircle className="w-4 h-4" />
            Continue
          </button>
          <button onClick={onDiscard} className="hf-btn hf-btn-secondary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <RotateCcw className="w-4 h-4" />
            Start Fresh
          </button>
        </div>
      </div>
    </div>
  );
}
