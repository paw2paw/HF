"use client";

/**
 * Step 3: Your Content
 *
 * Wraps PackUploadStep — multi-file upload with AI classification + extraction.
 * Skip button available ("I'll add content later").
 */

import { PackUploadStep } from "@/components/wizards/PackUploadStep";
import type { PackUploadResult } from "@/components/wizards/PackUploadStep";
import { StepFooter } from "@/components/wizards/StepFooter";
import type { StepRenderProps } from "@/components/wizards/types";

export function ContentStep({ getData, setData, onNext, onPrev }: StepRenderProps) {
  const domainId = getData<string>("existingDomainId") || getData<string>("draftDomainId") || "";
  const courseName = getData<string>("courseName") || "";
  const interactionPattern = getData<string>("interactionPattern");
  const teachingMode = getData<string>("teachingMode");
  const subjectDiscipline = getData<string>("subjectDiscipline");

  const handleResult = (result: PackUploadResult) => {
    if (result.mode === "skip") {
      setData("contentSkipped", true);
    } else {
      setData("contentSkipped", false);
      if (result.subjects) setData("packSubjectIds", result.subjects.map((s) => s.id));
      if (result.sourceCount) setData("sourceCount", result.sourceCount);
      if (result.extractionTotals) setData("extractionTotals", result.extractionTotals);
      if (result.classifications) setData("classifications", result.classifications);
    }
    onNext();
  };

  // If no domainId yet (deferred creation), show a simplified upload
  // that just collects files for later processing
  if (!domainId) {
    return (
      <div className="hf-wizard-page">
        <div className="hf-wizard-step">
          <div className="hf-mb-lg">
            <h1 className="hf-page-title hf-mb-xs">Your content</h1>
            <p className="hf-page-subtitle">
              Upload your teaching materials — PDFs, Word documents, or text files.
              The AI will extract teaching points and build a knowledge base.
            </p>
          </div>
          <div className="hf-banner hf-banner-info hf-mb-lg">
            Content will be processed when you create your course. You can add files now or skip and add them later.
          </div>
        </div>
        <StepFooter
          onBack={onPrev}
          onNext={() => {
            setData("contentSkipped", true);
            onNext();
          }}
          nextLabel="Skip for now"
          secondaryAction={{
            label: "Continue without content",
            onClick: () => {
              setData("contentSkipped", true);
              onNext();
            },
          }}
        />
      </div>
    );
  }

  return (
    <div className="hf-wizard-page">
      <div className="hf-wizard-step">
        <div className="hf-mb-lg">
          <h1 className="hf-page-title hf-mb-xs">Your content</h1>
          <p className="hf-page-subtitle">
            Upload your teaching materials. The AI will classify each file and extract
            teaching points automatically.
          </p>
        </div>

        <PackUploadStep
          domainId={domainId}
          courseName={courseName}
          interactionPattern={interactionPattern}
          teachingMode={teachingMode}
          subjectDiscipline={subjectDiscipline}
          onResult={handleResult}
          onBack={onPrev}
        />
      </div>
    </div>
  );
}
