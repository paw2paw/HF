"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "hf.stepflow.state";

export interface StepDefinition {
  id: string;
  label: string;        // "Select Domain & Caller"
  activeLabel: string;  // "Selecting Domain & Caller" (for banner)
  skipWhen?: string;    // Optional skip condition expression (evaluated by evaluateSkipCondition)
}

export interface StepFlowState {
  flowId: string;
  active: boolean;
  currentStep: number;  // 0-indexed into steps array
  steps: StepDefinition[];
  data: Record<string, unknown>;
  returnPath: string;   // Where "Back to flow" navigates
}

interface StartFlowConfig {
  flowId: string;
  steps: StepDefinition[];
  returnPath: string;
}

interface StepFlowContextValue {
  state: StepFlowState | null;
  isActive: boolean;
  isOnFlowPage: boolean;  // true when pathname === returnPath
  startFlow: (config: StartFlowConfig) => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setData: (key: string, value: unknown) => void;
  getData: <T = unknown>(key: string) => T | undefined;
  endFlow: () => void;
}

const StepFlowContext = createContext<StepFlowContextValue | null>(null);

function readStorage(): StepFlowState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.flowId || !parsed.steps || !parsed.active) return null;
    return parsed as StepFlowState;
  } catch {
    return null;
  }
}

function writeStorage(state: StepFlowState | null): void {
  if (typeof window === "undefined") return;
  try {
    if (state) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function StepFlowProvider({ children }: { children: React.ReactNode }) {
  const [flowState, setFlowState] = useState<StepFlowState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const pathname = usePathname();

  // Initialize from sessionStorage on mount — deferred to avoid hydration mismatch
  useEffect(() => {
    setFlowState(readStorage());
    setHydrated(true);
  }, []);

  // Persist to sessionStorage on every state change
  useEffect(() => {
    if (hydrated) {
      writeStorage(flowState);
    }
  }, [flowState, hydrated]);

  const startFlow = useCallback((config: StartFlowConfig) => {
    // Warn if another flow is active (prevent silent data loss)
    if (flowState?.active && flowState.flowId !== config.flowId) {
      if (typeof window !== "undefined" && !window.confirm(
        "You have an in-progress flow. Starting a new one will discard it. Continue?"
      )) {
        return;
      }
    }
    setFlowState({
      flowId: config.flowId,
      active: true,
      currentStep: 0,
      steps: config.steps,
      data: {},
      returnPath: config.returnPath,
    });
  }, [flowState]);

  const setStep = useCallback((step: number) => {
    setFlowState((prev) => {
      if (!prev || !prev.active) return prev;
      const clamped = Math.max(0, Math.min(step, prev.steps.length - 1));
      return { ...prev, currentStep: clamped };
    });
  }, []);

  const nextStep = useCallback(() => {
    setFlowState((prev) => {
      if (!prev || !prev.active) return prev;
      const next = Math.min(prev.currentStep + 1, prev.steps.length - 1);
      return { ...prev, currentStep: next };
    });
  }, []);

  const prevStep = useCallback(() => {
    setFlowState((prev) => {
      if (!prev || !prev.active) return prev;
      const prev2 = Math.max(prev.currentStep - 1, 0);
      return { ...prev, currentStep: prev2 };
    });
  }, []);

  const setData = useCallback((key: string, value: unknown) => {
    setFlowState((prev) => {
      if (!prev || !prev.active) return prev;
      return { ...prev, data: { ...prev.data, [key]: value } };
    });
  }, []);

  const getData = useCallback(<T = unknown,>(key: string): T | undefined => {
    return flowState?.data[key] as T | undefined;
  }, [flowState]);

  const endFlow = useCallback(() => {
    setFlowState(null);
  }, []);

  // Gate on hydration to prevent SSR mismatch
  const active = hydrated ? flowState : null;
  const isOnFlowPage = active?.active === true && pathname === active?.returnPath;

  const value: StepFlowContextValue = {
    state: active,
    isActive: active?.active === true,
    isOnFlowPage,
    startFlow,
    setStep,
    nextStep,
    prevStep,
    setData,
    getData,
    endFlow,
  };

  return (
    <StepFlowContext.Provider value={value}>
      {children}
    </StepFlowContext.Provider>
  );
}

export function useStepFlow(): StepFlowContextValue {
  const ctx = useContext(StepFlowContext);
  if (!ctx) {
    throw new Error("useStepFlow must be used within a StepFlowProvider");
  }
  return ctx;
}
