"use client";

import { useEffect, useRef, useState } from "react";
import { useStepFlow } from "@/contexts/StepFlowContext";
import type { StepDefinition } from "@/contexts/StepFlowContext";
import { ProgressStepper } from "@/components/shared/ProgressStepper";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import SourceStep from "./steps/SourceStep";
import ExtractStep from "./steps/ExtractStep";
import ReviewStep from "./steps/ReviewStep";
import PlanStep from "./steps/PlanStep";
import OnboardStep from "./steps/OnboardStep";
import PreviewStep from "./steps/PreviewStep";
import DoneStep from "./steps/DoneStep";

const CONTENT_STEPS: StepDefinition[] = [
  { id: "source", label: "Add Source", activeLabel: "Adding Source" },
  { id: "extract", label: "Extract", activeLabel: "Extracting Content" },
  { id: "review", label: "Review", activeLabel: "Reviewing Assertions" },
  { id: "plan", label: "Plan Lessons", activeLabel: "Planning Lessons" },
  { id: "onboard", label: "Onboard", activeLabel: "Configuring Onboarding" },
  { id: "preview", label: "Preview", activeLabel: "Previewing Prompt" },
  { id: "done", label: "Done", activeLabel: "Complete" },
];

export default function ContentSourceWizard() {
  const { state, isActive, startFlow, setStep, nextStep, prevStep, setData, getData, endFlow } = useStepFlow();
  const flowInitialized = useRef(false);
  const [wizardTaskId, setWizardTaskId] = useState<string | null>(null);

  // Load wizard steps from spec and start the flow
  useEffect(() => {
    if (flowInitialized.current) return;
    flowInitialized.current = true;

    const initializeWizard = async () => {
      // Load steps from spec
      let stepsToUse = CONTENT_STEPS;
      try {
        const response = await fetch("/api/wizard-steps?wizard=content-source");
        const data = await response.json();

        if (data.ok && data.steps && data.steps.length > 0) {
          // Convert WizardStep to StepDefinition
          stepsToUse = data.steps.map((step: any) => ({
            id: step.id,
            label: step.label,
            activeLabel: step.activeLabel,
          }));
        }
      } catch (err) {
        console.warn("[ContentSourceWizard] Failed to load spec steps, using defaults", err);
      }

      // Start the flow with loaded or default steps
      if (!isActive || state?.flowId !== "content-sources") {
        startFlow({
          flowId: "content-sources",
          steps: stepsToUse,
          returnPath: "/x/content-sources",
        });
      }

      // Create a wizard-level task (for global visibility in /x/tasks)
      // This is optional - the individual steps already track their own tasks (extraction, curriculum_generation)
    };

    initializeWizard();
  }, [isActive, state?.flowId, startFlow]);

  const currentStep = state?.currentStep ?? 0;

  // Warn on browser refresh/close when user has started working
  useUnsavedGuard(!!getData<string>("sourceId") || !!getData<boolean>("hasFile"));

  // Track visited steps in data bag so stepper survives refresh
  const savedVisited = getData<number[]>("visitedSteps");
  const visitedSteps = useRef(new Set<number>(savedVisited ?? [0]));
  if (!visitedSteps.current.has(currentStep)) {
    visitedSteps.current.add(currentStep);
    setData("visitedSteps", [...visitedSteps.current]);
  }

  const handleNext = () => nextStep();
  const handlePrev = () => prevStep();
  const handleGoToStep = (step: number) => setStep(step);

  // Build ProgressStepper data — only mark visited steps as completed
  // Use spec-loaded steps from flow state when available, fallback to hardcoded
  const activeSteps = state?.steps ?? CONTENT_STEPS;
  const progressSteps = activeSteps.map((s, i) => ({
    label: s.label,
    completed: visitedSteps.current.has(i) && i < currentStep,
    active: i === currentStep,
    onClick: i < currentStep ? () => handleGoToStep(i) : undefined,
  }));

  const stepProps = { setData, getData, onNext: handleNext, onPrev: handlePrev, endFlow, setStep: handleGoToStep };

  // CS-1: Skip ExtractStep when no file — forward and back
  const sourceOnNext = getData<boolean>("hasFile") ? handleNext : () => handleGoToStep(2);
  const reviewOnPrev = getData<boolean>("hasFile") ? handlePrev : () => handleGoToStep(0);

  return (
    <div>
      {/* Progress stepper */}
      <div style={{ marginBottom: 32 }}>
        <ProgressStepper steps={progressSteps} />
      </div>

      {/* Current step */}
      {currentStep === 0 && <SourceStep {...stepProps} onNext={sourceOnNext} />}
      {currentStep === 1 && <ExtractStep {...stepProps} />}
      {currentStep === 2 && <ReviewStep {...stepProps} onPrev={reviewOnPrev} />}
      {currentStep === 3 && (
        <PlanStep
          {...stepProps}
          onPrev={getData<boolean>("existingSource") ? () => handleGoToStep(0) : handlePrev}
        />
      )}
      {currentStep === 4 && <OnboardStep {...stepProps} />}
      {currentStep === 5 && <PreviewStep {...stepProps} />}
      {currentStep === 6 && <DoneStep {...stepProps} />}
    </div>
  );
}
