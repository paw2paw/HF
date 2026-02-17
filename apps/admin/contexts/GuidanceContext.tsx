"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// ============================================================================
// Types
// ============================================================================

export type HighlightType = "pulse" | "flash" | "glow";

export interface Highlight {
  type: HighlightType;
  message?: string;
  expiresAt: number;
}

export interface Mission {
  id: string;
  name: string;
  icon: string;
  steps: MissionStep[];
  currentStepIndex: number;
  isTour?: boolean;
  onComplete?: () => void;
}

export interface MissionStep {
  id: string;
  title: string;
  description?: string;
  target: string; // href to highlight
  completed: boolean;
  elementSelector?: string; // CSS selector for non-sidebar elements
  placement?: "top" | "bottom" | "left" | "right" | "center";
  navigateTo?: string; // auto-navigate before showing step
  nextLabel?: string; // custom label for Next button
}

interface GuidanceState {
  highlights: Map<string, Highlight>;
  activeMission: Mission | null;
  tooltipTarget: string | null;
}

interface GuidanceActions {
  highlightSidebar: (href: string, type?: HighlightType, durationMs?: number, message?: string) => void;
  clearHighlight: (href: string) => void;
  clearAllHighlights: () => void;
  getHighlight: (href: string) => Highlight | undefined;
  // Mission actions
  startMission: (mission: Omit<Mission, "currentStepIndex">) => void;
  advanceMission: () => void;
  completeMissionStep: (stepId: string) => void;
  skipMission: () => void;
  // Tooltip
  showTooltip: (href: string) => void;
  hideTooltip: () => void;
}

type GuidanceContextValue = GuidanceState & GuidanceActions;

const GuidanceContext = createContext<GuidanceContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

const DEFAULT_HIGHLIGHT_DURATION = 15000; // 15 seconds

export function GuidanceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [highlights, setHighlights] = useState<Map<string, Highlight>>(new Map());
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [tooltipTarget, setTooltipTarget] = useState<string | null>(null);

  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Clear highlight when user navigates to the highlighted route
  useEffect(() => {
    if (pathname && highlights.has(pathname)) {
      clearHighlight(pathname);
    }
    // Also check for partial matches (e.g., /x/callers matches /x/callers/123)
    for (const href of highlights.keys()) {
      if (pathname?.startsWith(href)) {
        clearHighlight(href);
      }
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      for (const timeout of timeoutRefs.current.values()) {
        clearTimeout(timeout);
      }
    };
  }, []);

  const highlightSidebar = useCallback((
    href: string,
    type: HighlightType = "pulse",
    durationMs: number = DEFAULT_HIGHLIGHT_DURATION,
    message?: string
  ) => {
    const expiresAt = Date.now() + durationMs;

    setHighlights(prev => {
      const next = new Map(prev);
      next.set(href, { type, message, expiresAt });
      return next;
    });

    // Clear existing timeout for this href
    const existingTimeout = timeoutRefs.current.get(href);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout to auto-clear
    const timeout = setTimeout(() => {
      setHighlights(prev => {
        const next = new Map(prev);
        next.delete(href);
        return next;
      });
      timeoutRefs.current.delete(href);
    }, durationMs);

    timeoutRefs.current.set(href, timeout);
  }, []);

  const clearHighlight = useCallback((href: string) => {
    setHighlights(prev => {
      const next = new Map(prev);
      next.delete(href);
      return next;
    });

    const timeout = timeoutRefs.current.get(href);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(href);
    }
  }, []);

  const clearAllHighlights = useCallback(() => {
    setHighlights(new Map());
    for (const timeout of timeoutRefs.current.values()) {
      clearTimeout(timeout);
    }
    timeoutRefs.current.clear();
  }, []);

  const getHighlight = useCallback((href: string): Highlight | undefined => {
    return highlights.get(href);
  }, [highlights]);

  // Mission actions
  const startMission = useCallback((mission: Omit<Mission, "currentStepIndex">) => {
    setActiveMission({
      ...mission,
      currentStepIndex: 0,
    });
    // Highlight the first step's target
    if (mission.steps.length > 0) {
      highlightSidebar(mission.steps[0].target, "pulse", 30000);
    }
  }, [highlightSidebar]);

  const advanceMission = useCallback(() => {
    setActiveMission(prev => {
      if (!prev) return null;
      const nextIndex = prev.currentStepIndex + 1;
      if (nextIndex >= prev.steps.length) {
        // Mission complete — fire callback if present
        prev.onComplete?.();
        return null;
      }
      // Highlight next step (only if it targets a sidebar href)
      const nextStep = prev.steps[nextIndex];
      if (nextStep.target && !nextStep.elementSelector) {
        highlightSidebar(nextStep.target, "pulse", 30000);
      }
      return {
        ...prev,
        currentStepIndex: nextIndex,
      };
    });
  }, [highlightSidebar]);

  const completeMissionStep = useCallback((stepId: string) => {
    setActiveMission(prev => {
      if (!prev) return null;
      const steps = prev.steps.map(s =>
        s.id === stepId ? { ...s, completed: true } : s
      );
      const completedStep = steps.find(s => s.id === stepId);
      if (completedStep) {
        clearHighlight(completedStep.target);
      }
      // Find next incomplete step
      const nextIndex = steps.findIndex((s, i) => i > prev.currentStepIndex && !s.completed);
      if (nextIndex === -1) {
        // All steps complete — fire callback if present
        prev.onComplete?.();
        return null;
      }
      const nextStep = steps[nextIndex];
      if (nextStep.target && !nextStep.elementSelector) {
        highlightSidebar(nextStep.target, "pulse", 30000);
      }
      return {
        ...prev,
        steps,
        currentStepIndex: nextIndex,
      };
    });
  }, [clearHighlight, highlightSidebar]);

  const skipMission = useCallback(() => {
    if (activeMission) {
      // Clear all highlights for mission steps
      for (const step of activeMission.steps) {
        clearHighlight(step.target);
      }
    }
    setActiveMission(null);
  }, [activeMission, clearHighlight]);

  const showTooltip = useCallback((href: string) => {
    setTooltipTarget(href);
  }, []);

  const hideTooltip = useCallback(() => {
    setTooltipTarget(null);
  }, []);

  const value: GuidanceContextValue = {
    highlights,
    activeMission,
    tooltipTarget,
    highlightSidebar,
    clearHighlight,
    clearAllHighlights,
    getHighlight,
    startMission,
    advanceMission,
    completeMissionStep,
    skipMission,
    showTooltip,
    hideTooltip,
  };

  return (
    <GuidanceContext.Provider value={value}>
      {children}
    </GuidanceContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useGuidanceContext(): GuidanceContextValue {
  const context = useContext(GuidanceContext);
  if (!context) {
    throw new Error("useGuidanceContext must be used within a GuidanceProvider");
  }
  return context;
}

// Optional hook that doesn't throw if used outside provider (for sidebar)
export function useGuidance(): GuidanceContextValue | null {
  return useContext(GuidanceContext);
}
