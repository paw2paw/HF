/**
 * Tests for StepFlowContext
 *
 * Validates: sessionStorage persistence, step transitions,
 * data management, flow lifecycle, hydration guard,
 * DB sync (debounced + immediate), taskId lifecycle.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
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

// Mock fetch for DB sync calls
const mockFetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
vi.stubGlobal("fetch", mockFetch);

// Mock navigator.sendBeacon
const mockSendBeacon = vi.fn(() => true);
Object.defineProperty(navigator, "sendBeacon", { value: mockSendBeacon, writable: true });

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
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  // ── DB Sync Tests ──────────────────────────────────

  describe("DB sync", () => {
    it("stores taskId and taskType when provided", () => {
      const { result } = renderHook(() => useStepFlow(), { wrapper });

      act(() => {
        result.current.startFlow({
          flowId: "course",
          steps: DEMO_STEPS,
          returnPath: "/x/courses",
          taskType: "course_setup",
          taskId: "task-123",
        });
      });

      expect(result.current.state?.taskId).toBe("task-123");
      expect(result.current.state?.taskType).toBe("course_setup");
      expect(result.current.taskId).toBe("task-123");
    });

    it("exposes taskId via context value", () => {
      const { result } = renderHook(() => useStepFlow(), { wrapper });

      act(() => {
        result.current.startFlow({
          flowId: "test",
          steps: DEMO_STEPS,
          returnPath: "/test",
          taskId: "t-abc",
        });
      });

      expect(result.current.taskId).toBe("t-abc");
    });

    it("taskId is undefined when no taskId provided", () => {
      const { result } = renderHook(() => useStepFlow(), { wrapper });

      act(() => {
        result.current.startFlow({
          flowId: "test",
          steps: DEMO_STEPS,
          returnPath: "/test",
        });
      });

      expect(result.current.taskId).toBeUndefined();
    });

    it("debounced sync on setData — fires after 3s", () => {
      const { result } = renderHook(() => useStepFlow(), { wrapper });

      act(() => {
        result.current.startFlow({
          flowId: "test",
          steps: DEMO_STEPS,
          returnPath: "/test",
          taskId: "task-sync-1",
        });
      });
      mockFetch.mockClear();

      act(() => {
        result.current.setData("courseName", "Bio 101");
      });

      // Should NOT have called fetch yet (debounce is 3s)
      expect(mockFetch).not.toHaveBeenCalled();

      // Advance timer past debounce threshold
      act(() => { vi.advanceTimersByTime(3100); });

      // Now the sync should have fired
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/tasks",
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining("task-sync-1"),
        }),
      );
    });

    it("immediate sync on step change", () => {
      const { result } = renderHook(() => useStepFlow(), { wrapper });

      act(() => {
        result.current.startFlow({
          flowId: "test",
          steps: DEMO_STEPS,
          returnPath: "/test",
          taskId: "task-step-1",
        });
      });
      mockFetch.mockClear();

      act(() => {
        result.current.nextStep();
      });

      // Immediate — no timer needed
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/tasks",
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining("task-step-1"),
        }),
      );
    });

    it("no DB sync when taskId is not set", () => {
      const { result } = renderHook(() => useStepFlow(), { wrapper });

      act(() => {
        result.current.startFlow({
          flowId: "test",
          steps: DEMO_STEPS,
          returnPath: "/test",
          // no taskId
        });
      });
      mockFetch.mockClear();

      act(() => { result.current.setData("key", "val"); });
      act(() => { vi.advanceTimersByTime(5000); });
      act(() => { result.current.nextStep(); });

      // No DB sync calls (only sessionStorage)
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("endFlow calls DELETE on task when taskId present", () => {
      const { result } = renderHook(() => useStepFlow(), { wrapper });

      act(() => {
        result.current.startFlow({
          flowId: "test",
          steps: DEMO_STEPS,
          returnPath: "/test",
          taskId: "task-to-complete",
        });
      });
      mockFetch.mockClear();

      act(() => { result.current.endFlow(); });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/tasks?taskId=task-to-complete",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("startFlow with initialData and initialStep pre-populates state", () => {
      const { result } = renderHook(() => useStepFlow(), { wrapper });

      act(() => {
        result.current.startFlow({
          flowId: "resume-test",
          steps: DEMO_STEPS,
          returnPath: "/test",
          taskId: "task-resume",
          initialData: { courseName: "Math 201", domainId: "d-1" },
          initialStep: 2,
        });
      });

      expect(result.current.state?.currentStep).toBe(2);
      expect(result.current.getData("courseName")).toBe("Math 201");
      expect(result.current.getData("domainId")).toBe("d-1");
    });
  });
});
