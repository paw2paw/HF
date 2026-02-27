"use client";

import { useHolo } from "@/hooks/useHolographicState";
import { visibleSections } from "@/lib/holographic/permissions";
import { getSectionMeta } from "@/lib/holographic/section-labels";
import { HoloHeader } from "./HoloHeader";
import { HoloMapCard } from "./HoloMapCard";
import { SaveIndicator } from "./SaveIndicator";

interface HoloMapProps {
  mobileOpen?: boolean;
}

export function HoloMap({ mobileOpen }: HoloMapProps) {
  const { state, setActiveSection, setMapCollapsed } = useHolo();
  const { role, activeSection, readinessMap, summaries, mapCollapsed, saveStatus } = state;

  const sections = visibleSections(role);

  const mapClasses = [
    "hp-map",
    mapCollapsed && "hp-map-collapsed",
    mobileOpen && "hp-map-mobile-open",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={mapClasses}>
      <HoloHeader
        collapsed={mapCollapsed}
        onToggleCollapse={() => setMapCollapsed(!mapCollapsed)}
      />

      <div className="hp-map-cards">
        {sections.map((section) => {
          const meta = getSectionMeta(section, role);
          return (
            <HoloMapCard
              key={section}
              section={section}
              label={meta.label}
              summary={summaries[section] || meta.tagline}
              status={readinessMap[section]}
              active={section === activeSection}
              onClick={() => setActiveSection(section)}
            />
          );
        })}
      </div>

      <SaveIndicator status={saveStatus} />
    </aside>
  );
}
