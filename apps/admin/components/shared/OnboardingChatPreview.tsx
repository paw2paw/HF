'use client';

import './onboarding-preview.css';

// ── Types ──────────────────────────────────────────────

export interface ChatPhase {
  phase: string;
  duration: string;
  goals: string[];
  avoid?: string[];
}

export interface OnboardingChatPreviewProps {
  /** Welcome message text (rendered as AI greeting bubble) */
  greeting?: string;
  /** Persona display name shown above greeting (e.g., "Tutor") */
  personaName?: string;
  /** Flow phases rendered as conversation segments */
  phases: ChatPhase[];
  /** Max height before scrolling (default: 600) */
  maxHeight?: number;
}

// ── Caller response placeholders per phase ─────────────

const CALLER_RESPONSES: Record<string, string> = {
  welcome: "Thanks! I'm looking forward to this.",
  orient: "That makes sense — how do sessions usually go?",
  discover: "I'd really like to improve my understanding of...",
  sample: "Oh that's interesting, I hadn't thought of it like that!",
  close: "This was really helpful, thank you!",
};

/** Phases where we show a caller response bubble */
const CALLER_RESPONSE_PHASES = new Set(["welcome", "discover", "close"]);

// ── Component ──────────────────────────────────────────

export function OnboardingChatPreview({
  greeting,
  personaName,
  phases,
  maxHeight = 600,
}: OnboardingChatPreviewProps) {
  const hasGreeting = !!greeting?.trim();
  const hasPhases = phases.length > 0;

  if (!hasGreeting && !hasPhases) {
    return (
      <div className="ob-preview">
        <div className="ob-preview-chat ob-chat-empty" style={{ maxHeight }}>
          <div className="ob-chat-empty-text">
            Add a welcome message and flow phases to preview the first call experience
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ob-preview">
      <div className="ob-preview-chat" style={{ maxHeight }}>

        {/* Welcome phase separator + greeting */}
        {hasGreeting && (
          <>
            {hasPhases && phases[0] && (
              <div className="ob-chat-sep">
                <span className="ob-chat-sep-line" />
                <span className="ob-chat-sep-label">
                  {phases[0].phase || 'Welcome'}
                  {phases[0].duration && <span className="ob-chat-sep-dur"> · {phases[0].duration}</span>}
                </span>
                <span className="ob-chat-sep-line" />
              </div>
            )}

            {/* AI greeting bubble */}
            <div className="ob-chat-ai">
              {personaName && (
                <div className="ob-chat-persona">{personaName}</div>
              )}
              <div className="ob-chat-text">{greeting}</div>
            </div>

            {/* Caller response for welcome phase */}
            {CALLER_RESPONSES[phases[0]?.phase?.toLowerCase()] && (
              <div className="ob-chat-caller">
                <div className="ob-chat-text">
                  {CALLER_RESPONSES[phases[0].phase.toLowerCase()]}
                </div>
              </div>
            )}
          </>
        )}

        {/* Subsequent phases */}
        {phases.slice(hasGreeting ? 1 : 0).map((phase, i) => {
          const phaseKey = phase.phase?.toLowerCase() || '';
          const showCaller = CALLER_RESPONSE_PHASES.has(phaseKey);
          const callerText = CALLER_RESPONSES[phaseKey];
          const goalsSummary = phase.goals?.slice(0, 3).join('. ');

          return (
            <div key={`${phase.phase}-${i}`}>
              {/* Phase separator */}
              <div className="ob-chat-sep">
                <span className="ob-chat-sep-line" />
                <span className="ob-chat-sep-label">
                  {phase.phase || `Phase ${i + (hasGreeting ? 2 : 1)}`}
                  {phase.duration && <span className="ob-chat-sep-dur"> · {phase.duration}</span>}
                </span>
                <span className="ob-chat-sep-line" />
              </div>

              {/* AI bubble — show goals as conversation description */}
              {goalsSummary && (
                <div className="ob-chat-ai">
                  <div className="ob-chat-goals">{goalsSummary}</div>
                  {phase.avoid && phase.avoid.length > 0 && (
                    <div className="ob-chat-avoid">
                      Avoids: {phase.avoid.slice(0, 2).join(', ').toLowerCase()}
                    </div>
                  )}
                </div>
              )}

              {/* Caller response (only for conversation-heavy phases) */}
              {showCaller && callerText && (
                <div className="ob-chat-caller">
                  <div className="ob-chat-text">{callerText}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
