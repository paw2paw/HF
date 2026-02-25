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
        className="hf-flex hf-items-center hf-gap-xs hf-text-sm hf-text-muted"
        style={{
          padding: "6px 10px",
          fontWeight: 500,
          background: "transparent",
          border: "1px solid var(--border-subtle)",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        <span className={`hf-chevron--sm${expanded ? " hf-chevron--open" : ""}`}>
          <ChevronRight size={14} />
        </span>
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
