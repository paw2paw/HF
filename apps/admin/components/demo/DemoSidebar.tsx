"use client";

import type { DemoStep } from "@/lib/demo/types";

interface DemoSidebarProps {
  step: DemoStep;
  stepIndex: number;
  totalSteps: number;
  onAskAI: () => void;
}

const TIP_ICONS: Record<string, string> = {
  tip: "💡",
  warning: "⚠️",
  shortcut: "⚡",
  "best-practice": "✨",
};

export function DemoSidebar({ step, stepIndex, totalSteps, onAskAI }: DemoSidebarProps) {
  return (
    <div
      style={{
        width: 300,
        minWidth: 300,
        padding: "20px 16px",
        borderLeft: "1px solid var(--border-default)",
        background: "var(--surface-primary)",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
      className="demo-sidebar"
    >
      {/* Step counter */}
      <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
        Step {stepIndex + 1} of {totalSteps}
      </div>

      {/* Step title + description */}
      <div>
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: "0 0 6px 0",
          }}
        >
          {step.title}
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {step.description}
        </p>
      </div>

      {/* Reason callout */}
      {step.reason && (
        <div
          style={{
            padding: 12,
            background: "rgba(139, 92, 246, 0.06)",
            border: "1px solid rgba(139, 92, 246, 0.2)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(139, 92, 246, 0.8)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 6,
            }}
          >
            Why this matters
          </div>
          {step.reason}
        </div>
      )}

      {/* Goal badge */}
      {step.goal && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            background: "var(--surface-secondary)",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <span style={{ fontSize: 14 }}>🎯</span>
          <span style={{ color: "var(--text-secondary)" }}>{step.goal}</span>
        </div>
      )}

      {/* Tips — reuses FlashSidebar suggestion pattern */}
      {step.tips && step.tips.length > 0 && (
        <div>
          <h4
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-muted)",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Tips
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {step.tips.map((tip, i) => (
              <div
                key={i}
                style={{
                  padding: 10,
                  background: "var(--surface-secondary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>
                  {TIP_ICONS[tip.type] || "💡"}
                </span>
                <span style={{ lineHeight: 1.4 }}>{tip.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Ask AI button */}
      <button
        onClick={onAskAI}
        style={{
          padding: "10px 16px",
          background: "var(--accent-primary)",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) => ((e.target as HTMLElement).style.opacity = "0.9")}
        onMouseLeave={(e) => ((e.target as HTMLElement).style.opacity = "1")}
      >
        <span>🤖</span>
        Ask AI about this step
        <span
          style={{
            fontSize: 11,
            opacity: 0.7,
            padding: "2px 6px",
            background: "rgba(255,255,255,0.15)",
            borderRadius: 4,
          }}
        >
          ?
        </span>
      </button>

      <style jsx>{`
        @media (max-width: 768px) {
          .demo-sidebar {
            width: 100% !important;
            min-width: 0 !important;
            border-left: none !important;
            border-top: 1px solid var(--border-default);
            max-height: 40vh;
          }
        }
      `}</style>
    </div>
  );
}
