"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { DemoSpec, DemoStep } from "@/lib/demo/types";
import { useDemoPlayer } from "@/lib/demo/useDemoPlayer";
import { useGuidance } from "@/contexts/GuidanceContext";
import { DemoHeader } from "./DemoHeader";
import { DemoStepRenderer } from "./DemoStepRenderer";
import { DemoSidebar } from "./DemoSidebar";
import { DemoNavigationBar } from "./DemoNavigationBar";

interface DemoPlayerProps {
  spec: DemoSpec;
  /** Optional: wire up AI assistant integration */
  onOpenAssistant?: (step: DemoStep) => void;
}

export function DemoPlayer({ spec, onOpenAssistant }: DemoPlayerProps) {
  const router = useRouter();
  const guidance = useGuidance();

  const handleStepChange = useCallback(
    (step: DemoStep) => {
      // Trigger sidebar highlight if configured
      if (step.sidebarHighlight && guidance) {
        guidance.clearAllHighlights();
        guidance.highlightSidebar(
          step.sidebarHighlight.href,
          step.sidebarHighlight.type,
          8000, // 8 second highlight
          step.title,
        );
      } else if (guidance) {
        guidance.clearAllHighlights();
      }
    },
    [guidance],
  );

  const handleAskAI = useCallback(
    (step: DemoStep) => {
      onOpenAssistant?.(step);
    },
    [onOpenAssistant],
  );

  const handleExit = useCallback(() => {
    guidance?.clearAllHighlights();
    router.push("/x/demos");
  }, [router, guidance]);

  const {
    state,
    currentStep,
    isFirstStep,
    isLastStep,
    progress,
    next,
    prev,
    goTo,
    toggleAutoplay,
    pauseForAI,
  } = useDemoPlayer({
    spec,
    onStepChange: handleStepChange,
    onAskAI: handleAskAI,
    onExit: handleExit,
  });

  const handleAskAIClick = useCallback(() => {
    pauseForAI();
  }, [pauseForAI]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        background: "var(--surface-primary)",
      }}
    >
      {/* Header with step dots */}
      <DemoHeader
        spec={spec}
        currentStepIndex={state.currentStepIndex}
        visitedSteps={state.visitedSteps}
        onGoTo={goTo}
        onClose={handleExit}
      />

      {/* Main content area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          minHeight: 0,
          overflow: "hidden",
        }}
        className="demo-main-area"
      >
        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 24,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
          }}
        >
          <div
            key={currentStep.id}
            className="demo-step-content-enter"
            style={{ width: "100%" }}
          >
            <DemoStepRenderer content={currentStep.content} onAnnotationClick={next} />
          </div>
        </div>

        {/* Sidebar */}
        <DemoSidebar
          step={currentStep}
          stepIndex={state.currentStepIndex}
          totalSteps={state.totalSteps}
          onAskAI={handleAskAIClick}
        />
      </div>

      {/* Navigation bar */}
      <DemoNavigationBar
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
        isAutoplay={state.isAutoplay}
        progress={progress}
        onPrev={prev}
        onNext={next}
        onToggleAutoplay={toggleAutoplay}
      />

      <style jsx>{`
        @keyframes demoFadeIn {
          from {
            opacity: 0;
            transform: translateX(8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .demo-step-content-enter {
          animation: demoFadeIn 0.25s ease-out;
        }
        @media (max-width: 768px) {
          .demo-main-area {
            flex-direction: column !important;
          }
        }
      `}</style>
    </div>
  );
}
