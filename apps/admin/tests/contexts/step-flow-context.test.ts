/**
 * Tests for StepFlowContext
 *
 * Validates: sessionStorage persistence, step transitions,
 * data management, flow lifecycle, hydration guard.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { StepFlowProvider, useStepFlow } from "@/contexts/StepFlowContext";

// Mock sessionStorage
const store: Record<string, string> = {};
const mockSessionStorage = {
  getItem: vi.fn((key: string) => store[key] || null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
};

Object.defineProperty(window, "sessionStorage", { value: mockSessionStorage });

const DEMO_STEPS = [
  { id: "domain", label: "Select Domain", activeLabel: "Selecting Domain" },
  { id: "goal", label: "Set Goal", activeLabel: "Setting Goal" },
  { id: "readiness", label: "Readiness", activeLabel: "Checking Readiness" },
  { id: "launch", label: "Launch", activeLabel: "Launching" },
];

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(StepFlowProvider, null, children);
}

describe("StepFlowContext", () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    vi.clearAllMocks();
  });

  it("starts inactive", () => {
    const { result } = renderHook(() => useStepFlow(), { wrapper });
    expect(result.current.isActive).toBe(false);
    expect(result.current.state).toBeNull();
  });

  it("startFlow activates with correct initial state", () => {
    const { result } = renderHook(() => useStepFlow(), { wrapper });

    act(() => {
      result.current.startFlow({
        flowId: "demonstrate",
        steps: DEMO_STEPS,
        returnPath: "/x/demonstrate",
      });
    });

    expect(result.current.isActive).toBe(true);
    expect(result.current.state?.flowId).toBe("demonstrate");
    expect(result.current.state?.currentStep).toBe(0);
    expect(result.current.state?.steps).toHaveLength(4);
    expect(result.current.state?.returnPath).toBe("/x/demonstrate");
    expect(result.current.state?.data).toEqual({});
  });

  it("nextStep advances step", () => {
    const { result } = renderHook(() => useStepFlow(), { wrapper });

    act(() => {
      result.current.startFlow({ flowId: "test", steps: DEMO_STEPS, returnPath: "/test" });
    });
    act(() => { result.current.nextStep(); });

    expect(result.current.state?.currentStep).toBe(1);
  });

  it("prevStep goes back", () => {
    const { result } = renderHook(() => useStepFlow(), { wrapper });

    act(() => {
      result.current.startFlow({ flowId: "test", steps: DEMO_STEPS, returnPath: "/test" });
    });
    act(() => { result.current.setStep(2); });
    act(() => { result.current.prevStep(); });

    expect(result.current.state?.currentStep).toBe(1);
  });

  it("nextStep clamps to last step", () => {
    const { result } = renderHook(() => useStepFlow(), { wrapper });

    act(() => {
      result.current.startFlow({ flowId: "test", steps: DEMO_STEPS, returnPath: "/test" });
    });
    act(() => { result.current.setStep(3); }); // last step
    act(() => { result.current.nextStep(); }); // should stay at 3

    expect(result.current.state?.currentStep).toBe(3);
  });

  it("prevStep clamps to first step", () => {
    const { result } = renderHook(() => useStepFlow(), { wrapper });

    act(() => {
      result.current.startFlow({ flowId: "test", steps: DEMO_STEPS, returnPath: "/test" });
    });
    act(() => { result.current.prevStep(); }); // already at 0

    expect(result.current.state?.currentStep).toBe(0);
  });

  it("setData and getData manage flow-specific data", () => {
    const { result } = renderHook(() => useStepFlow(), { wrapper });

    act(() => {
      result.current.startFlow({ flowId: "test", steps: DEMO_STEPS, returnPath: "/test" });
    });
    act(() => {
      result.current.setData("domainId", "dom-1");
      result.current.setData("goal", "Teach fractions");
    });

    expect(result.current.getData("domainId")).toBe("dom-1");
    expect(result.current.getData("goal")).toBe("Teach fractions");
    expect(result.current.getData("nonexistent")).toBeUndefined();
  });

  it("endFlow clears state", () => {
    const { result } = renderHook(() => useStepFlow(), { wrapper });

    act(() => {
      result.current.startFlow({ flowId: "test", steps: DEMO_STEPS, returnPath: "/test" });
    });
    act(() => { result.current.endFlow(); });

    expect(result.current.isActive).toBe(false);
    expect(result.current.state).toBeNull();
  });

  it("persists state to sessionStorage", () => {
    const { result } = renderHook(() => useStepFlow(), { wrapper });

    act(() => {
      result.current.startFlow({ flowId: "demo", steps: DEMO_STEPS, returnPath: "/x/demonstrate" });
    });

    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      "hf.stepflow.state",
      expect.stringContaining('"flowId":"demo"'),
    );
  });

  it("endFlow removes from sessionStorage", () => {
    const { result } = renderHook(() => useStepFlow(), { wrapper });

    act(() => {
      result.current.startFlow({ flowId: "test", steps: DEMO_STEPS, returnPath: "/test" });
    });
    act(() => { result.current.endFlow(); });

    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith("hf.stepflow.state");
  });

  it("setStep validates range", () => {
    const { result } = renderHook(() => useStepFlow(), { wrapper });

    act(() => {
      result.current.startFlow({ flowId: "test", steps: DEMO_STEPS, returnPath: "/test" });
    });
    act(() => { result.current.setStep(99); });
    expect(result.current.state?.currentStep).toBe(3); // clamped to max

    act(() => { result.current.setStep(-5); });
    expect(result.current.state?.currentStep).toBe(0); // clamped to min
  });

  it("operations are no-op when not active", () => {
    const { result } = renderHook(() => useStepFlow(), { wrapper });

    // These should not throw
    act(() => { result.current.nextStep(); });
    act(() => { result.current.prevStep(); });
    act(() => { result.current.setStep(2); });
    act(() => { result.current.setData("key", "val"); });

    expect(result.current.isActive).toBe(false);
  });
});
