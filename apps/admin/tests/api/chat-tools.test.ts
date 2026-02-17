import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  mediaAsset: {
    findUnique: vi.fn(),
  },
  callMessage: {
    create: vi.fn(),
  },
  subjectMedia: {
    findMany: vi.fn(),
  },
  caller: {
    findUnique: vi.fn(),
  },
  onboardingSession: {
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

vi.mock("@/lib/permissions", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    session: { user: { id: "test-user", email: "test@test.com", role: "OPERATOR" } },
  }),
  isAuthError: vi.fn().mockReturnValue(false),
}));

describe("chat tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // vi.resetModules() omitted
  });

  describe("executeToolCall — share_content", () => {
    it("creates a media CallMessage for valid media", async () => {
      mockPrisma.mediaAsset.findUnique.mockResolvedValue({
        id: "media-1",
        fileName: "passage.png",
        mimeType: "image/png",
        title: "Passage Image",
      });
      mockPrisma.callMessage.create.mockResolvedValue({
        id: "msg-1",
        callId: "call-1",
        role: "assistant",
        content: "Here is the passage",
        mediaId: "media-1",
      });

      const { executeToolCall } = await import("@/app/api/chat/tools");

      const result = await executeToolCall(
        { id: "tu-1", name: "share_content", input: { media_id: "media-1", context: "Here is the passage" } },
        { callerId: "caller-1", callId: "call-1" }
      );

      expect(result.is_error).toBeFalsy();
      expect(result.content).toContain("shared");
      expect(mockPrisma.callMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          callId: "call-1",
          role: "assistant",
          mediaId: "media-1",
        }),
      });
    });

    it("returns error when media not found", async () => {
      mockPrisma.mediaAsset.findUnique.mockResolvedValue(null);

      const { executeToolCall } = await import("@/app/api/chat/tools");

      const result = await executeToolCall(
        { id: "tu-2", name: "share_content", input: { media_id: "nonexistent" } },
        { callerId: "caller-1", callId: "call-1" }
      );

      expect(result.is_error).toBe(true);
      expect(result.content).toContain("not found");
      expect(mockPrisma.callMessage.create).not.toHaveBeenCalled();
    });

    it("returns error for unknown tool", async () => {
      const { executeToolCall } = await import("@/app/api/chat/tools");

      const result = await executeToolCall(
        { id: "tu-3", name: "unknown_tool", input: {} },
        { callerId: "caller-1", callId: "call-1" }
      );

      expect(result.is_error).toBe(true);
      expect(result.content).toContain("Unknown tool");
    });
  });

  describe("buildContentCatalog", () => {
    it("builds catalog from caller domain subjects", async () => {
      mockPrisma.caller.findUnique.mockResolvedValue({
        id: "caller-1",
        domainId: "domain-1",
        domain: {
          onboardingFlowPhases: null,
          subjects: [{ subjectId: "sub-1" }],
        },
      });
      mockPrisma.onboardingSession.findUnique.mockResolvedValue({ isComplete: true });

      mockPrisma.subjectMedia.findMany.mockResolvedValue([
        {
          media: {
            id: "media-1",
            fileName: "passage.pdf",
            mimeType: "application/pdf",
            title: "Chapter 1 Passage",
            description: null,
            tags: [],
          },
        },
      ]);

      const { buildContentCatalog } = await import("@/app/api/chat/tools");
      const catalog = await buildContentCatalog("caller-1");

      expect(catalog).toContain("Chapter 1 Passage");
      expect(catalog).toContain("media-1");
      expect(catalog).toContain("Available Teaching Materials");
    });

    it("returns null when caller not found", async () => {
      mockPrisma.caller.findUnique.mockResolvedValue(null);

      const { buildContentCatalog } = await import("@/app/api/chat/tools");
      const catalog = await buildContentCatalog("caller-1");

      expect(catalog).toBeNull();
    });

    it("returns null when no subjects linked", async () => {
      mockPrisma.caller.findUnique.mockResolvedValue({
        id: "caller-1",
        domainId: "domain-1",
        domain: { onboardingFlowPhases: null, subjects: [] },
      });

      const { buildContentCatalog } = await import("@/app/api/chat/tools");
      const catalog = await buildContentCatalog("caller-1");

      expect(catalog).toBeNull();
    });

    it("returns null when no media linked to subjects", async () => {
      mockPrisma.caller.findUnique.mockResolvedValue({
        id: "caller-1",
        domainId: "domain-1",
        domain: { onboardingFlowPhases: null, subjects: [{ subjectId: "sub-1" }] },
      });
      mockPrisma.onboardingSession.findUnique.mockResolvedValue({ isComplete: true });
      mockPrisma.subjectMedia.findMany.mockResolvedValue([]);

      const { buildContentCatalog } = await import("@/app/api/chat/tools");
      const catalog = await buildContentCatalog("caller-1");

      expect(catalog).toBeNull();
    });

    it("annotates media with phase hints for first-call callers", async () => {
      mockPrisma.caller.findUnique.mockResolvedValue({
        id: "caller-1",
        domainId: "domain-1",
        domain: {
          onboardingFlowPhases: {
            phases: [
              { phase: "welcome", duration: "2min", goals: ["Greet"] },
              { phase: "first-topic", duration: "5min", goals: ["Teach"], content: [
                { mediaId: "media-1", instruction: "Share the passage for reading" },
              ]},
            ],
          },
          subjects: [{ subjectId: "sub-1" }],
        },
      });
      // No onboarding session = first call in domain
      mockPrisma.onboardingSession.findUnique.mockResolvedValue(null);

      mockPrisma.subjectMedia.findMany.mockResolvedValue([
        {
          media: {
            id: "media-1",
            fileName: "black-death.pdf",
            mimeType: "application/pdf",
            title: "Black Death Passage",
            description: null,
            tags: [],
          },
        },
        {
          media: {
            id: "media-2",
            fileName: "quiz.png",
            mimeType: "image/png",
            title: "Quiz Image",
            description: null,
            tags: [],
          },
        },
      ]);

      const { buildContentCatalog } = await import("@/app/api/chat/tools");
      const catalog = await buildContentCatalog("caller-1");

      // Phase-linked media should have annotation
      expect(catalog).toContain('SHARE DURING: "first-topic" phase');
      expect(catalog).toContain("Share the passage for reading");
      // Non-phase media should NOT have annotation
      expect(catalog).toContain("Quiz Image");
      expect(catalog).not.toContain('Quiz Image.*SHARE DURING');
      // Should include the phase instruction note
      expect(catalog).toContain("Items marked with");
    });

    it("does not annotate phase content for returning callers", async () => {
      mockPrisma.caller.findUnique.mockResolvedValue({
        id: "caller-1",
        domainId: "domain-1",
        domain: {
          onboardingFlowPhases: {
            phases: [
              { phase: "first-topic", duration: "5min", goals: ["Teach"], content: [
                { mediaId: "media-1", instruction: "Share passage" },
              ]},
            ],
          },
          subjects: [{ subjectId: "sub-1" }],
        },
      });
      // Completed onboarding = returning caller
      mockPrisma.onboardingSession.findUnique.mockResolvedValue({ isComplete: true });

      mockPrisma.subjectMedia.findMany.mockResolvedValue([
        {
          media: {
            id: "media-1",
            fileName: "passage.pdf",
            mimeType: "application/pdf",
            title: "Passage",
            description: null,
            tags: [],
          },
        },
      ]);

      const { buildContentCatalog } = await import("@/app/api/chat/tools");
      const catalog = await buildContentCatalog("caller-1");

      expect(catalog).toContain("Passage");
      expect(catalog).not.toContain("SHARE DURING");
    });
  });
});
