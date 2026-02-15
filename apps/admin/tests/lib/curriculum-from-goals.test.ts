/**
 * Tests for generateCurriculumFromGoals()
 *
 * Verifies AI-based curriculum generation from subject + persona + goals
 * (without uploaded materials).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the metered AI completion
const mockAICompletion = vi.fn();

vi.mock("@/lib/metering/instrumented-ai", () => ({
  getConfiguredMeteredAICompletion: (...args: unknown[]) => mockAICompletion(...args),
}));

import {
  generateCurriculumFromGoals,
  type ExtractedCurriculum,
} from "@/lib/content-trust/extract-curriculum";

// ── Test Data ──────────────────────────────────────────

const validCurriculumResponse = JSON.stringify({
  name: "Introduction to Financial Planning",
  description: "A comprehensive curriculum covering personal finance fundamentals",
  modules: [
    {
      id: "MOD-1",
      title: "Foundations of Personal Finance",
      description: "Core concepts and terminology",
      learningOutcomes: [
        "LO1: Identify key financial planning concepts",
        "LO2: Explain the difference between saving and investing",
      ],
      assessmentCriteria: ["Can define financial planning", "Can list 3 types of savings accounts"],
      keyTerms: ["compound interest", "liquidity", "diversification"],
      estimatedDurationMinutes: 30,
      sortOrder: 1,
    },
    {
      id: "MOD-2",
      title: "Tax-Efficient Investing",
      description: "Understanding ISAs and tax wrappers",
      learningOutcomes: [
        "LO1: Explain ISA allowances and rules",
        "LO2: Compare different ISA types",
      ],
      assessmentCriteria: ["Can state current ISA allowance", "Can explain S&S ISA vs Cash ISA"],
      keyTerms: ["ISA", "capital gains", "tax wrapper"],
      estimatedDurationMinutes: 45,
      sortOrder: 2,
    },
  ],
  deliveryConfig: {
    sessionStructure: ["Review", "New content", "Practice", "Summary"],
    assessmentStrategy: "Formative checks per module",
    pedagogicalNotes: ["Use real-world examples"],
  },
});

// ── Tests ──────────────────────────────────────────────

describe("generateCurriculumFromGoals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates curriculum from subject + goals", async () => {
    mockAICompletion.mockResolvedValueOnce({
      content: validCurriculumResponse,
    });

    const result = await generateCurriculumFromGoals(
      "Financial Planning",
      "tutor",
      ["Understand ISA allowances", "Calculate tax-efficient returns"],
    );

    expect(result.ok).toBe(true);
    expect(result.modules).toHaveLength(2);
    expect(result.modules[0].id).toBe("MOD-1");
    expect(result.modules[0].learningOutcomes.length).toBeGreaterThan(0);
    expect(result.deliveryConfig.sessionStructure).toBeDefined();
    expect(result.warnings).toEqual([]);
  });

  it("generates curriculum without goals (AI infers)", async () => {
    mockAICompletion.mockResolvedValueOnce({
      content: validCurriculumResponse,
    });

    const result = await generateCurriculumFromGoals(
      "Financial Planning",
      "coach",
      [],
    );

    expect(result.ok).toBe(true);
    expect(result.modules.length).toBeGreaterThan(0);
    expect(result.warnings).toContain(
      "No goals provided — curriculum is based on AI inference for this subject"
    );
  });

  it("includes qualificationRef in AI prompt when provided", async () => {
    mockAICompletion.mockResolvedValueOnce({
      content: validCurriculumResponse,
    });

    await generateCurriculumFromGoals(
      "Food Safety",
      "tutor",
      ["Pass Level 2 exam"],
      "Highfield L2 Food Safety",
    );

    // Verify the prompt includes qualificationRef
    const call = mockAICompletion.mock.calls[0][0];
    const userMessage = call.messages.find((m: any) => m.role === "user");
    expect(userMessage.content).toContain("Highfield L2 Food Safety");
  });

  it("uses correct AI call point", async () => {
    mockAICompletion.mockResolvedValueOnce({
      content: validCurriculumResponse,
    });

    await generateCurriculumFromGoals("Test Subject", "tutor", []);

    expect(mockAICompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        callPoint: "content-trust.curriculum-from-goals",
      })
    );
  });

  it("returns same shape as assertion-based extraction", async () => {
    mockAICompletion.mockResolvedValueOnce({
      content: validCurriculumResponse,
    });

    const result = await generateCurriculumFromGoals("Test", "tutor", ["Goal 1"]);

    // Verify ExtractedCurriculum shape
    expect(result).toHaveProperty("ok");
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("description");
    expect(result).toHaveProperty("modules");
    expect(result).toHaveProperty("deliveryConfig");
    expect(result).toHaveProperty("warnings");

    // Verify CurriculumModule shape
    const mod = result.modules[0];
    expect(mod).toHaveProperty("id");
    expect(mod).toHaveProperty("title");
    expect(mod).toHaveProperty("description");
    expect(mod).toHaveProperty("learningOutcomes");
    expect(mod).toHaveProperty("sortOrder");
  });

  it("handles AI returning invalid JSON", async () => {
    mockAICompletion.mockResolvedValueOnce({
      content: "I cannot generate a curriculum for that topic.",
    });

    const result = await generateCurriculumFromGoals("Test", "tutor", []);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("AI did not return valid JSON");
    expect(result.modules).toEqual([]);
  });

  it("handles AI call failure", async () => {
    mockAICompletion.mockRejectedValueOnce(new Error("API rate limit exceeded"));

    const result = await generateCurriculumFromGoals("Test", "tutor", []);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("API rate limit exceeded");
    expect(result.modules).toEqual([]);
  });

  it("fills in default module fields when AI omits them", async () => {
    mockAICompletion.mockResolvedValueOnce({
      content: JSON.stringify({
        name: "Minimal",
        description: "Minimal curriculum",
        modules: [
          { title: "Module A" },
          { title: "Module B" },
        ],
        deliveryConfig: {},
      }),
    });

    const result = await generateCurriculumFromGoals("Test", "tutor", []);

    expect(result.ok).toBe(true);
    expect(result.modules[0].id).toBe("MOD-1");
    expect(result.modules[0].sortOrder).toBe(1);
    expect(result.modules[1].id).toBe("MOD-2");
    expect(result.modules[1].sortOrder).toBe(2);
  });
});
