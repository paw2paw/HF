"use client";

import type { SaveStatus } from "@/hooks/useHolographicState";

interface SaveIndicatorProps {
  status: SaveStatus;
}

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: "",
  saving: "Saving\u2026",
  saved: "Saved",
  error: "Save failed",
};

export function SaveIndicator({ status }: SaveIndicatorProps) {
  if (status === "idle") return null;

  return (
    <div className="hp-save-indicator">
      <span className="hp-save-dot" data-status={status} />
      <span>{STATUS_TEXT[status]}</span>
    </div>
  );
}
