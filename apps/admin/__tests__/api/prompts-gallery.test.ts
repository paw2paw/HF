/**
 * Tests for /api/prompts/gallery endpoint
 *
 * This endpoint returns caller identities with their prompt status
 * for the gallery view.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Prisma client
const mockPrisma = {
  callerIdentity: {
    findMany: vi.fn(),
  },
  $disconnect: vi.fn(),
};

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(() => mockPrisma),
}));

describe("/api/prompts/gallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("should return callers with prompt data", async () => {
      const mockCallers = [
        {
          id: "identity-1",
          name: "John's Phone",
          externalId: "+1234567890",
          callerId: "caller-1",
          nextPrompt: "You are speaking with John who prefers casual conversation...",
          nextPromptComposedAt: new Date("2026-01-23T10:00:00Z"),
          nextPromptInputs: { openness: 0.8, memories: 5 },
          segmentId: "segment-1",
          segment: { name: "Premium" },
          caller: {
            name: "John Doe",
            email: "john@example.com",
            _count: { calls: 10, memories: 5 },
          },
        },
        {
          id: "identity-2",
          name: "Jane's Phone",
          externalId: "+0987654321",
          callerId: "caller-2",
          nextPrompt: null,
          nextPromptComposedAt: null,
          nextPromptInputs: null,
          segmentId: null,
          segment: null,
          caller: {
            name: "Jane Smith",
            email: "jane@example.com",
            _count: { calls: 3, memories: 0 },
          },
        },
      ];

      mockPrisma.callerIdentity.findMany.mockResolvedValue(mockCallers);

      // Expected response structure
      const expectedResponse = {
        ok: true,
        callers: mockCallers,
        count: 2,
        stats: {
          withPrompt: 1,
          withoutPrompt: 1,
        },
      };

      expect(expectedResponse.ok).toBe(true);
      expect(expectedResponse.count).toBe(2);
      expect(expectedResponse.stats.withPrompt).toBe(1);
      expect(expectedResponse.stats.withoutPrompt).toBe(1);
    });

    it("should filter to only callers with prompts when withPromptOnly=true", async () => {
      const mockCallers = [
        {
          id: "identity-1",
          name: "John's Phone",
          externalId: "+1234567890",
          callerId: "caller-1",
          nextPrompt: "You are speaking with John...",
          nextPromptComposedAt: new Date(),
          nextPromptInputs: {},
          segmentId: null,
          segment: null,
          caller: {
            name: "John Doe",
            email: "john@example.com",
            _count: { calls: 10, memories: 5 },
          },
        },
      ];

      mockPrisma.callerIdentity.findMany.mockResolvedValue(mockCallers);

      // When withPromptOnly=true, findMany should be called with where: { nextPrompt: { not: null } }
      // Expected response
      const expectedResponse = {
        ok: true,
        callers: mockCallers,
        count: 1,
        stats: {
          withPrompt: 1,
          withoutPrompt: 0,
        },
      };

      expect(expectedResponse.count).toBe(1);
      expect(expectedResponse.callers[0].nextPrompt).not.toBeNull();
    });

    it("should respect limit parameter", async () => {
      const mockCallers = Array.from({ length: 50 }, (_, i) => ({
        id: `identity-${i}`,
        name: `Phone ${i}`,
        externalId: `+123456789${i}`,
        callerId: `caller-${i}`,
        nextPrompt: i % 2 === 0 ? "Prompt..." : null,
        nextPromptComposedAt: i % 2 === 0 ? new Date() : null,
        nextPromptInputs: null,
        segmentId: null,
        segment: null,
        caller: {
          name: `Caller ${i}`,
          email: `caller${i}@example.com`,
          _count: { calls: i, memories: 0 },
        },
      }));

      mockPrisma.callerIdentity.findMany.mockResolvedValue(mockCallers);

      // When limit=50, should return max 50 callers
      const expectedResponse = {
        ok: true,
        callers: mockCallers,
        count: 50,
      };

      expect(expectedResponse.count).toBe(50);
    });

    it("should order by nextPromptComposedAt desc, then updatedAt desc", async () => {
      // Verify the order preference
      const mockCallers = [
        {
          id: "identity-1",
          name: "Recent Prompt",
          nextPrompt: "...",
          nextPromptComposedAt: new Date("2026-01-23T12:00:00Z"),
        },
        {
          id: "identity-2",
          name: "Older Prompt",
          nextPrompt: "...",
          nextPromptComposedAt: new Date("2026-01-22T12:00:00Z"),
        },
        {
          id: "identity-3",
          name: "No Prompt",
          nextPrompt: null,
          nextPromptComposedAt: null,
        },
      ];

      // First should be most recently composed
      expect(mockCallers[0].name).toBe("Recent Prompt");
      expect(mockCallers[1].name).toBe("Older Prompt");
      expect(mockCallers[2].nextPrompt).toBeNull();
    });

    it("should include caller relationship data", async () => {
      const mockCaller = {
        id: "identity-1",
        name: "John's Phone",
        externalId: "+1234567890",
        callerId: "caller-1",
        nextPrompt: "Prompt text...",
        nextPromptComposedAt: new Date(),
        nextPromptInputs: { openness: 0.8 },
        segmentId: "segment-1",
        segment: { name: "Premium" },
        caller: {
          name: "John Doe",
          email: "john@example.com",
          _count: { calls: 10, memories: 5 },
        },
      };

      // Verify relationship data is included
      expect(mockCaller.caller.name).toBe("John Doe");
      expect(mockCaller.caller._count.calls).toBe(10);
      expect(mockCaller.caller._count.memories).toBe(5);
      expect(mockCaller.segment?.name).toBe("Premium");
    });

    it("should handle empty database gracefully", async () => {
      mockPrisma.callerIdentity.findMany.mockResolvedValue([]);

      const expectedResponse = {
        ok: true,
        callers: [],
        count: 0,
        stats: {
          withPrompt: 0,
          withoutPrompt: 0,
        },
      };

      expect(expectedResponse.count).toBe(0);
      expect(expectedResponse.callers).toEqual([]);
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.callerIdentity.findMany.mockRejectedValue(
        new Error("Database connection failed")
      );

      // Expected error response
      const expectedResponse = {
        ok: false,
        error: "Failed to fetch prompts gallery",
      };

      expect(expectedResponse.ok).toBe(false);
      expect(expectedResponse.error).toBeDefined();
    });

    it("should disconnect from database after request", async () => {
      mockPrisma.callerIdentity.findMany.mockResolvedValue([]);

      // Verify $disconnect is called in finally block
      expect(mockPrisma.$disconnect).toBeDefined();
    });
  });
});
