"use client";

/**
 * RefPreviewPanel — Live preview of the course reference document.
 *
 * Shows section checklist with progress indicators and
 * expanding detail for completed/in-progress sections.
 */

import { useMemo } from "react";
import { Check, Circle, Loader2 } from "lucide-react";
import type { CourseRefData } from "@/lib/content-trust/course-ref-to-assertions";

interface RefPreviewPanelProps {
  refData: CourseRefData;
}

interface SectionInfo {
  key: string;
  label: string;
  status: "complete" | "partial" | "empty";
  mandatory: boolean;
}

function evaluatePreviewSections(data: CourseRefData): SectionInfo[] {
  return [
    {
      key: "courseOverview",
      label: "Course Overview",
      status: data.courseOverview?.subject ? "complete" : data.courseOverview ? "partial" : "empty",
      mandatory: false,
    },
    {
      key: "learningOutcomes",
      label: "Learning Outcomes",
      status: data.learningOutcomes?.skillOutcomes?.length ? "complete" : "empty",
      mandatory: false,
    },
    {
      key: "skillsFramework",
      label: "Skills Framework",
      status: data.skillsFramework?.length
        ? data.skillsFramework.every((s) => s.tiers?.emerging) ? "complete" : "partial"
        : "empty",
      mandatory: true,
    },
    {
      key: "teachingApproach",
      label: "Teaching Approach",
      status: data.teachingApproach?.corePrinciples?.length
        ? (data.teachingApproach.corePrinciples.length >= 2 ? "complete" : "partial")
        : "empty",
      mandatory: true,
    },
    {
      key: "coursePhases",
      label: "Course Phases",
      status: data.coursePhases?.length ? "complete" : "empty",
      mandatory: false,
    },
    {
      key: "edgeCases",
      label: "Edge Cases",
      status: data.edgeCases?.length
        ? (data.edgeCases.length >= 2 ? "complete" : "partial")
        : "empty",
      mandatory: true,
    },
    {
      key: "communicationRules",
      label: "Communication",
      status: data.communicationRules?.toStudent?.tone ? "complete" : "empty",
      mandatory: false,
    },
    {
      key: "assessmentBoundaries",
      label: "Assessment",
      status: data.assessmentBoundaries?.length ? "complete" : "empty",
      mandatory: false,
    },
    {
      key: "metrics",
      label: "Metrics",
      status: data.metrics?.length ? "complete" : "empty",
      mandatory: false,
    },
  ];
}

function StatusIcon({ status }: { status: SectionInfo["status"] }) {
  switch (status) {
    case "complete":
      return <Check className="w-4 h-4 text-emerald-500" />;
    case "partial":
      return <Loader2 className="w-4 h-4 text-amber-500" />;
    case "empty":
      return <Circle className="w-4 h-4 text-hf-text-muted/30" />;
  }
}

export function RefPreviewPanel({ refData }: RefPreviewPanelProps) {
  const sections = useMemo(() => evaluatePreviewSections(refData), [refData]);
  const complete = sections.filter((s) => s.status === "complete").length;
  const total = sections.length;

  return (
    <div className="p-4 space-y-6">
      {/* Header + Progress */}
      <div>
        <h2 className="text-sm font-semibold text-hf-text mb-2">Course Reference</h2>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-hf-border overflow-hidden">
            <div
              className="h-full rounded-full bg-hf-primary transition-all duration-300"
              style={{ width: `${(complete / total) * 100}%` }}
            />
          </div>
          <span className="text-xs text-hf-text-muted">{complete}/{total}</span>
        </div>
      </div>

      {/* Section Checklist */}
      <div className="space-y-1">
        {sections.map((s) => (
          <div
            key={s.key}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm ${
              s.status !== "empty" ? "bg-hf-surface-hover" : ""
            }`}
          >
            <StatusIcon status={s.status} />
            <span className={s.status === "empty" ? "text-hf-text-muted" : "text-hf-text"}>
              {s.label}
            </span>
            {s.mandatory && s.status !== "complete" && (
              <span className="text-[10px] text-amber-600 font-medium ml-auto">required</span>
            )}
          </div>
        ))}
      </div>

      {/* Section Details */}
      <div className="space-y-4">
        {/* Skills Framework */}
        {refData.skillsFramework?.length ? (
          <SectionDetail title="Skills Framework">
            {refData.skillsFramework.map((skill) => (
              <div key={skill.id} className="space-y-1">
                <p className="text-xs font-medium text-hf-text">{skill.id}: {skill.name}</p>
                {skill.tiers && (
                  <div className="text-[11px] text-hf-text-muted space-y-0.5 pl-2">
                    {skill.tiers.emerging && <p>E: {skill.tiers.emerging}</p>}
                    {skill.tiers.developing && <p>D: {skill.tiers.developing}</p>}
                    {skill.tiers.secure && <p>S: {skill.tiers.secure}</p>}
                  </div>
                )}
              </div>
            ))}
          </SectionDetail>
        ) : null}

        {/* Teaching Approach */}
        {refData.teachingApproach?.corePrinciples?.length ? (
          <SectionDetail title="Teaching Rules">
            {refData.teachingApproach.corePrinciples.map((p, i) => (
              <p key={i} className="text-[11px] text-hf-text-muted">• {p}</p>
            ))}
          </SectionDetail>
        ) : null}

        {/* Session Structure */}
        {refData.teachingApproach?.sessionStructure?.phases?.length ? (
          <SectionDetail title="Session Structure">
            {refData.teachingApproach.sessionStructure.phases.map((p, i) => (
              <p key={i} className="text-[11px] text-hf-text-muted">
                {p.name}{p.duration ? ` (${p.duration})` : ""}
              </p>
            ))}
          </SectionDetail>
        ) : null}

        {/* Edge Cases */}
        {refData.edgeCases?.length ? (
          <SectionDetail title="Edge Cases">
            {refData.edgeCases.map((ec, i) => (
              <p key={i} className="text-[11px] text-hf-text-muted">
                <strong>{ec.scenario}:</strong> {ec.response}
              </p>
            ))}
          </SectionDetail>
        ) : null}

        {/* Course Phases */}
        {refData.coursePhases?.length ? (
          <SectionDetail title="Course Phases">
            {refData.coursePhases.map((p, i) => (
              <div key={i}>
                <p className="text-xs font-medium text-hf-text">{p.name}</p>
                {p.goal && <p className="text-[11px] text-hf-text-muted">{p.goal}</p>}
              </div>
            ))}
          </SectionDetail>
        ) : null}
      </div>
    </div>
  );
}

function SectionDetail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-hf-border pt-3">
      <h3 className="text-xs font-semibold text-hf-text mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
