"use client";

import { useHolo } from "@/hooks/useHolographicState";
import { getSectionMeta } from "@/lib/holographic/section-labels";
import { canEdit } from "@/lib/holographic/permissions";
import type { SectionId } from "@/lib/holographic/permissions";
import {
  Fingerprint,
  BookOpen,
  SlidersHorizontal,
  Rocket,
  Phone,
  CheckCircle,
  Network,
  Sparkles,
} from "lucide-react";

// Icon mapping — Lucide components keyed by icon name from section-labels
const ICONS: Record<string, React.ElementType> = {
  Fingerprint,
  BookOpen,
  Sliders: SlidersHorizontal,
  Rocket,
  Phone,
  CheckCircle,
  Network,
  Sparkles,
};

export function HoloEditor() {
  const { state } = useHolo();
  const { activeSection, role, sectionLoading } = state;

  const meta = getSectionMeta(activeSection, role);
  const editable = canEdit(activeSection, role);
  const loading = sectionLoading.includes(activeSection);
  const Icon = ICONS[meta.icon];

  return (
    <main className="hp-editor">
      <div className="hp-editor-content">
        <h1 className="hp-editor-title">{meta.label}</h1>
        <p className="hp-editor-tagline">{meta.tagline}</p>

        {loading ? (
          <div className="hp-section-placeholder">
            <div className="hf-spinner" />
          </div>
        ) : (
          <SectionPlaceholder
            section={activeSection}
            icon={Icon}
            editable={editable}
          />
        )}
      </div>
    </main>
  );
}

/**
 * Phase 1 placeholder — replaced by real section components in Phase 2.
 * Shows section name + icon + edit status.
 */
function SectionPlaceholder({
  section,
  icon: Icon,
  editable,
}: {
  section: SectionId;
  icon?: React.ElementType;
  editable: boolean;
}) {
  return (
    <div className="hp-section-placeholder">
      <div className="hp-section-placeholder-icon">
        {Icon && <Icon size={36} />}
      </div>
      <div className="hp-section-placeholder-label">
        {section} section
        {editable ? " — editable" : " — read-only"}
      </div>
      <p className="hf-text-sm hf-text-muted" style={{ marginTop: 8 }}>
        Section content will be built in Phase 2
      </p>
    </div>
  );
}
