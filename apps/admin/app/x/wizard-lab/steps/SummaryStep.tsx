"use client";

// ── SummaryStep ── Final step: shows WizardSummary with what was created.
// Validates: WizardSummary component, endFlow, data bag reads.

import { useRouter } from "next/navigation";
import { WizardSummary } from "@/components/shared/WizardSummary";
import { BookOpen, PlayCircle } from "lucide-react";
import type { StepRenderProps } from "@/components/wizards/types";

interface GeneratedModule {
  id: string;
  title: string;
  description: string;
  learningOutcomes?: string[];
}

export function SummaryStep({ getData, endFlow }: StepRenderProps) {
  const router = useRouter();

  const name = getData<string>("labName") || "Unknown";
  const emphasis = getData<string>("labEmphasis") || "balanced";
  const duration = getData<string>("labDuration") || "30";
  const modules = getData<GeneratedModule[]>("labModules") || [];

  const totalOutcomes = modules.reduce(
    (sum, m) => sum + (m.learningOutcomes?.length ?? 0),
    0,
  );

  return (
    <div className="hf-wizard-step">
      <WizardSummary
        title="Wizard Lab Complete!"
        subtitle="This is what the gold-standard wizard framework produced."
        intent={{
          items: [
            {
              icon: <BookOpen className="w-4 h-4" />,
              label: "Topic",
              value: name,
            },
            { label: "Emphasis", value: emphasis },
            { label: "Duration", value: `${duration} min` },
          ],
        }}
        stats={[
          { label: "Modules", value: modules.length },
          { label: "Outcomes", value: totalOutcomes },
          { label: "Duration", value: `${duration}m` },
        ]}
        primaryAction={{
          label: "Done",
          icon: <PlayCircle className="w-5 h-5" />,
          onClick: () => {
            endFlow();
            router.push("/x/wizard-lab");
          },
        }}
        secondaryActions={[
          {
            label: "Run Again",
            onClick: () => {
              endFlow();
              // Page re-renders, WizardShell re-initializes fresh
              router.push("/x/wizard-lab");
            },
          },
        ]}
      />
    </div>
  );
}
