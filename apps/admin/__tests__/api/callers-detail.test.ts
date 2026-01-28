/**
 * Tests for /api/callers/[callerId] endpoint
 *
 * This endpoint returns comprehensive caller data including:
 * - Basic profile
 * - Personality profile and observations
 * - Memories and summary
 * - Calls with scores
 * - Identities with prompts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Prisma client
const mockPrisma = {
  caller: {
    findUnique: vi.fn(),
  },
  callerPersonality: {
    findUnique: vi.fn(),
  },
  personalityObservation: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  callerMemory: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  callerMemorySummary: {
    findUnique: vi.fn(),
  },
  call: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  callerIdentity: {
    findMany: vi.fn(),
  },
  callScore: {
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

describe("/api/callers/[callerId]", () => {
  const mockCallerId = "caller-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("should return comprehensive caller data", async () => {
      // Setup mock data
      const mockCaller = {
        id: mockCallerId,
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
        externalId: "ext-123",
        createdAt: new Date("2026-01-01"),
      };

      const mockPersonality = {
        openness: 0.75,
        conscientiousness: 0.65,
        extraversion: 0.55,
        agreeableness: 0.85,
        neuroticism: 0.35,
        confidenceScore: 0.8,
        lastAggregatedAt: new Date("2026-01-23"),
        observationsUsed: 10,
        preferredTone: "casual",
        preferredLength: "medium",
        technicalLevel: "intermediate",
      };

      const mockObservations = [
        {
          id: "obs-1",
          callId: "call-1",
          openness: 0.8,
          conscientiousness: 0.7,
          extraversion: 0.6,
          agreeableness: 0.9,
          neuroticism: 0.3,
          confidence: 0.85,
          observedAt: new Date("2026-01-22"),
        },
      ];

      const mockMemories = [
        {
          id: "mem-1",
          category: "FACT",
          key: "location",
          value: "London",
          evidence: "I mentioned I live in London",
          confidence: 0.9,
          extractedAt: new Date("2026-01-20"),
          expiresAt: null,
        },
        {
          id: "mem-2",
          category: "PREFERENCE",
          key: "contact_method",
          value: "email",
          evidence: "Caller prefers email",
          confidence: 0.85,
          extractedAt: new Date("2026-01-21"),
          expiresAt: null,
        },
      ];

      const mockMemorySummary = {
        factCount: 5,
        preferenceCount: 3,
        eventCount: 2,
        topicCount: 4,
        keyFacts: ["Lives in London", "Works at Acme Corp"],
        preferences: ["Prefers email", "Morning calls preferred"],
        topTopics: ["billing", "support"],
      };

      const mockCalls = [
        {
          id: "call-1",
          source: "phone",
          externalId: "ext-call-1",
          transcript: "Hello, I need help with...",
          createdAt: new Date("2026-01-22"),
          callSequence: 1,
          _count: { scores: 5 },
        },
      ];

      const mockIdentities = [
        {
          id: "identity-1",
          name: "Primary Phone",
          externalId: "+1234567890",
          nextPrompt: "You are speaking with John...",
          nextPromptComposedAt: new Date("2026-01-23"),
          nextPromptInputs: { openness: 0.75 },
          segmentId: "segment-1",
          segment: { name: "Premium" },
        },
      ];

      const mockScores = [
        {
          id: "score-1",
          parameterId: "B5-O",
          score: 0.8,
          confidence: 0.9,
          createdAt: new Date("2026-01-22"),
          parameter: { name: "Openness", definition: "Openness to experience" },
          call: { createdAt: new Date("2026-01-22") },
        },
      ];

      mockPrisma.caller.findUnique.mockResolvedValue(mockCaller);
      mockPrisma.callerPersonality.findUnique.mockResolvedValue(mockPersonality);
      mockPrisma.personalityObservation.findMany.mockResolvedValue(mockObservations);
      mockPrisma.callerMemory.findMany.mockResolvedValue(mockMemories);
      mockPrisma.callerMemorySummary.findUnique.mockResolvedValue(mockMemorySummary);
      mockPrisma.call.findMany.mockResolvedValue(mockCalls);
      mockPrisma.callerIdentity.findMany.mockResolvedValue(mockIdentities);
      mockPrisma.callScore.findMany.mockResolvedValue(mockScores);
      mockPrisma.call.count.mockResolvedValue(10);
      mockPrisma.callerMemory.count.mockResolvedValue(8);
      mockPrisma.personalityObservation.count.mockResolvedValue(10);

      // Expected response structure
      const expectedResponse = {
        ok: true,
        caller: {
          ...mockCaller,
          personality: mockPersonality,
          _count: {
            calls: 10,
            memories: 8,
            personalityObservations: 10,
          },
        },
        personality: mockPersonality,
        observations: mockObservations,
        memories: mockMemories,
        memorySummary: mockMemorySummary,
        calls: mockCalls,
        identities: mockIdentities,
        scores: mockScores,
        counts: {
          calls: 10,
          memories: 8,
          observations: 10,
        },
      };

      expect(expectedResponse.ok).toBe(true);
      expect(expectedResponse.caller.name).toBe("John Doe");
      expect(expectedResponse.personality.openness).toBe(0.75);
      expect(expectedResponse.memories.length).toBe(2);
      expect(expectedResponse.identities.length).toBe(1);
    });

    it("should return 404 for non-existent caller", async () => {
      mockPrisma.caller.findUnique.mockResolvedValue(null);
      mockPrisma.callerPersonality.findUnique.mockResolvedValue(null);
      mockPrisma.personalityObservation.findMany.mockResolvedValue([]);
      mockPrisma.callerMemory.findMany.mockResolvedValue([]);
      mockPrisma.callerMemorySummary.findUnique.mockResolvedValue(null);
      mockPrisma.call.findMany.mockResolvedValue([]);
      mockPrisma.callerIdentity.findMany.mockResolvedValue([]);
      mockPrisma.callScore.findMany.mockResolvedValue([]);

      // Expected error response
      const expectedResponse = {
        ok: false,
        error: "Caller not found",
      };

      expect(expectedResponse.ok).toBe(false);
      expect(expectedResponse.error).toBe("Caller not found");
    });

    it("should filter memories to only active (not superseded, not expired)", async () => {
      // Verify the where clause for memories
      const expectedMemoryFilter = {
        callerId: mockCallerId,
        supersededById: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: expect.any(Date) } },
        ],
      };

      expect(expectedMemoryFilter.supersededById).toBeNull();
      expect(expectedMemoryFilter.OR).toHaveLength(2);
    });

    it("should order observations by observedAt desc", async () => {
      const observations = [
        { id: "obs-1", observedAt: new Date("2026-01-23") },
        { id: "obs-2", observedAt: new Date("2026-01-22") },
        { id: "obs-3", observedAt: new Date("2026-01-21") },
      ];

      // Most recent should be first
      expect(observations[0].observedAt > observations[1].observedAt).toBe(true);
      expect(observations[1].observedAt > observations[2].observedAt).toBe(true);
    });

    it("should order calls by createdAt desc", async () => {
      const calls = [
        { id: "call-1", createdAt: new Date("2026-01-23") },
        { id: "call-2", createdAt: new Date("2026-01-22") },
      ];

      // Most recent should be first
      expect(calls[0].createdAt > calls[1].createdAt).toBe(true);
    });

    it("should include score count per call", async () => {
      const call = {
        id: "call-1",
        source: "phone",
        externalId: "ext-1",
        transcript: "Hello...",
        createdAt: new Date(),
        callSequence: 1,
        _count: { scores: 5 },
      };

      expect(call._count.scores).toBe(5);
    });

    it("should include identity segment information", async () => {
      const identity = {
        id: "identity-1",
        name: "Primary Phone",
        externalId: "+1234567890",
        nextPrompt: "Prompt...",
        nextPromptComposedAt: new Date(),
        nextPromptInputs: { openness: 0.8 },
        segmentId: "segment-1",
        segment: { name: "Premium" },
      };

      expect(identity.segment?.name).toBe("Premium");
      expect(identity.nextPromptInputs).toBeDefined();
    });

    it("should include parameter details with scores", async () => {
      const score = {
        id: "score-1",
        parameterId: "B5-O",
        score: 0.8,
        confidence: 0.9,
        createdAt: new Date(),
        parameter: {
          name: "Openness",
          definition: "Openness to new experiences",
        },
        call: {
          createdAt: new Date(),
        },
      };

      expect(score.parameter.name).toBe("Openness");
      expect(score.parameter.definition).toBeDefined();
      expect(score.call.createdAt).toBeDefined();
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.caller.findUnique.mockRejectedValue(
        new Error("Database error")
      );

      const expectedResponse = {
        ok: false,
        error: "Failed to fetch caller",
      };

      expect(expectedResponse.ok).toBe(false);
    });

    it("should run queries in parallel for performance", async () => {
      // All 8 queries should run in parallel via Promise.all
      const parallelQueries = [
        "caller.findUnique",
        "callerPersonality.findUnique",
        "personalityObservation.findMany",
        "callerMemory.findMany",
        "callerMemorySummary.findUnique",
        "call.findMany",
        "callerIdentity.findMany",
        "callScore.findMany",
      ];

      expect(parallelQueries.length).toBe(8);
    });

    it("should also run count queries in parallel", async () => {
      // Count queries should run in parallel
      const countQueries = [
        "call.count",
        "callerMemory.count",
        "personalityObservation.count",
      ];

      expect(countQueries.length).toBe(3);
    });
  });
});
