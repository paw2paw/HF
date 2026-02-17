"use client";

import { type ReactNode } from "react";
import { useResponsive } from "@/hooks/useResponsive";
import {
  type SettingsPanel,
  type SettingsCategory,
  CATEGORY_META,
  groupByCategory,
} from "@/lib/settings-panels";

interface SettingsLayoutProps {
  panels: SettingsPanel[];
  activeId: string;
  onNavigate: (id: string) => void;
  sidebar: ReactNode;
  children: ReactNode;
}

export function SettingsLayout({
  panels,
  activeId,
  onNavigate,
  sidebar,
  children,
}: SettingsLayoutProps) {
  const { isMobile } = useResponsive();

  // Mobile: dropdown selector instead of sidebar
  if (isMobile) {
    const grouped = groupByCategory(panels);
    const sortedCategories = [...grouped.entries()].sort(
      ([a], [b]) => (CATEGORY_META[a]?.order ?? 99) - (CATEGORY_META[b]?.order ?? 99)
    );

    return (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <select
          value={activeId}
          onChange={(e) => onNavigate(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 14,
            borderRadius: 8,
            border: "1px solid var(--border-default)",
            background: "var(--surface-secondary)",
            color: "var(--text-primary)",
            marginBottom: 16,
          }}
        >
          {sortedCategories.map(([category, categoryPanels]) => (
            <optgroup key={category} label={CATEGORY_META[category as SettingsCategory]?.label ?? category}>
              {categoryPanels.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <div>{children}</div>
      </div>
    );
  }

  // Desktop: sidebar + content
  return (
    <div style={{ display: "flex", gap: 0, maxWidth: 1100, margin: "0 auto" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 230,
          minWidth: 230,
          position: "sticky",
          top: 0,
          height: "calc(100vh - 64px)",
          overflowY: "auto",
          borderRight: "1px solid var(--border-default)",
          paddingTop: 12,
          background: "var(--surface-primary)",
        }}
      >
        {sidebar}
      </aside>

      {/* Content */}
      <main
        style={{
          flex: 1,
          maxWidth: 720,
          padding: "0 32px 32px",
          overflowY: "auto",
        }}
      >
        {children}
      </main>
    </div>
  );
}
