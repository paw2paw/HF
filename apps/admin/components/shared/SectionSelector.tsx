"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

export type SectionConfig = {
  id: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
};

type SectionSelectorProps = {
  storageKey: string;
  sections: SectionConfig[];
  visible: Record<string, boolean>;
  onToggle: (sectionId: string) => void;
  children?: React.ReactNode;
};

export function SectionSelector({ storageKey, sections, visible, onToggle, children }: SectionSelectorProps) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
      {sections.map((section) => {
        const isActive = visible[section.id] !== false;
        return (
          <button
            key={section.id}
            onClick={() => onToggle(section.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 10px",
              fontSize: 12,
              fontWeight: isActive ? 600 : 400,
              background: isActive ? "var(--status-info-bg)" : "transparent",
              color: isActive ? "var(--button-primary-bg)" : "var(--text-muted)",
              border: `1px solid ${isActive ? "var(--button-primary-bg)" : "var(--border-default)"}`,
              borderRadius: 16,
              cursor: "pointer",
              transition: "all 0.15s",
              opacity: isActive ? 1 : 0.6,
            }}
          >
            <span style={{ display: "flex", alignItems: "center" }}>{section.icon}</span>
            <span>{section.label}</span>
            {section.count !== undefined && section.count > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  lineHeight: "16px",
                  background: isActive ? "color-mix(in srgb, var(--button-primary-bg) 20%, transparent)" : "var(--surface-tertiary)",
                  color: isActive ? "var(--button-primary-bg)" : "var(--text-secondary)",
                  padding: "1px 6px",
                  borderRadius: 10,
                  minWidth: 18,
                  textAlign: "center",
                }}
              >
                {section.count}
              </span>
            )}
          </button>
        );
      })}
      {children}
    </div>
  );
}

// Hook to manage section visibility with localStorage persistence
export function useSectionVisibility(
  storageKey: string,
  defaultSections: Record<string, boolean>,
): [Record<string, boolean>, (sectionId: string) => void] {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const fullKey = userId ? `section-vis:${storageKey}.${userId}` : `section-vis:${storageKey}`;

  const [visible, setVisible] = useState<Record<string, boolean>>(defaultSections);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(fullKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults so new sections show up as visible
        setVisible({ ...defaultSections, ...parsed });
      }
    } catch {
      // Silently fail
    }
  }, [fullKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback(
    (sectionId: string) => {
      setVisible((prev) => {
        const next = { ...prev, [sectionId]: prev[sectionId] === false ? true : false };
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(fullKey, JSON.stringify(next));
          } catch {
            // Silently fail
          }
        }
        return next;
      });
    },
    [fullKey],
  );

  return [visible, toggle];
}
