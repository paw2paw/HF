"use client";

interface DemoNavigationBarProps {
  isFirstStep: boolean;
  isLastStep: boolean;
  isAutoplay: boolean;
  progress: number;
  onPrev: () => void;
  onNext: () => void;
  onToggleAutoplay: () => void;
}

export function DemoNavigationBar({
  isFirstStep,
  isLastStep,
  isAutoplay,
  progress,
  onPrev,
  onNext,
  onToggleAutoplay,
}: DemoNavigationBarProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        borderTop: "1px solid var(--border-default)",
        background: "var(--surface-primary)",
        flexShrink: 0,
      }}
    >
      {/* Progress bar */}
      <div
        style={{
          height: 3,
          background: "var(--surface-tertiary)",
          width: "100%",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "var(--accent-primary)",
            transition: "width 0.3s ease",
            borderRadius: "0 2px 2px 0",
          }}
        />
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          gap: 12,
        }}
      >
        {/* Back button */}
        <button
          onClick={onPrev}
          disabled={isFirstStep}
          style={{
            padding: "8px 20px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            border: "1px solid var(--border-default)",
            background: "transparent",
            color: isFirstStep ? "var(--text-muted)" : "var(--text-primary)",
            cursor: isFirstStep ? "not-allowed" : "pointer",
            opacity: isFirstStep ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.15s",
          }}
        >
          ← Back
        </button>

        {/* Center: autoplay toggle + keyboard hints */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <button
            onClick={onToggleAutoplay}
            style={{
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 6,
              border: isAutoplay
                ? "1px solid var(--accent-primary)"
                : "1px solid var(--border-default)",
              background: isAutoplay
                ? "color-mix(in srgb, var(--accent-primary) 10%, transparent)"
                : "transparent",
              color: isAutoplay ? "var(--accent-primary)" : "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s",
            }}
          >
            {isAutoplay ? "⏸ Pause" : "▶ Autoplay"}
          </button>

          <span
            className="demo-keyboard-hints"
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              opacity: 0.6,
            }}
          >
            ← → navigate · Space autoplay · ? ask AI
          </span>
        </div>

        {/* Next button */}
        <button
          onClick={onNext}
          disabled={isLastStep}
          style={{
            padding: "8px 20px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            border: "none",
            background: isLastStep
              ? "var(--surface-tertiary)"
              : "var(--accent-primary)",
            color: isLastStep ? "var(--text-muted)" : "#fff",
            cursor: isLastStep ? "not-allowed" : "pointer",
            opacity: isLastStep ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.15s",
          }}
        >
          Next →
        </button>
      </div>

      <style jsx>{`
        @media (max-width: 640px) {
          .demo-keyboard-hints {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
