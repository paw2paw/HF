'use client';

import { Info } from 'lucide-react';
import './onboarding-preview.css';

// ── Types ──────────────────────────────────────────────

export interface OnboardingPhase {
  phase: string;
  duration: string;
  goals: string[];
  avoid?: string[];
}

export interface OnboardingPreviewProps {
  /** Welcome message text (rendered as AI greeting bubble) */
  greeting?: string;
  /** Persona display name shown above greeting (e.g., "Tutor") */
  personaName?: string;
  /** Flow phases displayed as WhatsApp-style separator chips */
  phases: OnboardingPhase[];
  /** Hint text at bottom (e.g., "Edit in Institution settings") */
  hint?: string;
  /** Max height before scrolling (default: 360) */
  maxHeight?: number;
}

/** Max greeting length before truncation */
const GREETING_MAX = 200;

// ── Component ──────────────────────────────────────────

export function OnboardingPreview({
  greeting,
  personaName,
  phases,
  hint,
  maxHeight = 360,
}: OnboardingPreviewProps) {
  const hasGreeting = !!greeting?.trim();
  const hasPhases = phases.length > 0;

  if (!hasGreeting && !hasPhases) return null;

  const displayGreeting = greeting && greeting.length > GREETING_MAX
    ? greeting.slice(0, GREETING_MAX) + '\u2026'
    : greeting;

  return (
    <div className="ob-preview">
      <div className="ob-preview-chat" style={{ maxHeight }}>

        {/* Greeting bubble */}
        {hasGreeting && (
          <div className="ob-bubble">
            {personaName && (
              <div className="ob-bubble-persona">{personaName}</div>
            )}
            <span className="ob-bubble-text">&ldquo;{displayGreeting}&rdquo;</span>
          </div>
        )}

        {/* Phase separator chips */}
        {phases.map((phase, i) => {
          const goalsSummary = phase.goals?.slice(0, 2).join(' \u00B7 ') || '';
          return (
            <div key={`${phase.phase}-${i}`} className="ob-phase-chip">
              <div className="ob-phase-chip-header">
                <span className="ob-phase-chip-num">{i + 1}</span>
                <span className="ob-phase-chip-name">{phase.phase}</span>
                {phase.duration && (
                  <>
                    <span className="ob-phase-chip-dur">&middot;</span>
                    <span className="ob-phase-chip-dur">{phase.duration}</span>
                  </>
                )}
              </div>
              {goalsSummary && (
                <div className="ob-phase-chip-goals">{goalsSummary}</div>
              )}
            </div>
          );
        })}

        {/* Hint */}
        {hint && (
          <div className="ob-hint">
            <Info size={12} />
            <span>{hint}</span>
          </div>
        )}
      </div>
    </div>
  );
}
