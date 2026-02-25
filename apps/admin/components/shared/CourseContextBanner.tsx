"use client";

import { useState } from "react";
import { ChevronRight, BarChart3, Sliders, Shield, Sparkles } from "lucide-react";
import { useCourseContext } from "@/hooks/useCourseContext";

type CourseContextBannerProps = {
  courseId: string;
};

/**
 * Compact collapsible banner showing holographic course context.
 * Renders below breadcrumb on Subject + Source pages.
 *
 * Collapsed: teaching mode pill · persona name · N specs active
 * Expanded: spec groups (persona, measure, adapt, guard)
 */
export function CourseContextBanner({ courseId }: CourseContextBannerProps) {
  const ctx = useCourseContext(courseId);
  const [expanded, setExpanded] = useState(false);

  // ── Don't render on error (supplementary, not blocking) ──
  if (ctx.error || (!ctx.loading && !ctx.teachingMode && !ctx.personaName)) {
    return null;
  }

  // ── Loading skeleton ──
  if (ctx.loading) {
    return (
      <div className="hf-context-banner">
        <div className="hf-context-banner-row">
          <div className="hf-context-banner-skeleton" style={{ width: 140 }} />
          <div className="hf-context-banner-dot" />
          <div className="hf-context-banner-skeleton" style={{ width: 100 }} />
          <div className="hf-context-banner-dot" />
          <div className="hf-context-banner-skeleton" style={{ width: 80 }} />
        </div>
      </div>
    );
  }

  const { specGroups } = ctx;
  const hasExpandContent =
    specGroups.measure.length > 0 ||
    specGroups.adapt.length > 0 ||
    specGroups.guard.length > 0 ||
    specGroups.persona.length > 0;

  return (
    <div className="hf-context-banner">
      {/* ── Summary row ── */}
      <div
        className="hf-context-banner-row"
        onClick={() => hasExpandContent && setExpanded(!expanded)}
        role={hasExpandContent ? "button" : undefined}
        tabIndex={hasExpandContent ? 0 : undefined}
        onKeyDown={(e) => {
          if (hasExpandContent && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        {ctx.teachingMode && (
          <span className="hf-mode-pill">
            {ctx.teachingModeIcon} {ctx.teachingModeLabel}
          </span>
        )}

        {ctx.personaName && (
          <>
            <span className="hf-context-banner-dot" />
            <span className="hf-text-sm hf-text-secondary">
              {ctx.personaName}
            </span>
          </>
        )}

        {ctx.activeSpecCount > 0 && (
          <>
            <span className="hf-context-banner-dot" />
            <span className="hf-text-xs hf-text-muted">
              {ctx.activeSpecCount} spec{ctx.activeSpecCount !== 1 ? "s" : ""}{" "}
              active
            </span>
          </>
        )}

        {hasExpandContent && (
          <ChevronRight
            size={14}
            className={`hf-context-banner-chevron ${expanded ? "hf-context-banner-chevron-open" : ""}`}
          />
        )}
      </div>

      {/* ── Expanded detail ── */}
      {expanded && hasExpandContent && (
        <div className="hf-context-banner-expanded">
          <div className="hf-card-grid-md hf-mt-sm">
            {/* Persona */}
            {specGroups.persona.length > 0 && (
              <SpecMiniCard
                icon={<Sparkles size={13} />}
                label="AI Personality"
                specs={specGroups.persona}
                extra={
                  ctx.personaArchetype ? (
                    <span className="hf-text-xs hf-tag-pill">
                      {ctx.personaArchetype}
                    </span>
                  ) : null
                }
              />
            )}

            {/* Measurement */}
            {specGroups.measure.length > 0 && (
              <SpecMiniCard
                icon={<BarChart3 size={13} />}
                label="What's Measured"
                specs={specGroups.measure}
              />
            )}

            {/* Adaptation */}
            {specGroups.adapt.length > 0 && (
              <SpecMiniCard
                icon={<Sliders size={13} />}
                label="How It Adapts"
                specs={specGroups.adapt}
              />
            )}

            {/* Guards */}
            {specGroups.guard.length > 0 && (
              <SpecMiniCard
                icon={<Shield size={13} />}
                label="Guardrails"
                specs={specGroups.guard}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mini spec card for expanded view ──────────────────

function SpecMiniCard({
  icon,
  label,
  specs,
  extra,
}: {
  icon: React.ReactNode;
  label: string;
  specs: Array<{ name: string; slug: string }>;
  extra?: React.ReactNode;
}) {
  return (
    <div className="hf-card-compact">
      <div className="hf-flex hf-gap-sm hf-items-center hf-mb-sm">
        <span className="hf-text-muted">{icon}</span>
        <span className="hf-text-xs hf-text-bold hf-text-muted hf-uppercase">
          {label}
        </span>
      </div>
      {extra && <div className="hf-mb-xs">{extra}</div>}
      <div className="hf-flex hf-flex-col hf-gap-xs">
        {specs.map((s) => (
          <div key={s.slug} className="hf-text-xs hf-text-secondary">
            {s.name}
          </div>
        ))}
      </div>
    </div>
  );
}
