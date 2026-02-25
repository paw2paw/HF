"use client";

import { Sparkles } from "lucide-react";
import "./wizard-section.css";

export type SectionStatus = "locked" | "active" | "done";

interface WizardSectionProps {
  id: string;
  stepNumber: number;
  status: SectionStatus;
  title: string;
  hint?: string;
  /** Short label shown before the summary text when done, e.g. "Institution" */
  summaryLabel?: string;
  /** Content shown in the collapsed done row */
  summary?: React.ReactNode;
  /** Called when "Edit ›" is clicked — triggers cascade in parent */
  onEdit?: () => void;
  /** Show sparkles icon to indicate AI auto-suggest in this section. */
  aiEnhanced?: boolean;
  /** Animate the sparkles icon while AI is fetching. */
  aiLoading?: boolean;
  /** Content shown when section is active */
  children: React.ReactNode;
}

export default function WizardSection({
  id,
  stepNumber,
  status,
  title,
  hint,
  summaryLabel,
  summary,
  onEdit,
  aiEnhanced,
  aiLoading,
  children,
}: WizardSectionProps) {
  if (status === "done") {
    return (
      <div className="ws-wrap" data-status="done" data-section={id}>
        <div className="ws-summary-row">
          <div className="ws-done-icon">✓</div>
          {summaryLabel && (
            <span className="ws-summary-label">{summaryLabel}</span>
          )}
          <span className="ws-summary-text">{summary}</span>
          {onEdit && (
            <button className="ws-edit-btn" onClick={onEdit} type="button">
              Edit ›
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === "locked") {
    return (
      <div className="ws-wrap" data-status="locked" data-section={id}>
        <div className="ws-locked-header">
          <p className="ws-locked-title">{title}</p>
        </div>
      </div>
    );
  }

  // active
  return (
    <div className="ws-wrap" data-status="active" data-section={id}>
      <div className="ws-header">
        <p className="ws-step-number">Step {stepNumber}</p>
        <h2 className="ws-title">
          {title}
          {aiEnhanced && (
            <span className={`hf-field-hint-ai${aiLoading ? " hf-field-hint-ai--loading" : ""}`} title="AI-enhanced — suggestions appear when you leave a field">
              <Sparkles size={15} />
            </span>
          )}
        </h2>
        {hint && <p className="ws-hint">{hint}</p>}
      </div>
      <div className="ws-body">{children}</div>
    </div>
  );
}
