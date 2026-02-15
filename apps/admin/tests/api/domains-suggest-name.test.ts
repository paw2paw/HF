/**
 * Tests for /api/domains/suggest-name endpoint
 *
 * POST: AI-generates a short course name from a free-text brief
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// =====================================================
// MOCK SETUP
// =====================================================

vi.mock("@/lib/metering/instrumented-ai", () => ({
  getConfiguredMeteredAICompletion: vi.fn().mockResolvedValue({
    content: "Introduction to Quantum Mechanics",
  }),
}));

// =====================================================
// TESTS
// =====================================================

describe("/api/domains/suggest-name", () => {
  beforeEach(async () => {
    vi.resetModules();

    // Restore default mock implementations
    const { requireAuth, isAuthError } = await import("@/lib/permissions");
    (isAuthError as any).mockReturnValue(false);
    (requireAuth as any).mockResolvedValue({
      session: {
        user: {
          id: "test-user",
          email: "test@example.com",
          name: "Test User",
          role: "ADMIN",
          image: null,
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      },
    });

    const { getConfiguredMeteredAICompletion } = await import(
      "@/lib/metering/instrumented-ai"
    );
    (getConfiguredMeteredAICompletion as any).mockResolvedValue({
      content: "Introduction to Quantum Mechanics",
    });
  });

  // ===================================================
  // POST — Suggest name
  // ===================================================
  describe("POST", () => {
    it("should return AI-generated name and slug", async () => {
      const { POST } = await import(
        "../../app/api/domains/suggest-name/route"
      );
      const request = new Request(
        "http://localhost/api/domains/suggest-name",
        {
          method: "POST",
          body: JSON.stringify({
            brief: "A course about quantum mechanics for beginners",
          }),
          headers: { "Content-Type": "application/json" },
        }
      );
      const response = await POST(request as any);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.name).toBe("Introduction to Quantum Mechanics");
      expect(data.slug).toBe("introduction-to-quantum-mechanics");
    });

    it("should generate a valid slug from the name", async () => {
      const { getConfiguredMeteredAICompletion } = await import(
        "@/lib/metering/instrumented-ai"
      );
      (getConfiguredMeteredAICompletion as any).mockResolvedValue({
        content: "GCSE Maths Year 10",
      });

      const { POST } = await import(
        "../../app/api/domains/suggest-name/route"
      );
      const request = new Request(
        "http://localhost/api/domains/suggest-name",
        {
          method: "POST",
          body: JSON.stringify({
            brief: "Maths course for GCSE year 10 students",
          }),
          headers: { "Content-Type": "application/json" },
        }
      );
      const response = await POST(request as any);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.name).toBe("GCSE Maths Year 10");
      expect(data.slug).toBe("gcse-maths-year-10");
    });

    it("should use fallback when AI returns empty content", async () => {
      const { getConfiguredMeteredAICompletion } = await import(
        "@/lib/metering/instrumented-ai"
      );
      (getConfiguredMeteredAICompletion as any).mockResolvedValue({
        content: "",
      });

      const { POST } = await import(
        "../../app/api/domains/suggest-name/route"
      );
      const request = new Request(
        "http://localhost/api/domains/suggest-name",
        {
          method: "POST",
          body: JSON.stringify({
            brief: "quantum mechanics for beginners starting out",
          }),
          headers: { "Content-Type": "application/json" },
        }
      );
      const response = await POST(request as any);
      const data = await response.json();

      expect(data.ok).toBe(true);
      // Fallback is first 5 words, title-cased
      expect(data.name).toBe("Quantum Mechanics For Beginners Starting");
      expect(data.slug).toBeTruthy();
    });

    it("should use fallback when AI call throws error", async () => {
      const { getConfiguredMeteredAICompletion } = await import(
        "@/lib/metering/instrumented-ai"
      );
      (getConfiguredMeteredAICompletion as any).mockRejectedValue(
        new Error("AI service unavailable")
      );

      const { POST } = await import(
        "../../app/api/domains/suggest-name/route"
      );
      const request = new Request(
        "http://localhost/api/domains/suggest-name",
        {
          method: "POST",
          body: JSON.stringify({
            brief: "advanced calculus for engineering students today",
          }),
          headers: { "Content-Type": "application/json" },
        }
      );
      const response = await POST(request as any);
      const data = await response.json();

      expect(data.ok).toBe(true);
      // Fallback name from first 5 words
      expect(data.name).toBe("Advanced Calculus For Engineering Students");
      expect(data.slug).toBe("advanced-calculus-for-engineering-students");
    });

    it("should return 400 if brief is missing", async () => {
      const { POST } = await import(
        "../../app/api/domains/suggest-name/route"
      );
      const request = new Request(
        "http://localhost/api/domains/suggest-name",
        {
          method: "POST",
          body: JSON.stringify({}),
          headers: { "Content-Type": "application/json" },
        }
      );
      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("brief must be at least 5 characters");
    });

    it("should return 400 if brief is too short", async () => {
      const { POST } = await import(
        "../../app/api/domains/suggest-name/route"
      );
      const request = new Request(
        "http://localhost/api/domains/suggest-name",
        {
          method: "POST",
          body: JSON.stringify({ brief: "hi" }),
          headers: { "Content-Type": "application/json" },
        }
      );
      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("brief must be at least 5 characters");
    });

    it("should return 400 for invalid JSON body", async () => {
      const { POST } = await import(
        "../../app/api/domains/suggest-name/route"
      );
      const request = new Request(
        "http://localhost/api/domains/suggest-name",
        {
          method: "POST",
          body: "not json",
          headers: { "Content-Type": "application/json" },
        }
      );
      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Expected JSON body");
    });

    it("should reject unauthenticated requests", async () => {
      const { requireAuth, isAuthError } = await import(
        "@/lib/permissions"
      );
      (isAuthError as any).mockReturnValue(true);
      (requireAuth as any).mockResolvedValue({
        error: new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { "content-type": "application/json" } }
        ),
      });

      const { POST } = await import(
        "../../app/api/domains/suggest-name/route"
      );
      const request = new Request(
        "http://localhost/api/domains/suggest-name",
        {
          method: "POST",
          body: JSON.stringify({ brief: "some course description" }),
          headers: { "Content-Type": "application/json" },
        }
      );
      const response = await POST(request as any);

      expect(response.status).toBe(401);
    });

    it("should strip quotes and trailing period from AI response", async () => {
      const { getConfiguredMeteredAICompletion } = await import(
        "@/lib/metering/instrumented-ai"
      );
      (getConfiguredMeteredAICompletion as any).mockResolvedValue({
        content: '"Creative Writing Workshop."',
      });

      const { POST } = await import(
        "../../app/api/domains/suggest-name/route"
      );
      const request = new Request(
        "http://localhost/api/domains/suggest-name",
        {
          method: "POST",
          body: JSON.stringify({
            brief: "A workshop for creative writing enthusiasts",
          }),
          headers: { "Content-Type": "application/json" },
        }
      );
      const response = await POST(request as any);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.name).toBe("Creative Writing Workshop");
      expect(data.slug).toBe("creative-writing-workshop");
    });
  });
});
