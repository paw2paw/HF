"use client";

/**
 * Get Started — chat-like onboarding wizard
 *
 * Two-column layout: ConversationWizard (left) + ScaffoldPanel (right).
 * AI asks questions as left-aligned bubbles. User answers right-aligned.
 * Single input at the bottom, inline pickers in the conversation.
 */

import { useStepFlow } from "@/contexts/StepFlowContext";
import { ConversationWizard } from "./components/ConversationWizard";
import { ScaffoldPanel } from "./components/ScaffoldPanel";
import "./get-started.css";

function GetStartedInner() {
  const { state, getData } = useStepFlow();
  const currentStep = state?.currentStep ?? 0;

  return (
    <div className="gs-layout">
      <div className="gs-main">
        <ConversationWizard />
      </div>
      <ScaffoldPanel getData={getData} currentStepIndex={currentStep} />
    </div>
  );
}

export default function GetStartedPage() {
  return <GetStartedInner />;
}
