/**
 * Tests for useWizardResume hook
 *
 * Validates: resume detection, wizard-phase filtering,
 * loading state, error handling.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useWizardResume } from "@/hooks/useWizardResume";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("useWizardResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts loading", () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useWizardResume("course_setup"));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.pendingTask).toBeNull();
  });

  it("returns null when no pending tasks", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, tasks: [] }),
    });

    const { result } = renderHook(() => useWizardResume("course_setup"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.pendingTask).toBeNull();
  });

  it("returns pending task when found (wizard-phase: currentStep=0)", async () => {
    const task = {
      id: "task-1",
      taskType: "course_setup",
      context: { courseName: "Bio 101", _wizardStep: 2 },
      startedAt: "2026-02-20T10:00:00Z",
      currentStep: 0,
      totalSteps: 5,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, tasks: [task] }),
    });

    const { result } = renderHook(() => useWizardResume("course_setup"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.pendingTask).not.toBeNull();
    expect(result.current.pendingTask?.id).toBe("task-1");
    expect(result.current.pendingTask?.context.courseName).toBe("Bio 101");
  });

  it("filters out execution-phase tasks (currentStep >= 1 without _wizardStep)", async () => {
    const task = {
      id: "task-exec",
      taskType: "course_setup",
      context: { phase: "building_curriculum" },
      startedAt: "2026-02-20T10:00:00Z",
      currentStep: 2,
      totalSteps: 5,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, tasks: [task] }),
    });

    const { result } = renderHook(() => useWizardResume("course_setup"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    // Execution-phase task should be filtered out
    expect(result.current.pendingTask).toBeNull();
  });

  it("calls correct API endpoint with taskType filter", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, tasks: [] }),
    });

    renderHook(() => useWizardResume("content_wizard"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("taskType=content_wizard");
    expect(url).toContain("status=in_progress");
  });

  it("handles fetch errors gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useWizardResume("course_setup"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.pendingTask).toBeNull();
  });

  it("handles non-ok response gracefully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false, error: "Unauthorized" }),
    });

    const { result } = renderHook(() => useWizardResume("course_setup"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.pendingTask).toBeNull();
  });
});
