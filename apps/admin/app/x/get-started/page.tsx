"use client";

/**
 * Get Started — guided onboarding wizard
 *
 * Two-column layout: WizardShell (left) + ScaffoldPanel (right).
 * 7 steps: Institution → Course → Content → Checkpoint → Welcome → Tune → Launch
 */

import { WizardShell } from "@/components/wizards/WizardShell";
import type { WizardConfig, StepRenderProps, DoneContentItem } from "@/components/wizards/types";
import { useStepFlow } from "@/contexts/StepFlowContext";
import { InstitutionStep } from "./steps/InstitutionStep";
import { CourseStep } from "./steps/CourseStep";
import { ContentStep } from "./steps/ContentStep";
import { CheckpointStep } from "./steps/CheckpointStep";
import { WelcomeStep } from "./steps/WelcomeStep";
import { TuneStep } from "./steps/TuneStep";
import { LaunchStep } from "./steps/LaunchStep";
import { ScaffoldPanel } from "./components/ScaffoldPanel";
import type { ComponentType } from "react";
import "./get-started.css";

type S = ComponentType<StepRenderProps>;

const config: WizardConfig = {
  flowId: "get-started",
  wizardName: "get-started",
  returnPath: "/x/domains",
  cancelLabel: "Dashboard",
  steps: [
    {
      id: "institution",
      label: "Organisation",
      activeLabel: "Tell us about your organisation",
      component: InstitutionStep as S,
      summaryLabel: "Organisation",
      summary: (getData) => {
        const name = getData<string>("institutionName") || getData<string>("existingInstitutionName");
        const slug = getData<string>("typeSlug");
        return `${name ?? "Unnamed"}${slug ? ` · ${slug}` : ""}`;
      },
      doneContent: (getData) => {
        const items: DoneContentItem[] = [];
        const name = getData<string>("institutionName") || getData<string>("existingInstitutionName");
        if (name) items.push({ label: "Name", value: name });
        const slug = getData<string>("typeSlug");
        if (slug) items.push({ label: "Type", value: slug.charAt(0).toUpperCase() + slug.slice(1) });
        return items;
      },
    },
    {
      id: "course",
      label: "Course",
      activeLabel: "What are we teaching?",
      component: CourseStep as S,
      summaryLabel: "Course",
      summary: (getData) => getData<string>("courseName") ?? "Unnamed",
      doneContent: (getData) => {
        const items: DoneContentItem[] = [];
        const name = getData<string>("courseName");
        if (name) items.push({ label: "Course", value: name });
        const approach = getData<string>("interactionPattern");
        if (approach) items.push({ label: "Approach", value: approach.charAt(0).toUpperCase() + approach.slice(1) });
        const mode = getData<string>("teachingMode");
        if (mode) items.push({ label: "Emphasis", value: mode.charAt(0).toUpperCase() + mode.slice(1) });
        return items;
      },
    },
    {
      id: "content",
      label: "Content",
      activeLabel: "Upload your teaching materials",
      component: ContentStep as S,
      summaryLabel: "Content",
      summary: (getData) => {
        if (getData<boolean>("contentSkipped")) return "Skipped";
        const totals = getData<{ assertions: number }>("extractionTotals");
        if (totals) return `${totals.assertions} teaching points`;
        return "No content";
      },
    },
    {
      id: "checkpoint",
      label: "Ready to Test",
      activeLabel: "Ready to try your AI tutor",
      component: CheckpointStep as S,
      summaryLabel: "Checkpoint",
      summary: (getData) => getData<string>("draftDomainId") ? "Draft created" : "Pending",
    },
    {
      id: "welcome",
      label: "Welcome & Sessions",
      activeLabel: "How should the first call feel?",
      component: WelcomeStep as S,
      summaryLabel: "Welcome",
      summary: (getData) => {
        const count = getData<number>("sessionCount");
        const dur = getData<number>("durationMins");
        if (count) return `${count} × ${dur || 30} min`;
        return "Not configured";
      },
    },
    {
      id: "tune",
      label: "Fine-Tune",
      activeLabel: "Adjust the AI personality",
      component: TuneStep as S,
      summaryLabel: "Fine-Tune",
      summary: (getData) => {
        const model = getData<string>("lessonPlanModel");
        return model ? model.charAt(0).toUpperCase() + model.slice(1) : "Defaults";
      },
    },
    {
      id: "launch",
      label: "Launch",
      activeLabel: "Review & create",
      component: LaunchStep as S,
    },
  ],
};

function GetStartedInner() {
  const { state, getData } = useStepFlow();
  const currentStep = state?.currentStep ?? 0;

  return (
    <div className="gs-layout">
      <div className="gs-main">
        <WizardShell config={config} />
      </div>
      <ScaffoldPanel getData={getData} currentStepIndex={currentStep} />
    </div>
  );
}

export default function GetStartedPage() {
  return <GetStartedInner />;
}
