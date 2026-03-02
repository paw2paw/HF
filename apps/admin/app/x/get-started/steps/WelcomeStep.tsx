"use client";

/**
 * Step 5: Welcome & Sessions
 *
 * Welcome message (with AI suggestions) + session count/duration/emphasis chips.
 */

import { useState } from "react";
import { ChipSelect } from "@/components/shared/ChipSelect";
import { FieldHint } from "@/components/shared/FieldHint";
import { WIZARD_HINTS } from "@/lib/wizard-hints";
import { StepFooter } from "@/components/wizards/StepFooter";
import type { StepRenderProps } from "@/components/wizards/types";

const SESSION_COUNT_OPTIONS = [
  { value: "3", label: "3" },
  { value: "5", label: "5" },
  { value: "8", label: "8" },
  { value: "12", label: "12" },
];

const DURATION_OPTIONS = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
];

const PLAN_EMPHASIS_OPTIONS = [
  { value: "breadth", label: "Breadth" },
  { value: "balanced", label: "Balanced" },
  { value: "depth", label: "Depth" },
];

const EMPHASIS_HINTS: Record<string, string> = {
  breadth: "Cover all topics at a lighter level — good for revision or survey courses.",
  balanced: "Mix of breadth and depth — AI decides per module based on learner progress.",
  depth: "Go deep on fewer topics — good for mastery-focused courses.",
};

export function WelcomeStep({ getData, setData, onNext, onPrev }: StepRenderProps) {
  const courseName = getData<string>("courseName") || "your course";

  const [welcomeMessage, setWelcomeMessage] = useState(
    getData<string>("welcomeMessage") ?? "",
  );
  const [sessionCount, setSessionCount] = useState(
    getData<string>("sessionCount") ?? "5",
  );
  const [durationMins, setDurationMins] = useState(
    getData<string>("durationMins") ?? "30",
  );
  const [emphasis, setEmphasis] = useState(
    getData<string>("planEmphasis") ?? "balanced",
  );

  const handleNext = () => {
    setData("welcomeMessage", welcomeMessage.trim() || undefined);
    setData("sessionCount", parseInt(sessionCount, 10));
    setData("durationMins", parseInt(durationMins, 10));
    setData("planEmphasis", emphasis);
    onNext();
  };

  return (
    <div className="hf-wizard-page">
      <div className="hf-wizard-step">
        <div className="hf-mb-lg">
          <h1 className="hf-page-title hf-mb-xs">Welcome &amp; sessions</h1>
          <p className="hf-page-subtitle">How should the first call feel?</p>
        </div>

        <div className="hf-mb-lg">
          <FieldHint
            label="Welcome message (optional)"
            hint={WIZARD_HINTS["get-started.welcome"]}
            labelClass="hf-label"
          />
          <textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder={`e.g. "Welcome to ${courseName}! I'm here to help you learn at your own pace..."`}
            className="hf-input"
            rows={3}
            style={{ resize: "vertical" }}
          />
          <div className="hf-hint">
            Leave blank for the default: &ldquo;Good to have you. Let&apos;s just ease into this... no rush.&rdquo;
          </div>
        </div>

        <div className="hf-mb-lg">
          <FieldHint
            label="How many sessions?"
            hint={WIZARD_HINTS["get-started.sessions"]}
            labelClass="hf-label"
          />
          <ChipSelect
            options={SESSION_COUNT_OPTIONS}
            value={sessionCount}
            onChange={setSessionCount}
          />
        </div>

        <div className="hf-mb-lg">
          <FieldHint
            label="Session duration"
            hint={WIZARD_HINTS["get-started.duration"]}
            labelClass="hf-label"
          />
          <ChipSelect
            options={DURATION_OPTIONS}
            value={durationMins}
            onChange={setDurationMins}
          />
        </div>

        <div className="hf-mb-lg">
          <FieldHint
            label="Teaching emphasis"
            hint={WIZARD_HINTS["get-started.planEmphasis"]}
            labelClass="hf-label"
          />
          <ChipSelect
            options={PLAN_EMPHASIS_OPTIONS}
            value={emphasis}
            onChange={setEmphasis}
            hint={EMPHASIS_HINTS[emphasis]}
          />
        </div>
      </div>

      <StepFooter
        onBack={onPrev}
        onNext={handleNext}
        nextLabel="Continue"
      />
    </div>
  );
}
