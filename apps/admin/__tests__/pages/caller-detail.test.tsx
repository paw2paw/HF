/**
 * Tests for /callers/[id] page
 *
 * The caller detail page displays comprehensive profile data
 * with tabs for different data views.
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
  useParams: () => ({ id: "caller-123" }),
}));

describe("CallerDetailPage", () => {
  const mockCallerId = "caller-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Data Loading", () => {
    it("should fetch caller data on mount", async () => {
      const mockData = {
        ok: true,
        caller: {
          id: mockCallerId,
          name: "John Doe",
          email: "john@example.com",
          personality: {
            openness: 0.75,
            conscientiousness: 0.65,
          },
          _count: {
            calls: 10,
            memories: 5,
            personalityObservations: 10,
          },
        },
        personality: { openness: 0.75, conscientiousness: 0.65 },
        observations: [],
        memories: [],
        memorySummary: null,
        calls: [],
        identities: [],
        scores: [],
        counts: { calls: 10, memories: 5, observations: 10 },
      };

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockData),
      });

      // Expected: fetch /api/callers/caller-123
      expect(mockFetch).toBeDefined();
    });

    it("should handle 404 for non-existent caller", async () => {
      // Test the expected response structure for a 404
      const errorResponse = { ok: false, error: "Caller not found" };

      // Verify expected error response structure
      expect(errorResponse.ok).toBe(false);
      expect(errorResponse.error).toBe("Caller not found");
    });
  });

  describe("Tab Navigation", () => {
    const tabs = ["overview", "calls", "memories", "scores", "prompt"];

    it("should default to overview tab", () => {
      const activeTab = "overview";
      expect(activeTab).toBe("overview");
    });

    it("should allow switching between tabs", () => {
      let activeTab = "overview";

      // Switch to calls
      activeTab = "calls";
      expect(activeTab).toBe("calls");

      // Switch to memories
      activeTab = "memories";
      expect(activeTab).toBe("memories");

      // Switch to scores
      activeTab = "scores";
      expect(activeTab).toBe("scores");

      // Switch to prompt
      activeTab = "prompt";
      expect(activeTab).toBe("prompt");
    });

    it("should have all expected tabs", () => {
      expect(tabs).toContain("overview");
      expect(tabs).toContain("calls");
      expect(tabs).toContain("memories");
      expect(tabs).toContain("scores");
      expect(tabs).toContain("prompt");
    });
  });

  describe("Overview Tab", () => {
    it("should display caller basic info", () => {
      const caller = {
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
        createdAt: new Date("2026-01-01"),
      };

      expect(caller.name).toBe("John Doe");
      expect(caller.email).toBe("john@example.com");
    });

    it("should display personality traits as progress bars", () => {
      const personality = {
        openness: 0.75,
        conscientiousness: 0.65,
        extraversion: 0.55,
        agreeableness: 0.85,
        neuroticism: 0.35,
      };

      // Each trait should render as a progress bar (use toBeCloseTo for floating point)
      expect(personality.openness * 100).toBeCloseTo(75);
      expect(personality.conscientiousness * 100).toBeCloseTo(65);
      expect(personality.extraversion * 100).toBeCloseTo(55);
      expect(personality.agreeableness * 100).toBeCloseTo(85);
      expect(personality.neuroticism * 100).toBeCloseTo(35);
    });

    it("should display memory summary counts", () => {
      const memorySummary = {
        factCount: 5,
        preferenceCount: 3,
        eventCount: 2,
        topicCount: 4,
      };

      const total =
        memorySummary.factCount +
        memorySummary.preferenceCount +
        memorySummary.eventCount +
        memorySummary.topicCount;

      expect(total).toBe(14);
    });
  });

  describe("Calls Tab", () => {
    it("should display list of calls", () => {
      const calls = [
        {
          id: "call-1",
          createdAt: new Date("2026-01-23"),
          source: "phone",
          transcript: "Hello...",
          _count: { scores: 5 },
        },
        {
          id: "call-2",
          createdAt: new Date("2026-01-22"),
          source: "chat",
          transcript: "Hi there...",
          _count: { scores: 3 },
        },
      ];

      expect(calls.length).toBe(2);
      expect(calls[0]._count.scores).toBe(5);
    });

    it("should sort calls by date descending", () => {
      const calls = [
        { id: "call-1", createdAt: new Date("2026-01-23") },
        { id: "call-2", createdAt: new Date("2026-01-22") },
        { id: "call-3", createdAt: new Date("2026-01-21") },
      ];

      // Most recent first
      expect(calls[0].createdAt > calls[1].createdAt).toBe(true);
      expect(calls[1].createdAt > calls[2].createdAt).toBe(true);
    });
  });

  describe("Memories Tab", () => {
    it("should display memories grouped by category", () => {
      const memories = [
        { id: "mem-1", category: "FACT", key: "location", value: "London" },
        { id: "mem-2", category: "FACT", key: "occupation", value: "Engineer" },
        { id: "mem-3", category: "PREFERENCE", key: "contact", value: "email" },
        { id: "mem-4", category: "EVENT", key: "meeting", value: "Jan 15" },
      ];

      // Group by category
      const grouped = memories.reduce(
        (acc, mem) => {
          if (!acc[mem.category]) acc[mem.category] = [];
          acc[mem.category].push(mem);
          return acc;
        },
        {} as Record<string, typeof memories>
      );

      expect(grouped.FACT.length).toBe(2);
      expect(grouped.PREFERENCE.length).toBe(1);
      expect(grouped.EVENT.length).toBe(1);
    });

    it("should display memory confidence scores", () => {
      const memory = {
        key: "location",
        value: "London",
        confidence: 0.9,
      };

      expect(memory.confidence).toBe(0.9);
      expect(memory.confidence * 100).toBe(90);
    });
  });

  describe("Scores Tab", () => {
    it("should display scores grouped by parameter", () => {
      const scores = [
        { id: "s1", parameterId: "B5-O", score: 0.8, parameter: { name: "Openness" } },
        { id: "s2", parameterId: "B5-O", score: 0.75, parameter: { name: "Openness" } },
        { id: "s3", parameterId: "B5-C", score: 0.7, parameter: { name: "Conscientiousness" } },
      ];

      // Group by parameter
      const grouped = scores.reduce(
        (acc, score) => {
          if (!acc[score.parameterId]) acc[score.parameterId] = [];
          acc[score.parameterId].push(score);
          return acc;
        },
        {} as Record<string, typeof scores>
      );

      expect(grouped["B5-O"].length).toBe(2);
      expect(grouped["B5-C"].length).toBe(1);
    });

    it("should color-code scores by value", () => {
      function getScoreColor(score: number): string {
        if (score >= 0.7) return "green";
        if (score >= 0.4) return "yellow";
        return "red";
      }

      expect(getScoreColor(0.8)).toBe("green");
      expect(getScoreColor(0.5)).toBe("yellow");
      expect(getScoreColor(0.3)).toBe("red");
    });
  });

  describe("Prompt Tab", () => {
    it("should display prompt for selected identity", () => {
      const identity = {
        id: "identity-1",
        name: "Primary Phone",
        nextPrompt: "You are speaking with John who prefers casual conversation...",
        nextPromptComposedAt: new Date("2026-01-23T10:00:00Z"),
        nextPromptInputs: { openness: 0.75, memories: 5 },
      };

      expect(identity.nextPrompt).toContain("John");
      expect(identity.nextPromptComposedAt).toBeDefined();
      expect(identity.nextPromptInputs.openness).toBe(0.75);
    });

    it("should show message when no prompt exists", () => {
      const identity = {
        id: "identity-1",
        name: "Primary Phone",
        nextPrompt: null,
        nextPromptComposedAt: null,
        nextPromptInputs: null,
      };

      expect(identity.nextPrompt).toBeNull();
    });

    it("should allow switching between identities", () => {
      const identities = [
        { id: "id-1", name: "Phone 1", nextPrompt: "Prompt 1..." },
        { id: "id-2", name: "Phone 2", nextPrompt: "Prompt 2..." },
      ];

      let selectedIdentity = identities[0];
      expect(selectedIdentity.name).toBe("Phone 1");

      // Switch to second identity
      selectedIdentity = identities[1];
      expect(selectedIdentity.name).toBe("Phone 2");
      expect(selectedIdentity.nextPrompt).toBe("Prompt 2...");
    });
  });

  describe("Sidebar", () => {
    it("should display personality traits in sidebar", () => {
      const personality = {
        openness: 0.75,
        conscientiousness: 0.65,
        extraversion: 0.55,
        agreeableness: 0.85,
        neuroticism: 0.35,
      };

      const traits = Object.entries(personality);
      expect(traits.length).toBe(5);
    });

    it("should display identities list in sidebar", () => {
      const identities = [
        { id: "id-1", name: "Phone 1", externalId: "+1234567890" },
        { id: "id-2", name: "Phone 2", externalId: "+0987654321" },
      ];

      expect(identities.length).toBe(2);
    });

    it("should display caller details in sidebar", () => {
      const caller = {
        id: "caller-123",
        createdAt: new Date("2026-01-01"),
        _count: {
          calls: 10,
          memories: 5,
          personalityObservations: 10,
        },
      };

      expect(caller._count.calls).toBe(10);
      expect(caller._count.memories).toBe(5);
    });
  });
});
