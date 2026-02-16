"use client";

import React from "react";
import Link from "next/link";
import { Settings2 } from "lucide-react";
import { useViewMode } from "@/contexts/ViewModeContext";

/**
 * Informational banner shown on advanced-only pages when user is in simple mode.
 * Does NOT block access — the page still works. Just signals discoverability.
 */
export function AdvancedBanner() {
  const { isAdvanced, setPreference } = useViewMode();

  if (isAdvanced) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        marginBottom: 16,
        borderRadius: 8,
        fontSize: 13,
        color: "var(--text-secondary)",
        background: "color-mix(in srgb, var(--accent-primary) 6%, transparent)",
        border: "1px solid color-mix(in srgb, var(--accent-primary) 15%, transparent)",
      }}
    >
      <Settings2 size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
      <span style={{ flex: 1 }}>
        This is an advanced feature. You&apos;re in simple view mode.
      </span>
      <button
        onClick={() => setPreference("advanced")}
        style={{
          padding: "4px 10px",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--accent-primary)",
          background: "color-mix(in srgb, var(--accent-primary) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)",
          borderRadius: 5,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Switch to Advanced
      </button>
      <Link
        href="/x"
        style={{
          padding: "4px 10px",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--text-muted)",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        Go Home
      </Link>
    </div>
  );
}
