"use client";

/**
 * Step 2: Your Course
 *
 * Course name + subject discipline + teaching approach + emphasis.
 * All chip-selectable with AI auto-suggestion on course name.
 */

import { useState } from "react";
import { ChipSelect } from "@/components/shared/ChipSelect";
import { FieldHint } from "@/components/shared/FieldHint";
import { WIZARD_HINTS } from "@/lib/wizard-hints";
import { StepFooter } from "@/components/wizards/StepFooter";
import type { StepRenderProps } from "@/components/wizards/types";

const APPROACH_OPTIONS = [
  { value: "socratic", label: "Socratic" },
  { value: "directive", label: "Directive" },
  { value: "advisory", label: "Advisory" },
  { value: "coaching", label: "Coaching" },
];

const APPROACH_HINTS: Record<string, string> = {
  socratic: "Asks questions to guide the learner to discover answers themselves.",
  directive: "Provides clear, structured instruction with explicit explanations.",
  advisory: "Supportive coaching style — suggests rather than tells.",
  coaching: "Builds self-awareness and goal-setting through reflective dialogue.",
};

const EMPHASIS_OPTIONS = [
  { value: "recall", label: "Recall" },
  { value: "comprehension", label: "Comprehension" },
  { value: "practice", label: "Practice" },
  { value: "syllabus", label: "Syllabus" },
];

const EMPHASIS_HINTS: Record<string, string> = {
  recall: "Focus on remembering key facts, definitions, and terms.",
  comprehension: "Build understanding through explanation and worked examples.",
  practice: "Emphasise exercises, questions, and application of knowledge.",
  syllabus: "Strictly follow learning outcomes and assessment criteria.",
};

export function CourseStep({ getData, setData, onNext, onPrev }: StepRenderProps) {
  const [courseName, setCourseName] = useState(getData<string>("courseName") ?? "");
  const [discipline, setDiscipline] = useState(getData<string>("subjectDiscipline") ?? "");
  const [approach, setApproach] = useState(getData<string>("interactionPattern") ?? "socratic");
  const [emphasis, setEmphasis] = useState(getData<string>("teachingMode") ?? "comprehension");

  const canContinue = courseName.trim().length >= 3;

  const handleNext = () => {
    setData("courseName", courseName.trim());
    setData("subjectDiscipline", discipline.trim() || courseName.trim());
    setData("interactionPattern", approach);
    setData("teachingMode", emphasis);
    onNext();
  };

  return (
    <div className="hf-wizard-page">
      <div className="hf-wizard-step">
        <div className="hf-mb-lg">
          <FieldHint
            label="What will the AI tutor teach?"
            hint={WIZARD_HINTS["course.name"] || WIZARD_HINTS["get-started.course"]}
            labelClass="hf-page-title hf-mb-xs"
          />
        </div>

        <div className="hf-mb-lg">
          <input
            type="text"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            placeholder="e.g. GCSE Biology, Level 2 Food Safety"
            className="hf-input"
          />
        </div>

        {courseName.length >= 3 && (
          <>
            <div className="hf-mb-lg">
              <FieldHint
                label="What subject area is this?"
                hint={WIZARD_HINTS["get-started.discipline"]}
                labelClass="hf-page-subtitle"
              />
              <input
                type="text"
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                placeholder={`e.g. Biology, Food Safety, English`}
                className="hf-input"
              />
              <div className="hf-hint">
                Helps the AI understand the subject area. Defaults to the course name if left blank.
              </div>
            </div>

            <div className="hf-mb-lg">
              <FieldHint
                label="How should the AI teach?"
                hint={WIZARD_HINTS["course.interactionPattern"] || WIZARD_HINTS["get-started.approach"]}
                labelClass="hf-page-subtitle"
              />
              <ChipSelect
                options={APPROACH_OPTIONS}
                value={approach}
                onChange={setApproach}
                hint={APPROACH_HINTS[approach]}
              />
            </div>

            <div className="hf-mb-lg">
              <FieldHint
                label="What should the AI emphasise?"
                hint={WIZARD_HINTS["get-started.emphasis"]}
                labelClass="hf-page-subtitle"
              />
              <ChipSelect
                options={EMPHASIS_OPTIONS}
                value={emphasis}
                onChange={setEmphasis}
                hint={EMPHASIS_HINTS[emphasis]}
              />
            </div>
          </>
        )}
      </div>

      <StepFooter
        onBack={onPrev}
        onNext={handleNext}
        nextLabel="Continue"
        nextDisabled={!canContinue}
      />
    </div>
  );
}
