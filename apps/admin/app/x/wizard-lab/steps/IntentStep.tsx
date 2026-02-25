"use client";

// ── IntentStep ── Sync step: captures user intent via form fields.
// Validates: ChipSelect, StepFooter, data bag persistence.

import { useState } from "react";
import { ChipSelect } from "@/components/shared/ChipSelect";
import { StepFooter } from "@/components/wizards/StepFooter";
import type { StepRenderProps } from "@/components/wizards/types";

const EMPHASIS_OPTIONS = [
  { value: "breadth" as const, label: "Breadth-first" },
  { value: "balanced" as const, label: "Balanced" },
  { value: "depth" as const, label: "Depth-first" },
];

const DURATION_OPTIONS = [
  { value: "15" as const, label: "15 min" },
  { value: "30" as const, label: "30 min" },
  { value: "45" as const, label: "45 min" },
  { value: "60" as const, label: "60 min" },
];

const EMPHASIS_HINTS: Record<string, string> = {
  breadth: "Cover all topics at surface level first, then deepen.",
  balanced: "Mix of breadth and depth \u2014 the AI decides per module.",
  depth: "Go deep on each topic before moving on.",
};

export function IntentStep({ getData, setData, onNext, isFirst }: StepRenderProps) {
  const [name, setName] = useState(getData<string>("labName") || "");
  const [emphasis, setEmphasis] = useState(getData<string>("labEmphasis") || "balanced");
  const [duration, setDuration] = useState(getData<string>("labDuration") || "30");

  const handleNext = () => {
    setData("labName", name.trim());
    setData("labEmphasis", emphasis);
    setData("labDuration", duration);
    onNext();
  };

  return (
    <div className="hf-wizard-step">
      <h1 className="hf-page-title">What do you want to test?</h1>
      <p className="hf-page-subtitle" style={{ marginBottom: 24 }}>
        This is the Wizard Lab \u2014 a living reference for the gold-standard wizard framework.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Text input */}
        <div>
          <label className="hf-label" style={{ marginBottom: 8, display: "block" }}>
            Topic name
          </label>
          <input
            className="hf-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Photosynthesis, French Revolution..."
          />
        </div>

        {/* Chip selectors */}
        <ChipSelect
          label="Teaching emphasis"
          options={EMPHASIS_OPTIONS}
          value={emphasis}
          onChange={setEmphasis}
          hint={EMPHASIS_HINTS[emphasis]}
        />

        <ChipSelect
          label="Session duration"
          options={DURATION_OPTIONS}
          value={duration}
          onChange={setDuration}
        />
      </div>

      <StepFooter
        onNext={handleNext}
        nextDisabled={!name.trim()}
        onBack={isFirst ? undefined : undefined}
      />
    </div>
  );
}
