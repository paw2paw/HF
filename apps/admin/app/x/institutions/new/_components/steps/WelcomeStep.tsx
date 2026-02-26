"use client";

import { useState } from "react";
import { FieldHint } from "@/components/shared/FieldHint";
import { WIZARD_HINTS } from "@/lib/wizard-hints";
import { StepFooter } from "@/components/wizards/StepFooter";
import type { StepRenderProps } from "@/components/wizards/types";

export function WelcomeStep({ getData, setData, onNext, onPrev }: StepRenderProps) {
  const institutionName = getData<string>("institutionName") ?? "";
  const [welcomeMessage, setWelcomeMessage] = useState(getData<string>("welcomeMessage") ?? "");

  const handleContinue = () => {
    setData("welcomeMessage", welcomeMessage);
    onNext();
  };

  return (
    <div>
      <FieldHint label="Welcome Message" hint={WIZARD_HINTS["institution.welcome"]} />
      <textarea
        value={welcomeMessage}
        onChange={(e) => setWelcomeMessage(e.target.value)}
        placeholder={`Welcome to ${institutionName || "our institution"}! Our AI tutors help every learner build confidence.`}
        rows={3}
        className="hf-input iw-welcome-textarea"
      />
      <StepFooter
        onBack={onPrev}
        onSkip={handleContinue}
        skipLabel="Skip"
        onNext={handleContinue}
        nextLabel="Continue"
      />
    </div>
  );
}
