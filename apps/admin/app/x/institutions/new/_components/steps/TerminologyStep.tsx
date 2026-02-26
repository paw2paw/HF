"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
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

// Static fallback — mirrors seed-institution-types.ts for the 5 preview keys.
// Used when the DB type has no terminology configured yet.
const STATIC_TERMINOLOGY: Record<string, Record<string, string>> = {
  school:     { domain: "School",        playbook: "Lesson Plan",    caller: "Student",     instructor: "Teacher",    session: "Lesson" },
  corporate:  { domain: "Organization",  playbook: "Training Plan",  caller: "Employee",    instructor: "Trainer",    session: "Training Session" },
  community:  { domain: "Hub",           playbook: "Programme",      caller: "Member",      instructor: "Facilitator",session: "Call" },
  coaching:   { domain: "Practice",      playbook: "Coaching Plan",  caller: "Client",      instructor: "Coach",      session: "Coaching Session" },
  healthcare: { domain: "Facility",      playbook: "Care Plan",      caller: "Patient",     instructor: "Provider",   session: "Patient Session" },
  training:   { domain: "Academy",       playbook: "Course",         caller: "Participant", instructor: "Trainer",    session: "Training Session" },
};

export function TerminologyStep({ getData, onNext, onPrev }: StepRenderProps) {
  const typeSlug = getData<string>("typeSlug") ?? null;
  const [terminology, setTerminology] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (!typeSlug || fetched.current) return;
    fetched.current = true;
    fetch("/api/admin/institution-types")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.types) {
          const match = data.types.find((t: { slug: string }) => t.slug === typeSlug);
          // DB terminology takes priority; fall back to static presets
          const terms = match?.terminology || STATIC_TERMINOLOGY[typeSlug] || null;
          if (terms) setTerminology(terms);
        }
      })
      .catch(() => {
        // API failed — try static fallback
        const terms = STATIC_TERMINOLOGY[typeSlug] || null;
        if (terms) setTerminology(terms);
      })
      .finally(() => setLoading(false));
  }, [typeSlug]);

  return (
    <div>
      <FieldHint label="Terminology" hint={WIZARD_HINTS["institution.terminology"]} />
      <p className="ws-hint" style={{ marginTop: 4 }}>
        Pre-filled from your institution type. You can customise these later in settings.
      </p>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
          <Loader2 size={14} className="hf-spinner" />
          Loading terminology…
        </div>
      ) : terminology ? (
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
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
          No terminology preset found for this type. You can configure labels in Settings after creation.
        </p>
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
