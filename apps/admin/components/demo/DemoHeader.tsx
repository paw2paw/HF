"use client";

import type { DemoSpec } from "@/lib/demo/types";

interface DemoHeaderProps {
  spec: DemoSpec;
  currentStepIndex: number;
  visitedSteps: Set<number>;
  onGoTo: (index: number) => void;
  onClose: () => void;
}

export function DemoHeader({
  spec,
  currentStepIndex,
  visitedSteps,
  onGoTo,
  onClose,
}: DemoHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "12px 20px",
        borderBottom: "1px solid var(--border-default)",
        background: "var(--surface-primary)",
        gap: 16,
        flexShrink: 0,
      }}
    >
      {/* Demo title */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 18 }}>{spec.icon}</span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {spec.title}
        </span>
      </div>

      {/* Step indicator dots */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          overflow: "hidden",
        }}
        className="demo-step-dots"
      >
        {spec.steps.map((step, i) => {
          const isCurrent = i === currentStepIndex;
          const isVisited = visitedSteps.has(i);

          return (
            <button
              key={step.id}
              onClick={() => onGoTo(i)}
              title={step.title}
              style={{
                width: isCurrent ? 24 : 8,
                height: 8,
                borderRadius: 4,
                border: "none",
                padding: 0,
                cursor: "pointer",
                transition: "all 0.2s ease",
                background: isCurrent
                  ? "var(--accent-primary)"
                  : isVisited
                    ? "color-mix(in srgb, var(--accent-primary) 40%, transparent)"
                    : "var(--surface-tertiary)",
              }}
            />
          );
        })}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        title="Exit demo (Esc)"
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          border: "1px solid var(--border-default)",
          background: "transparent",
          color: "var(--text-muted)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          flexShrink: 0,
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.background = "var(--surface-secondary)";
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.background = "transparent";
        }}
      >
        ✕
      </button>

      <style jsx>{`
        @media (max-width: 640px) {
          .demo-step-dots {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
