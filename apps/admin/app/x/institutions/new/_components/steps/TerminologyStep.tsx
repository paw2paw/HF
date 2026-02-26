"use client";

import { useState, useEffect, useRef } from "react";
import { FieldHint } from "@/components/shared/FieldHint";
import { WIZARD_HINTS } from "@/lib/wizard-hints";
import { StepFooter } from "@/components/wizards/StepFooter";
import type { StepRenderProps } from "@/components/wizards/types";

const TERM_PREVIEW_KEYS = [
  { key: "domain", label: "Institution" },
  { key: "playbook", label: "Course" },
  { key: "caller", label: "Learner" },
  { key: "instructor", label: "Instructor" },
  { key: "session", label: "Session" },
] as const;

export function TerminologyStep({ getData, onNext, onPrev }: StepRenderProps) {
  const typeSlug = getData<string>("typeSlug") ?? null;
  const [terminology, setTerminology] = useState<Record<string, string> | null>(null);
  const fetched = useRef(false);

  useEffect(() => {
    if (!typeSlug || fetched.current) return;
    fetched.current = true;
    fetch("/api/admin/institution-types")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.types) {
          const match = data.types.find((t: { slug: string }) => t.slug === typeSlug);
          if (match?.terminology) setTerminology(match.terminology);
        }
      })
      .catch(() => {});
  }, [typeSlug]);

  return (
    <div>
      <FieldHint label="Terminology" hint={WIZARD_HINTS["institution.terminology"]} />
      <p className="ws-hint" style={{ marginTop: 4 }}>
        Pre-filled from your institution type. You can customise these later in settings.
      </p>

      {terminology ? (
        <table className="iw-term-table">
          <thead>
            <tr>
              <th>Concept</th>
              <th>Your Label</th>
            </tr>
          </thead>
          <tbody>
            {TERM_PREVIEW_KEYS.map(({ key, label }) => (
              <tr key={key}>
                <td className="iw-term-key">{label}</td>
                <td>{terminology[key] || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Default terminology will be used.</p>
      )}

      <StepFooter
        onBack={onPrev}
        onSkip={onNext}
        skipLabel="Skip"
        onNext={onNext}
        nextLabel="Continue"
      />
    </div>
  );
}
