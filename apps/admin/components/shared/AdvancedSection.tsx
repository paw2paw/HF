"use client";

import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useViewMode } from "@/contexts/ViewModeContext";

interface AdvancedSectionProps {
  children: React.ReactNode;
  label?: string;
}

/**
 * Wraps advanced/fiddly fields.
 * - In advanced mode: renders children directly (no wrapper).
 * - In simple mode: collapses children behind a "Show advanced" expander.
 */
export function AdvancedSection({ children, label = "Advanced options" }: AdvancedSectionProps) {
  const { isAdvanced } = useViewMode();
  const [expanded, setExpanded] = useState(false);

  if (isAdvanced) return <>{children}</>;

  return (
    <div style={{ marginTop: 8, marginBottom: 8 }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "6px 10px",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--text-muted)",
          background: "transparent",
          border: "1px solid var(--border-subtle)",
          borderRadius: 6,
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
      >
        <ChevronRight
          size={14}
          style={{
            transition: "transform 0.15s ease",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
        />
        {label}
      </button>
      {expanded && (
        <div style={{ marginTop: 8 }}>
          {children}
        </div>
      )}
    </div>
  );
}
