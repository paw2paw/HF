"use client";

import { WizardShell } from "@/components/wizards/WizardShell";
import type { WizardConfig, StepRenderProps } from "@/components/wizards/types";
import { IdentityStep } from "./_components/steps/IdentityStep";
import { BrandingStep } from "./_components/steps/BrandingStep";
import { WelcomeStep } from "./_components/steps/WelcomeStep";
import { TerminologyStep } from "./_components/steps/TerminologyStep";
import { LaunchStep } from "./_components/steps/LaunchStep";
import type { ComponentType } from "react";
import "./institution-wizard.css";

type S = ComponentType<StepRenderProps>;

const config: WizardConfig = {
  flowId: "institution-setup",
  wizardName: "institution",
  returnPath: "/x/institutions",
  cancelLabel: "Institutions",
  steps: [
    {
      id: "identity",
      label: "Institution",
      activeLabel: "Tell us about your institution",
      component: IdentityStep as S,
      summaryLabel: "Institution",
      summary: (getData) => {
        const name = getData<string>("institutionName");
        const slug = getData<string>("typeSlug");
        return `${name ?? "Unnamed"}${slug ? ` · ${slug}` : ""}`;
      },
    },
    {
      id: "branding",
      label: "Branding",
      activeLabel: "Make it yours",
      component: BrandingStep as S,
      summaryLabel: "Branding",
      summary: (getData) => (getData<string>("primaryColor") ? "Custom branding" : "Default"),
    },
    {
      id: "welcome",
      label: "Welcome",
      activeLabel: "Welcome message",
      component: WelcomeStep as S,
      summaryLabel: "Welcome",
      summary: (getData) => {
        const m = getData<string>("welcomeMessage");
        return m ? `${m.slice(0, 40)}${m.length > 40 ? "…" : ""}` : "Default";
      },
    },
    {
      id: "terminology",
      label: "Terminology",
      activeLabel: "Reviewing terminology",
      component: TerminologyStep as S,
      summaryLabel: "Terminology",
      summary: (getData) => `${getData<string>("typeSlug") ?? "Default"} preset`,
    },
    {
      id: "launch",
      label: "Launch",
      activeLabel: "Creating institution",
      component: LaunchStep as S,
    },
  ],
};

export default function InstitutionNewPage() {
  return <WizardShell config={config} />;
}
