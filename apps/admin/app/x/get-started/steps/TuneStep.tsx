"use client";

/**
 * Step 6: Fine-Tune (optional, skippable)
 *
 * Behavior target sliders + lesson plan model chips.
 */

import { useState } from "react";
import { ChipSelect } from "@/components/shared/ChipSelect";
import { FieldHint } from "@/components/shared/FieldHint";
import { WIZARD_HINTS } from "@/lib/wizard-hints";
import { StepFooter } from "@/components/wizards/StepFooter";
import type { StepRenderProps } from "@/components/wizards/types";

const MODEL_OPTIONS = [
  { value: "direct", label: "Direct Instruction" },
  { value: "5e", label: "5E" },
  { value: "spiral", label: "Spiral" },
  { value: "mastery", label: "Mastery" },
  { value: "project", label: "Project-Based" },
];

const MODEL_HINTS: Record<string, string> = {
  direct: "Structured, teacher-led. Explain → model → guided practice → independent practice.",
  "5e": "Engage → Explore → Explain → Elaborate → Evaluate. Great for science.",
  spiral: "Revisit topics repeatedly with increasing complexity over time.",
  mastery: "Must demonstrate mastery of each topic before advancing to the next.",
  project: "Learn through real-world projects. Good for applied/vocational courses.",
};

interface SliderConfig {
  key: string;
  label: string;
  low: string;
  high: string;
}

const SLIDERS: SliderConfig[] = [
  { key: "warmth", label: "Warmth", low: "Professional", high: "Warm & friendly" },
  { key: "directiveness", label: "Directiveness", low: "Guided discovery", high: "Direct instruction" },
  { key: "pace", label: "Pace", low: "Slower, thorough", high: "Faster, efficient" },
  { key: "encouragement", label: "Encouragement", low: "Measured", high: "Highly encouraging" },
];

export function TuneStep({ getData, setData, onNext, onPrev }: StepRenderProps) {
  const savedTargets = getData<Record<string, number>>("behaviorTargets");
  const [targets, setTargets] = useState<Record<string, number>>(
    savedTargets ?? {
      warmth: 0.6,
      directiveness: 0.5,
      pace: 0.5,
      encouragement: 0.7,
    },
  );
  const [model, setModel] = useState(getData<string>("lessonPlanModel") ?? "direct");

  const handleSlider = (key: string, value: number) => {
    setTargets((prev) => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    setData("behaviorTargets", targets);
    setData("lessonPlanModel", model);
    onNext();
  };

  const handleSkip = () => {
    // Don't save targets — use defaults
    setData("lessonPlanModel", model);
    onNext();
  };

  return (
    <div className="hf-wizard-page">
      <div className="hf-wizard-step">
        <div className="hf-mb-lg">
          <h1 className="hf-page-title hf-mb-xs">Fine-tune the AI</h1>
          <p className="hf-page-subtitle">Adjust personality and teaching model. Skip to use defaults.</p>
        </div>

        <div className="hf-mb-lg">
          <div className="hf-label" style={{ marginBottom: 12 }}>Tutor personality</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {SLIDERS.map((s) => (
              <div key={s.key}>
                <div className="hf-flex" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                  <span className="hf-text-sm" style={{ color: "var(--text-muted)" }}>{s.low}</span>
                  <span className="hf-text-sm" style={{ fontWeight: 500 }}>{s.label}</span>
                  <span className="hf-text-sm" style={{ color: "var(--text-muted)" }}>{s.high}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={targets[s.key] ?? 0.5}
                  onChange={(e) => handleSlider(s.key, parseFloat(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="hf-mb-lg">
          <FieldHint
            label="Lesson plan model"
            hint={WIZARD_HINTS["get-started.model"]}
            labelClass="hf-label"
          />
          <ChipSelect
            options={MODEL_OPTIONS}
            value={model}
            onChange={setModel}
            hint={MODEL_HINTS[model]}
          />
        </div>
      </div>

      <StepFooter
        onBack={onPrev}
        onNext={handleNext}
        nextLabel="Continue"
        onSkip={handleSkip}
        skipLabel="Skip — use defaults"
      />
    </div>
  );
}
