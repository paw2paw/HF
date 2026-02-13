"use client";

import { useState, type ReactNode } from "react";

interface ConfigSectionProps {
  name: string;
  collapsed?: boolean;
  children: ReactNode;
}

/**
 * Collapsible section with header + summary badge.
 * Essentials section starts expanded; advanced sections start collapsed.
 */
export function ConfigSection({ name, collapsed: initialCollapsed = false, children }: ConfigSectionProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const isEssentials = name === "Essentials";

  return (
    <div
      style={{
        marginBottom: 8,
        border: isEssentials ? "none" : "1px solid var(--border-default, #e5e7eb)",
        borderRadius: isEssentials ? 0 : 6,
        overflow: "hidden",
      }}
    >
      {/* Section header (not shown for Essentials — they render flat) */}
      {!isEssentials && (
        <div
          onClick={() => setCollapsed(!collapsed)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            background: collapsed ? "var(--surface-primary, #fff)" : "var(--surface-secondary, #f9fafb)",
            cursor: "pointer",
            borderBottom: collapsed ? "none" : "1px solid var(--border-default, #e5e7eb)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace" }}>
              {collapsed ? ">" : "v"}
            </span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
              {name}
            </span>
          </div>
        </div>
      )}
      {/* Section content */}
      {!collapsed && (
        <div style={{ padding: isEssentials ? 0 : "8px 12px" }}>
          {children}
        </div>
      )}
    </div>
  );
}
