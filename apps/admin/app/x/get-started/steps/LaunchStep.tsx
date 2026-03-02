"use client";

/**
 * Step 7: Launch — Review & Create
 *
 * Shows summary of all collected data, then creates/publishes everything.
 * If early-created at step 4, updates DRAFT entities and publishes.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import slugify from "slugify";
import { Loader2, Check, Rocket, ExternalLink } from "lucide-react";
import { StepFooter } from "@/components/wizards/StepFooter";
import type { StepRenderProps } from "@/components/wizards/types";

type Phase = "review" | "creating" | "done" | "error";

interface SummaryRow {
  label: string;
  value: string;
}

export function LaunchStep({ getData, setData, onNext, onPrev, endFlow }: StepRenderProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(getData<boolean>("launched") ? "done" : "review");
  const [error, setError] = useState<string | null>(null);

  const draftDomainId = getData<string>("draftDomainId");
  const isUpdate = !!draftDomainId;

  // Collect summary
  const rows: SummaryRow[] = [];
  const instName = getData<string>("institutionName") || getData<string>("existingInstitutionName");
  if (instName) rows.push({ label: "Organisation", value: instName });
  const courseName = getData<string>("courseName");
  if (courseName) rows.push({ label: "Course", value: courseName });
  const approach = getData<string>("interactionPattern");
  if (approach) rows.push({ label: "Teaching approach", value: approach.charAt(0).toUpperCase() + approach.slice(1) });
  const emphasis = getData<string>("teachingMode");
  if (emphasis) rows.push({ label: "Emphasis", value: emphasis.charAt(0).toUpperCase() + emphasis.slice(1) });
  const totals = getData<{ assertions: number }>("extractionTotals");
  if (totals) rows.push({ label: "Teaching points", value: String(totals.assertions) });
  const contentSkipped = getData<boolean>("contentSkipped");
  if (contentSkipped) rows.push({ label: "Content", value: "Skipped — add later" });
  const welcomeMsg = getData<string>("welcomeMessage");
  if (welcomeMsg) rows.push({ label: "Welcome", value: welcomeMsg.length > 60 ? welcomeMsg.slice(0, 60) + "…" : welcomeMsg });
  const sessionCount = getData<number>("sessionCount");
  const durationMins = getData<number>("durationMins");
  if (sessionCount) rows.push({ label: "Sessions", value: `${sessionCount} × ${durationMins || 30} min` });
  const planEmphasis = getData<string>("planEmphasis");
  if (planEmphasis) rows.push({ label: "Plan emphasis", value: planEmphasis.charAt(0).toUpperCase() + planEmphasis.slice(1) });
  const model = getData<string>("lessonPlanModel");
  if (model) rows.push({ label: "Lesson plan model", value: model.charAt(0).toUpperCase() + model.slice(1) });

  const handleCreate = async () => {
    setPhase("creating");
    setError(null);

    try {
      if (isUpdate) {
        // Update existing DRAFT entities with steps 5-6 data + publish
        const res = await fetch(`/api/domains/${draftDomainId}/update-and-publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            welcomeMessage: getData<string>("welcomeMessage"),
            sessionCount: getData<number>("sessionCount"),
            durationMins: getData<number>("durationMins"),
            emphasis: getData<string>("planEmphasis"),
            behaviorTargets: getData<Record<string, number>>("behaviorTargets"),
            lessonPlanModel: getData<string>("lessonPlanModel"),
          }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Failed to publish");
      } else {
        // Full creation — same flow as checkpoint but with all data
        const isExisting = !!getData<string>("existingInstitutionId");
        let domainId: string | undefined;

        if (isExisting) {
          domainId = getData<string>("existingDomainId");
        } else {
          // Check if domain was already created at ContentStep
          const earlyDomainId = getData<string>("draftDomainId");
          if (earlyDomainId) {
            domainId = earlyDomainId;
          } else {
            // Fallback: create institution (shouldn't normally happen with eager creation)
            const instName = getData<string>("institutionName") || "";
            const launchRes = await fetch("/api/institutions/launch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                institutionName: instName,
                slug: slugify(instName, { lower: true, strict: true }),
                typeSlug: getData<string>("typeSlug"),
                typeId: getData<string>("typeId"),
                websiteUrl: getData<string>("websiteUrl"),
                logoUrl: getData<string>("logoUrl"),
                primaryColor: getData<string>("primaryColor"),
                secondaryColor: getData<string>("secondaryColor"),
              }),
            });
            const reader = launchRes.body?.getReader();
            const decoder = new TextDecoder();
            if (reader) {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value);
                const lines = text.split("\n").filter((l) => l.startsWith("data: "));
                for (const line of lines) {
                  try {
                    const event = JSON.parse(line.slice(6));
                    if (event.phase === "complete" && event.detail) {
                      domainId = event.detail.domainId as string;
                    }
                  } catch { /* skip */ }
                }
              }
            }
            if (!domainId) throw new Error("Failed to create institution");
          }
        }

        // Full course setup with all data
        const setupRes = await fetch("/api/courses/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseName: getData<string>("courseName"),
            domainId,
            interactionPattern: getData<string>("interactionPattern"),
            teachingMode: getData<string>("teachingMode"),
            subjectDiscipline: getData<string>("subjectDiscipline"),
            packSubjectIds: getData<string[]>("packSubjectIds"),
            sourceId: getData<string>("sourceId"),
            learningOutcomes: [],
            teachingStyle: getData<string>("interactionPattern") || "socratic",
            sessionCount: getData<number>("sessionCount") || 5,
            durationMins: getData<number>("durationMins") || 30,
            emphasis: getData<string>("planEmphasis") || "balanced",
            welcomeMessage: getData<string>("welcomeMessage") || "",
            studentEmails: [],
            behaviorTargets: getData<Record<string, number>>("behaviorTargets"),
            lessonPlanModel: getData<string>("lessonPlanModel"),
          }),
        });
        const data = await setupRes.json();
        if (!data.ok) throw new Error(data.error || "Failed to create course");

        setData("draftDomainId", data.domainId || domainId);
        setData("draftPlaybookId", data.playbookId);
        setData("draftCallerId", data.callerId);
      }

      setData("launched", true);
      setPhase("done");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setPhase("error");
    }
  };

  const callerId = getData<string>("draftCallerId");
  const domainIdForDash = getData<string>("draftDomainId") || getData<string>("existingDomainId");

  return (
    <div className="hf-wizard-page">
      <div className="hf-wizard-step">
        {phase === "review" && (
          <>
            <div className="hf-mb-lg">
              <h1 className="hf-page-title hf-mb-xs">Review &amp; launch</h1>
              <p className="hf-page-subtitle">
                {isUpdate
                  ? "Update your draft and publish the course."
                  : "Everything looks good? Let's create your AI tutor."}
              </p>
            </div>

            <div className="hf-card hf-mb-lg" style={{ padding: 0 }}>
              {rows.map((row, i) => (
                <div
                  key={i}
                  className="hf-flex"
                  style={{
                    justifyContent: "space-between",
                    padding: "10px 16px",
                    borderBottom: i < rows.length - 1 ? "1px solid var(--border-default)" : undefined,
                  }}
                >
                  <span className="hf-text-sm hf-text-muted">{row.label}</span>
                  <span className="hf-text-sm" style={{ fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {phase === "creating" && (
          <div className="hf-flex hf-items-center hf-gap-sm" style={{ padding: "40px 0" }}>
            <Loader2 size={20} className="hf-spinner" />
            <span>{isUpdate ? "Publishing course..." : "Creating your AI tutor..."}</span>
          </div>
        )}

        {phase === "error" && (
          <>
            <div className="hf-banner hf-banner-error hf-mb-lg">
              {error}
            </div>
            <StepFooter
              onBack={() => setPhase("review")}
              onNext={handleCreate}
              nextLabel="Retry"
            />
          </>
        )}

        {phase === "done" && (
          <>
            <div className="hf-mb-lg">
              <h1 className="hf-page-title hf-mb-xs">
                <Check size={20} style={{ display: "inline", verticalAlign: "middle", marginRight: 8, color: "var(--status-success-text)" }} />
                Your AI tutor is live
              </h1>
              <p className="hf-page-subtitle">
                {getData<string>("courseName")} is ready for its first student.
              </p>
            </div>

            <div className="hf-mb-lg" style={{ display: "flex", gap: 12 }}>
              {callerId && (
                <a
                  href={`/x/sim/${callerId}`}
                  className="hf-btn hf-btn-primary"
                  style={{ flex: 1, textAlign: "center" }}
                >
                  <Rocket size={16} />
                  Try a Sim Call
                </a>
              )}
              <button
                type="button"
                className="hf-btn hf-btn-secondary"
                onClick={() => {
                  endFlow();
                  router.push(domainIdForDash ? `/x/domains?id=${domainIdForDash}` : "/x/domains");
                }}
                style={{ flex: 1 }}
              >
                <ExternalLink size={16} />
                Go to Dashboard
              </button>
            </div>
          </>
        )}

        {phase === "review" && (
          <StepFooter
            onBack={onPrev}
            onNext={handleCreate}
            nextLabel={isUpdate ? "Publish Course" : "Create AI Tutor"}
            nextIcon={<Rocket size={16} />}
          />
        )}
      </div>
    </div>
  );
}
