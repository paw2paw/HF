"use client";

import type { WorkflowStep, WorkflowPhase } from "@/lib/workflow/types";

interface WorkflowStepperProps {
  steps: WorkflowStep[];
  currentStepId: string | null;
  phase: WorkflowPhase;
  onStepClick: (stepId: string) => void;
}

export function WorkflowStepper({ steps, currentStepId, phase, onStepClick }: WorkflowStepperProps) {
  if (phase === "planning" || steps.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "16px 0",
        overflowX: "auto",
        borderBottom: "1px solid var(--border-default)",
        marginBottom: 24,
      }}
    >
      {steps.map((step, i) => {
        const isCurrent = step.id === currentStepId;
        const isCompleted = step.status === "completed";
        const isSkipped = step.status === "skipped";
        const isClickable = isCompleted || isCurrent;

        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && (
              <div
                style={{
                  width: 24,
                  height: 2,
                  background: isCompleted || isCurrent
                    ? "var(--accent-primary)"
                    : "var(--border-default)",
                  margin: "0 4px",
                  borderRadius: 1,
                  transition: "background 0.3s ease",
                }}
              />
            )}
            <button
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 10,
                border: isCurrent
                  ? "2px solid var(--accent-primary)"
                  : "1px solid var(--border-default)",
                background: isCurrent
                  ? "var(--accent-bg)"
                  : isCompleted
                    ? "var(--success-bg)"
                    : isSkipped
                      ? "var(--surface-tertiary)"
                      : "var(--surface-secondary)",
                cursor: isClickable ? "pointer" : "default",
                opacity: isSkipped ? 0.5 : 1,
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              <StepIndicator
                number={i + 1}
                status={step.status}
                isCurrent={isCurrent}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent
                    ? "var(--accent-primary)"
                    : isCompleted
                      ? "var(--success-text)"
                      : "var(--text-secondary)",
                }}
              >
                {step.title}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function StepIndicator({
  number,
  status,
  isCurrent,
}: {
  number: number;
  status: string;
  isCurrent: boolean;
}) {
  const size = 26;

  if (status === "completed") {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          background: "var(--success-text)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        ✓
      </div>
    );
  }

  if (status === "skipped") {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          background: "var(--surface-tertiary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: 12,
        }}
      >
        —
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: isCurrent
          ? "linear-gradient(135deg, var(--accent-primary) 0%, #6366f1 100%)"
          : "var(--surface-tertiary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: isCurrent ? "#fff" : "var(--text-muted)",
        fontWeight: 700,
        fontSize: 12,
        boxShadow: isCurrent ? "0 2px 6px rgba(99, 102, 241, 0.3)" : "none",
      }}
    >
      {number}
    </div>
  );
}
