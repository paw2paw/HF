"use client";

import { useEffect, useRef } from "react";
import { useStepFlow } from "@/contexts/StepFlowContext";
import type { StepDefinition } from "@/contexts/StepFlowContext";
import { ProgressStepper } from "@/components/shared/ProgressStepper";
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

  // Start the flow on mount (if not already active with this flowId)
  useEffect(() => {
    if (flowInitialized.current) return;
    flowInitialized.current = true;

    if (!isActive || state?.flowId !== "content-sources") {
      startFlow({
        flowId: "content-sources",
        steps: CONTENT_STEPS,
        returnPath: "/x/content-sources",
      });
    }
  }, [isActive, state?.flowId, startFlow]);

  const currentStep = state?.currentStep ?? 0;

  const handleNext = () => nextStep();
  const handlePrev = () => prevStep();
  const handleGoToStep = (step: number) => setStep(step);

  // Build ProgressStepper data
  const progressSteps = CONTENT_STEPS.map((s, i) => ({
    label: s.label,
    completed: i < currentStep,
    active: i === currentStep,
    onClick: i < currentStep ? () => handleGoToStep(i) : undefined,
  }));

  const stepProps = { setData, getData, onNext: handleNext, onPrev: handlePrev, endFlow };

  return (
    <div>
      {/* Progress stepper */}
      <div style={{ marginBottom: 32 }}>
        <ProgressStepper steps={progressSteps} />
      </div>

      {/* Current step */}
      {currentStep === 0 && <SourceStep {...stepProps} />}
      {currentStep === 1 && <ExtractStep {...stepProps} />}
      {currentStep === 2 && <ReviewStep {...stepProps} />}
      {currentStep === 3 && <PlanStep {...stepProps} />}
      {currentStep === 4 && <OnboardStep {...stepProps} />}
      {currentStep === 5 && <PreviewStep {...stepProps} />}
      {currentStep === 6 && <DoneStep {...stepProps} />}
    </div>
  );
}
