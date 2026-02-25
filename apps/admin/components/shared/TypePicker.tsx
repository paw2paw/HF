"use client";

/**
 * TypePicker — card grid for selecting institution type (sector).
 *
 * Shared between CreateInstitutionModal (Teach wizard) and CreateDomainModal (Domains page).
 * Each card shows: icon, name, description, and tooltip on hover explaining
 * how the choice affects the AI agent's personality.
 *
 * Fetches types from /api/admin/institution-types on mount.
 * Falls back to static SECTOR_CONFIG if API fails (graceful degradation for non-admin roles).
 */

import { useState, useEffect } from "react";
import {
  GraduationCap,
  Building2,
  Users,
  Target,
  Heart,
  Dumbbell,
  HelpCircle,
} from "lucide-react";
import { SECTOR_CONFIG, SECTOR_SLUGS, type SectorSlug } from "@/lib/institution-types/sector-config";

const ICON_COMPONENTS: Record<string, React.ComponentType<{ size: number }>> = {
  GraduationCap,
  Building2,
  Users,
  Target,
  Heart,
  Dumbbell,
};

/** CSS color overrides per sector color key */
const COLOR_VARS: Record<string, { text: string; bg: string; border: string }> = {
  blue:   { text: "var(--badge-blue-text)",   bg: "var(--badge-blue-bg)",   border: "var(--badge-blue-border)" },
  amber:  { text: "var(--badge-amber-text)",  bg: "var(--badge-amber-bg)",  border: "var(--badge-amber-border)" },
  green:  { text: "var(--badge-green-text)",  bg: "var(--badge-green-bg)",  border: "var(--badge-green-border)" },
  purple: { text: "var(--badge-purple-text)", bg: "var(--badge-purple-bg)", border: "var(--badge-purple-border)" },
  pink:   { text: "var(--badge-pink-text)",   bg: "var(--badge-pink-bg)",   border: "var(--badge-pink-border)" },
  cyan:   { text: "var(--badge-cyan-text)",   bg: "var(--badge-cyan-bg)",   border: "var(--badge-cyan-border)" },
};

export interface TypePickerOption {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
}

interface TypePickerProps {
  /** Currently selected type slug */
  value: string | null;
  /** Called when user selects a type */
  onChange: (slug: string, typeId?: string) => void;
  /** Label above the picker */
  label?: string;
}

export function TypePicker({ value, onChange, label = "What kind of organisation is this?" }: TypePickerProps) {
  const [apiTypes, setApiTypes] = useState<TypePickerOption[] | null>(null);

  // Try to load types from API (includes id for linking), fall back to static config
  useEffect(() => {
    fetch("/api/admin/institution-types")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.types?.length) {
          setApiTypes(data.types.map((t: any) => ({
            id: t.id,
            slug: t.slug,
            name: t.name,
            description: t.description,
          })));
        }
      })
      .catch(() => {}); // Silently fall back to static config
  }, []);

  // Merge: use API data if available (has id), otherwise static config
  const types: Array<{ slug: string; id?: string; name: string; description: string }> =
    apiTypes
      ? apiTypes.map((t) => ({
          slug: t.slug,
          id: t.id,
          name: t.name,
          description: t.description || SECTOR_CONFIG[t.slug as SectorSlug]?.description || "",
        }))
      : SECTOR_SLUGS.map((slug) => ({
          slug,
          name: SECTOR_CONFIG[slug].label,
          description: SECTOR_CONFIG[slug].description,
        }));

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
        {label}
      </label>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 8,
      }}>
        {types.map((t) => {
          const sectorDef = SECTOR_CONFIG[t.slug as SectorSlug];
          const colorKey = sectorDef?.colorKey || "blue";
          const colors = COLOR_VARS[colorKey] || COLOR_VARS.blue;
          const IconComp = sectorDef ? ICON_COMPONENTS[sectorDef.icon] : HelpCircle;
          const isSelected = value === t.slug;

          return (
            <button
              key={t.slug}
              type="button"
              title={sectorDef?.tooltip || t.description}
              onClick={() => onChange(t.slug, t.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                padding: "12px 8px",
                borderRadius: 10,
                border: isSelected ? `2px solid ${colors.text}` : "2px solid var(--border-default)",
                background: isSelected ? colors.bg : "var(--surface-primary)",
                color: isSelected ? colors.text : "var(--text-primary)",
                cursor: "pointer",
                transition: "all 120ms ease",
                textAlign: "center",
              }}
            >
              {IconComp && <IconComp size={20} />}
              <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{t.name}</span>
              <span style={{
                fontSize: 11,
                lineHeight: 1.3,
                color: isSelected ? colors.text : "var(--text-muted)",
                opacity: 0.85,
              }}>
                {t.description.split(" ").slice(0, 5).join(" ")}
              </span>
            </button>
          );
        })}
      </div>
      {value && SECTOR_CONFIG[value as SectorSlug] && (
        <p style={{
          marginTop: 8,
          marginBottom: 0,
          fontSize: 12,
          lineHeight: 1.4,
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "flex-start",
          gap: 6,
        }}>
          <HelpCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{SECTOR_CONFIG[value as SectorSlug].tooltip}</span>
        </p>
      )}
    </div>
  );
}
