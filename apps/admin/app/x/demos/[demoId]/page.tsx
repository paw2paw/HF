"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { loadDemo } from "@/lib/demo/registry";
import { DemoPlayer } from "@/components/demo/DemoPlayer";
import { DemoFlowView } from "@/components/demo/DemoFlowView";
import { UnifiedAssistantPanel } from "@/components/shared/UnifiedAssistantPanel";
import { useAssistant, useAssistantKeyboardShortcut } from "@/hooks/useAssistant";
import type { DemoStep } from "@/lib/demo/types";

type ViewMode = "player" | "flow";

export default function DemoPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const demoId = params.demoId as string;
  const spec = loadDemo(demoId);
  const [viewMode, setViewMode] = useState<ViewMode>("player");

  const assistant = useAssistant({
    defaultTab: "chat",
    layout: "sidebar",
  });

  useAssistantKeyboardShortcut(assistant.toggle);

  const handleOpenAssistant = useCallback(
    (step: DemoStep) => {
      assistant.open(
        {
          type: "demo",
          data: {
            demoId: spec?.id,
            demoTitle: spec?.title,
            stepId: step.id,
            stepTitle: step.title,
            stepDescription: step.description,
            currentView: step.aiContext.currentView,
            action: step.aiContext.action,
            relatedConcepts: step.aiContext.relatedConcepts,
            reason: step.reason,
            goal: step.goal,
          },
        },
        step.aiContext.assistantLocation || {
          page: "/x/demos",
          section: step.title,
          entityType: "demo",
          entityId: spec?.id,
        },
      );
    },
    [assistant, spec],
  );

  const handleFlowStepClick = useCallback((stepIndex: number) => {
    setViewMode("player");
    // The player will start at step 0; the user can navigate from there.
    // A future enhancement could pass the initial step index.
  }, []);

  if (!spec) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: "var(--text-muted)",
        }}
      >
        <p style={{ fontSize: 48, marginBottom: 16 }}>🔍</p>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
          Demo not found
        </h2>
        <p style={{ fontSize: 14, marginBottom: 20 }}>
          No demo with ID &ldquo;{demoId}&rdquo; was found.
        </p>
        <button
          onClick={() => router.push("/x/demos")}
          style={{
            padding: "8px 20px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            border: "1px solid var(--border-default)",
            background: "transparent",
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          ← Back to Demos
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: "calc(100vh - 48px)", display: "flex", flexDirection: "column" }}>
      {/* View mode toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 16px",
          borderBottom: "1px solid var(--border-default)",
          background: "var(--surface-secondary, #181825)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", gap: 2 }}>
          {(["player", "flow"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: "5px 14px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s",
                background:
                  viewMode === mode
                    ? "var(--accent-primary, #7c3aed)"
                    : "transparent",
                color:
                  viewMode === mode
                    ? "#fff"
                    : "var(--text-muted, #888)",
              }}
            >
              {mode === "player" ? "Player" : "Flow"}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {spec.steps.length} steps
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {viewMode === "player" ? (
          <DemoPlayer spec={spec} onOpenAssistant={handleOpenAssistant} />
        ) : (
          <DemoFlowView spec={spec} onStepClick={handleFlowStepClick} />
        )}
      </div>

      <UnifiedAssistantPanel
        visible={assistant.isOpen}
        onClose={assistant.close}
        context={assistant.context}
        location={assistant.location}
        {...assistant.options}
      />
    </div>
  );
}
