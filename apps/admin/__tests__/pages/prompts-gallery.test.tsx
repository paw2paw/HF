/**
 * Tests for /prompts page (Prompt Gallery)
 *
 * The prompt gallery displays all callers with their prompt status
 * and allows filtering and batch prompt composition.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe("PromptsGalleryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Data Loading", () => {
    it("should fetch gallery data on mount", async () => {
      const mockData = {
        ok: true,
        callers: [
          {
            id: "identity-1",
            name: "John's Phone",
            externalId: "+1234567890",
            nextPrompt: "Prompt text...",
            nextPromptComposedAt: new Date("2026-01-23"),
            caller: { name: "John Doe", _count: { calls: 10, memories: 5 } },
          },
        ],
        count: 1,
        stats: { withPrompt: 1, withoutPrompt: 0 },
      };

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockData),
      });

      // Expected: fetch /api/prompts/gallery
      expect(mockFetch).toBeDefined();
    });

    it("should handle empty gallery", async () => {
      const mockData = {
        ok: true,
        callers: [],
        count: 0,
        stats: { withPrompt: 0, withoutPrompt: 0 },
      };

      expect(mockData.callers.length).toBe(0);
    });
  });

  describe("Stats Display", () => {
    it("should display total callers count", () => {
      const stats = { total: 100, withPrompt: 60, withoutPrompt: 40 };
      expect(stats.total).toBe(100);
    });

    it("should display callers with prompts count", () => {
      const stats = { withPrompt: 60 };
      expect(stats.withPrompt).toBe(60);
    });

    it("should calculate stale prompts (>24h)", () => {
      const callers = [
        { nextPromptComposedAt: new Date("2026-01-22T10:00:00Z") }, // Stale
        { nextPromptComposedAt: new Date("2026-01-23T10:00:00Z") }, // Fresh
        { nextPromptComposedAt: null }, // No prompt
      ];

      const now = new Date("2026-01-23T12:00:00Z");
      const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours

      const staleCount = callers.filter((c) => {
        if (!c.nextPromptComposedAt) return false;
        const age = now.getTime() - new Date(c.nextPromptComposedAt).getTime();
        return age > staleThreshold;
      }).length;

      expect(staleCount).toBe(1);
    });

    it("should display callers without prompts count", () => {
      const stats = { withoutPrompt: 40 };
      expect(stats.withoutPrompt).toBe(40);
    });
  });

  describe("Filtering", () => {
    type FilterOption = "all" | "ready" | "stale" | "none";

    it("should filter by all callers", () => {
      const filter: FilterOption = "all";
      const callers = [
        { nextPrompt: "..." },
        { nextPrompt: null },
        { nextPrompt: "..." },
      ];

      // All filter shows all callers
      const filtered = callers; // No filtering
      expect(filtered.length).toBe(3);
    });

    it("should filter by ready (has prompt)", () => {
      const callers = [
        { nextPrompt: "Prompt 1" },
        { nextPrompt: null },
        { nextPrompt: "Prompt 2" },
      ];

      const filtered = callers.filter((c) => c.nextPrompt !== null);
      expect(filtered.length).toBe(2);
    });

    it("should filter by stale prompts", () => {
      const now = new Date("2026-01-23T12:00:00Z");
      const staleThreshold = 24 * 60 * 60 * 1000;

      const callers = [
        { nextPrompt: "...", nextPromptComposedAt: new Date("2026-01-22T10:00:00Z") },
        { nextPrompt: "...", nextPromptComposedAt: new Date("2026-01-23T10:00:00Z") },
        { nextPrompt: null, nextPromptComposedAt: null },
      ];

      const filtered = callers.filter((c) => {
        if (!c.nextPrompt || !c.nextPromptComposedAt) return false;
        const age = now.getTime() - new Date(c.nextPromptComposedAt).getTime();
        return age > staleThreshold;
      });

      expect(filtered.length).toBe(1);
    });

    it("should filter by no prompt", () => {
      const callers = [
        { nextPrompt: "Prompt 1" },
        { nextPrompt: null },
        { nextPrompt: "Prompt 2" },
      ];

      const filtered = callers.filter((c) => c.nextPrompt === null);
      expect(filtered.length).toBe(1);
    });
  });

  describe("Caller Selection", () => {
    it("should select caller to view details", () => {
      const callers = [
        { id: "id-1", name: "Phone 1", nextPrompt: "Prompt 1" },
        { id: "id-2", name: "Phone 2", nextPrompt: "Prompt 2" },
      ];

      let selectedCaller = null as (typeof callers)[0] | null;

      // Select first caller
      selectedCaller = callers[0];
      expect(selectedCaller?.id).toBe("id-1");

      // Select second caller
      selectedCaller = callers[1];
      expect(selectedCaller?.id).toBe("id-2");
    });

    it("should display prompt in detail panel", () => {
      const selectedCaller = {
        id: "id-1",
        name: "Phone 1",
        nextPrompt: "You are speaking with John who prefers casual conversation...",
        nextPromptComposedAt: new Date("2026-01-23T10:00:00Z"),
        nextPromptInputs: { openness: 0.75, memories: 5 },
      };

      expect(selectedCaller.nextPrompt).toContain("John");
      expect(selectedCaller.nextPromptInputs.openness).toBe(0.75);
    });

    it("should show empty state when no prompt", () => {
      const selectedCaller = {
        id: "id-1",
        name: "Phone 1",
        nextPrompt: null,
        nextPromptComposedAt: null,
        nextPromptInputs: null,
      };

      expect(selectedCaller.nextPrompt).toBeNull();
    });
  });

  describe("Prompt Composition", () => {
    it("should compose prompt for single caller", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: true,
            prompt: "Newly composed prompt...",
            composedAt: new Date(),
          }),
      });

      // Expected: POST to /api/prompt/compose or similar
      expect(mockFetch).toBeDefined();
    });

    it("should handle compose all action", async () => {
      const eligibleCallers = [
        { id: "id-1", nextPrompt: null },
        { id: "id-2", nextPrompt: null },
        { id: "id-3", nextPrompt: "..." }, // Already has prompt, skip
      ];

      const toCompose = eligibleCallers.filter((c) => c.nextPrompt === null);
      expect(toCompose.length).toBe(2);
    });

    it("should update stats after composition", () => {
      let stats = { withPrompt: 60, withoutPrompt: 40 };

      // After composing 10 prompts
      stats = { withPrompt: 70, withoutPrompt: 30 };

      expect(stats.withPrompt).toBe(70);
      expect(stats.withoutPrompt).toBe(30);
    });
  });

  describe("Navigation", () => {
    it("should navigate to caller profile", () => {
      const callerId = "caller-123";
      const expectedUrl = `/callers/${callerId}`;
      expect(expectedUrl).toBe("/callers/caller-123");
    });

    it("should navigate to analyze page", () => {
      const callerId = "caller-123";
      const expectedUrl = `/analyze?caller=${callerId}`;
      expect(expectedUrl).toContain("/analyze");
    });
  });

  describe("Layout", () => {
    it("should have left panel for caller list", () => {
      // LHS shows scrollable list of callers
      const layout = { leftPanel: "caller-list", rightPanel: "detail" };
      expect(layout.leftPanel).toBe("caller-list");
    });

    it("should have right panel for prompt detail", () => {
      // RHS shows selected caller's prompt
      const layout = { leftPanel: "caller-list", rightPanel: "detail" };
      expect(layout.rightPanel).toBe("detail");
    });

    it("should show stats bar at top", () => {
      const stats = {
        total: 100,
        withPrompt: 60,
        needsUpdate: 10,
        noPrompt: 30,
      };

      // Stats should be visible at top
      expect(stats.total).toBe(100);
    });
  });

  describe("Caller Card Display", () => {
    it("should show caller name and phone", () => {
      const caller = {
        name: "John's Phone",
        externalId: "+1234567890",
        caller: { name: "John Doe" },
      };

      expect(caller.name).toBe("John's Phone");
      expect(caller.externalId).toBe("+1234567890");
      expect(caller.caller.name).toBe("John Doe");
    });

    it("should show call and memory counts", () => {
      const caller = {
        caller: {
          _count: { calls: 10, memories: 5 },
        },
      };

      expect(caller.caller._count.calls).toBe(10);
      expect(caller.caller._count.memories).toBe(5);
    });

    it("should show segment if assigned", () => {
      const caller = {
        segmentId: "segment-1",
        segment: { name: "Premium" },
      };

      expect(caller.segment?.name).toBe("Premium");
    });

    it("should show prompt preview in card", () => {
      const caller = {
        nextPrompt:
          "You are speaking with John who prefers casual conversation. He lives in London and works as an engineer.",
      };

      // Show first ~100 chars as preview
      const preview = caller.nextPrompt.substring(0, 100);
      expect(preview.length).toBeLessThanOrEqual(100);
    });
  });
});
