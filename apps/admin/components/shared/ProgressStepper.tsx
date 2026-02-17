"use client";

interface ProgressStep {
  label: string;
  completed: boolean;
  active?: boolean;
  onClick?: () => void;
}

interface ProgressStepperProps {
  steps: ProgressStep[];
}

export function ProgressStepper({ steps }: ProgressStepperProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: isLast ? "0 0 auto" : 1 }}>
            {/* Step circle + label */}
            <button
              onClick={step.onClick}
              disabled={!step.onClick}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "none",
                border: "none",
                cursor: step.onClick ? "pointer" : "default",
                padding: 0,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                  background: step.completed
                    ? "var(--status-success-bg, #dcfce7)"
                    : step.active
                    ? "color-mix(in srgb, var(--accent-primary) 12%, transparent)"
                    : "var(--surface-secondary)",
                  color: step.completed
                    ? "var(--status-success-text, #16a34a)"
                    : step.active
                    ? "var(--accent-primary)"
                    : "var(--text-muted)",
                  border: step.active
                    ? "2px solid var(--accent-primary)"
                    : "2px solid transparent",
                }}
              >
                {step.completed ? "\u2713" : i + 1}
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: step.active ? 700 : step.completed ? 600 : 500,
                  color: step.active
                    ? "var(--accent-primary)"
                    : step.completed
                    ? "var(--text-primary)"
                    : "var(--text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {step.label}
              </span>
            </button>

            {/* Connector line */}
            {!isLast && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  marginLeft: 8,
                  marginRight: 8,
                  background: step.completed
                    ? "var(--status-success-text, #16a34a)"
                    : "var(--border-default)",
                  borderRadius: 1,
                  minWidth: 16,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
