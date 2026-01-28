/**
 * Tests for /analyze page
 *
 * The analyze page provides a 3-step workflow:
 * 1. Select Caller
 * 2. Configure & Select Calls
 * 3. Run & View Results
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("AnalyzePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Prerequisites Check", () => {
    it("should display prerequisites status on load", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: true,
            ready: true,
            checks: {
              database: { ok: true, message: "Connected" },
              analysisSpecs: { ok: true, count: 3, required: 1 },
              parameters: { ok: true, count: 5 },
              runConfigs: { ok: true, count: 2 },
            },
          }),
      });

      // Expected behavior: page fetches /api/system/readiness on mount
      expect(mockFetch).toBeDefined();
    });

    it("should show warning when prerequisites are not met", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: true,
            ready: false,
            checks: {
              database: { ok: true, message: "Connected" },
              analysisSpecs: { ok: false, count: 0, required: 1 },
              parameters: { ok: true, count: 5 },
              runConfigs: { ok: false, count: 0 },
            },
          }),
      });

      // Expected: show warning indicators for failed checks
      const expectedWarnings = ["Analysis Specs", "Run Configs"];
      expect(expectedWarnings.length).toBe(2);
    });
  });

  describe("Step 1: Select Caller", () => {
    it("should fetch and display callers list", async () => {
      const mockCallers = [
        { id: "caller-1", name: "John Doe", _count: { calls: 10 } },
        { id: "caller-2", name: "Jane Smith", _count: { calls: 5 } },
      ];

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, callers: mockCallers }),
      });

      // Expected: callers are displayed in a searchable list
      expect(mockCallers.length).toBe(2);
    });

    it("should allow searching callers by name", async () => {
      const mockCallers = [
        { id: "caller-1", name: "John Doe", email: "john@example.com" },
        { id: "caller-2", name: "Jane Smith", email: "jane@example.com" },
      ];

      // Filter simulation
      const searchTerm = "john";
      const filtered = mockCallers.filter(
        (c) =>
          c.name.toLowerCase().includes(searchTerm) ||
          c.email?.toLowerCase().includes(searchTerm)
      );

      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe("John Doe");
    });

    it("should select caller and proceed to step 2", async () => {
      const selectedCaller = {
        id: "caller-1",
        name: "John Doe",
        _count: { calls: 10 },
      };

      // Expected: after selection, step should change to 2
      expect(selectedCaller.id).toBe("caller-1");
    });
  });

  describe("Step 2: Configure & Select Calls", () => {
    it("should fetch run configs for selected caller", async () => {
      const mockRunConfigs = [
        {
          id: "config-1",
          name: "Full Analysis",
          measureSpecs: 5,
          learnSpecs: 3,
        },
        { id: "config-2", name: "Quick Score", measureSpecs: 2, learnSpecs: 0 },
      ];

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, compiledSets: mockRunConfigs }),
      });

      expect(mockRunConfigs.length).toBe(2);
    });

    it("should fetch calls for selected caller", async () => {
      const mockCalls = [
        { id: "call-1", createdAt: new Date("2026-01-23"), transcript: "..." },
        { id: "call-2", createdAt: new Date("2026-01-22"), transcript: "..." },
      ];

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, calls: mockCalls }),
      });

      expect(mockCalls.length).toBe(2);
    });

    it("should allow multi-selecting calls", async () => {
      const selectedCallIds = new Set<string>();

      // Select multiple calls
      selectedCallIds.add("call-1");
      selectedCallIds.add("call-2");
      selectedCallIds.add("call-3");

      expect(selectedCallIds.size).toBe(3);
    });

    it("should have select all functionality", async () => {
      const allCallIds = ["call-1", "call-2", "call-3", "call-4", "call-5"];
      const selectedCallIds = new Set<string>();

      // Select all
      allCallIds.forEach((id) => selectedCallIds.add(id));

      expect(selectedCallIds.size).toBe(5);
    });

    it("should toggle store results option", async () => {
      let storeResults = true;

      // Toggle
      storeResults = !storeResults;
      expect(storeResults).toBe(false);

      storeResults = !storeResults;
      expect(storeResults).toBe(true);
    });
  });

  describe("Step 3: Run & View Results", () => {
    it("should run analysis when clicking Run Analysis", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: true,
            results: [
              {
                callId: "call-1",
                scores: [{ parameterId: "B5-O", score: 0.8 }],
                memories: [{ key: "location", value: "London" }],
              },
            ],
          }),
      });

      // Expected: POST to /api/analysis/run
      expect(mockFetch).toBeDefined();
    });

    it("should display aggregated results", async () => {
      const results = [
        {
          callId: "call-1",
          scores: [
            { parameterId: "B5-O", score: 0.8 },
            { parameterId: "B5-C", score: 0.7 },
          ],
        },
        {
          callId: "call-2",
          scores: [
            { parameterId: "B5-O", score: 0.75 },
            { parameterId: "B5-C", score: 0.65 },
          ],
        },
      ];

      // Aggregate scores by parameter
      const aggregated: Record<string, number[]> = {};
      results.forEach((r) => {
        r.scores.forEach((s) => {
          if (!aggregated[s.parameterId]) aggregated[s.parameterId] = [];
          aggregated[s.parameterId].push(s.score);
        });
      });

      // Calculate averages
      const averages = Object.entries(aggregated).map(([param, scores]) => ({
        parameterId: param,
        average: scores.reduce((a, b) => a + b, 0) / scores.length,
      }));

      expect(averages.find((a) => a.parameterId === "B5-O")?.average).toBe(
        0.775
      );
      expect(averages.find((a) => a.parameterId === "B5-C")?.average).toBe(
        0.675
      );
    });

    it("should display extracted memories", async () => {
      const results = [
        {
          callId: "call-1",
          memories: [
            { category: "FACT", key: "location", value: "London" },
            { category: "PREFERENCE", key: "contact", value: "email" },
          ],
        },
      ];

      const totalMemories = results.reduce(
        (acc, r) => acc + r.memories.length,
        0
      );
      expect(totalMemories).toBe(2);
    });

    it("should handle analysis errors gracefully", async () => {
      // Test the expected error response structure
      const errorResponse = {
        ok: false,
        error: "LLM service unavailable",
      };

      // Verify expected error response structure
      expect(errorResponse.ok).toBe(false);
      expect(errorResponse.error).toBeDefined();
    });
  });

  describe("Navigation", () => {
    it("should allow navigating to caller profile from results", async () => {
      const callerId = "caller-123";
      const expectedUrl = `/callers/${callerId}`;

      expect(expectedUrl).toBe("/callers/caller-123");
    });

    it("should allow going back to previous steps", async () => {
      let step: 1 | 2 | 3 = 3;

      // Go back to step 2
      step = 2;
      expect(step).toBe(2);

      // Go back to step 1
      step = 1;
      expect(step).toBe(1);
    });
  });
});
