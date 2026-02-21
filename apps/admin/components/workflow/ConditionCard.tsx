"use client";

import type { StepCondition } from "@/lib/workflow/types";

interface ConditionCardProps {
  condition: StepCondition;
  stepTitle: string;
  onAnswer: (answer: boolean) => void;
}

export function ConditionCard({ condition, stepTitle, onAnswer }: ConditionCardProps) {
  return (
    <div
      style={{
        maxWidth: 500,
        margin: "40px auto",
        padding: 32,
        borderRadius: 16,
        border: "2px solid var(--warning-border)",
        background: "var(--warning-bg)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
          fontSize: 24,
        }}
      >
        ?
      </div>

      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 8,
        }}
      >
        {stepTitle}
      </h3>

      <p
        style={{
          fontSize: 14,
          color: "var(--text-secondary)",
          lineHeight: 1.5,
          marginBottom: 24,
        }}
      >
        {condition.question}
      </p>

      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button
          onClick={() => onAnswer(false)}
          style={{
            padding: "12px 32px",
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 10,
            border: "1px solid var(--border-default)",
            background: "var(--surface-primary)",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          No, skip this
        </button>
        <button
          onClick={() => onAnswer(true)}
          style={{
            padding: "12px 32px",
            fontSize: 14,
            fontWeight: 700,
            borderRadius: 10,
            border: "none",
            background:
              "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary) 100%)",
            color: "var(--surface-primary)",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
          }}
        >
          Yes
        </button>
      </div>
    </div>
  );
}
