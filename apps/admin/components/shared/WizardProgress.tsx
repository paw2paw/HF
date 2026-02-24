"use client";

import "./wizard-progress.css";

interface WizardProgressProps {
  /** 1-indexed current step */
  current: number;
  total: number;
  /** Intent question for the current step, e.g. "What do students need to achieve?" */
  stepName: string;
}

export default function WizardProgress({
  current,
  total,
  stepName,
}: WizardProgressProps) {
  const pct = Math.round((current / total) * 100);

  return (
    <div className="wp-wrap">
      <p className="wp-counter">
        Step <strong>{current}</strong> of {total} &middot; {stepName}
      </p>
      <div className="wp-bar-track">
        <div className="wp-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
