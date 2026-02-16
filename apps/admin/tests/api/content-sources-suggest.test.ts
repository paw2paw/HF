/**
 * Tests for /api/content-sources/suggest
 *
 * POST: AI-fills content source metadata from a free-text description
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// =====================================================
// MOCKS
// =====================================================

const validResponse = JSON.stringify({
  slug: "cii-r04-syllabus-2025",
  name: "CII R04 Insurance Syllabus 2025/26",
  description: "Official syllabus for the CII R04 Insurance exam",
  trustLevel: "REGULATORY_STANDARD",
  documentType: "CURRICULUM",
  publisherOrg: "Chartered Insurance Institute",
  accreditingBody: "CII",
  qualificationRef: "CII R04",
  publicationYear: 2025,
  validFrom: "2025-09-01",
  validUntil: "2026-08-31",
  authors: ["CII Examinations Board"],
  interpretation: "Identified as a regulatory exam syllabus from the CII",
});

const mockAI = vi.fn();
vi.mock("@/lib/metering/instrumented-ai", () => ({
  getConfiguredMeteredAICompletion: mockAI,
}));

const mockRequireAuth = vi.fn();
const mockIsAuthError = vi.fn();
vi.mock("@/lib/permissions", () => ({
  requireAuth: mockRequireAuth,
  isAuthError: mockIsAuthError,
}));

// =====================================================
// HELPERS
// =====================================================

function makeRequest(body: any) {
  return new Request("http://localhost/api/content-sources/suggest", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// =====================================================
// TESTS
// =====================================================

describe("/api/content-sources/suggest", () => {
  let POST: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockIsAuthError.mockReturnValue(false);
    mockRequireAuth.mockResolvedValue({
      session: {
        user: { id: "u-1", email: "a@b.com", name: "Admin", role: "OPERATOR", image: null },
        expires: new Date(Date.now() + 86400000).toISOString(),
      },
    });

    mockAI.mockResolvedValue({ content: validResponse });

    const mod = await import("../../app/api/content-sources/suggest/route");
    POST = mod.POST;
  });

  it("should return suggested fields from AI", async () => {
    const response = await POST(
      makeRequest({ description: "CII R04 Insurance Syllabus 2025/26" })
    );
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.fields.slug).toBe("cii-r04-syllabus-2025");
    expect(data.fields.name).toBe("CII R04 Insurance Syllabus 2025/26");
    expect(data.fields.trustLevel).toBe("REGULATORY_STANDARD");
    expect(data.fields.publisherOrg).toBe("Chartered Insurance Institute");
    expect(data.fields.qualificationRef).toBe("CII R04");
    expect(data.fields.publicationYear).toBe(2025);
    expect(data.fields.validFrom).toBe("2025-09-01");
    expect(data.fields.authors).toEqual(["CII Examinations Board"]);
    expect(data.interpretation).toBeTruthy();
  });

  it("should sanitize slug to kebab-case", async () => {
    mockAI.mockResolvedValue({
      content: JSON.stringify({
        slug: "My Book Title!! 2025",
        name: "My Book",
        interpretation: "test",
      }),
    });

    const response = await POST(makeRequest({ description: "my book" }));
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.fields.slug).toBe("my-book-title-2025");
  });

  it("should reject invalid trust levels from AI", async () => {
    mockAI.mockResolvedValue({
      content: JSON.stringify({
        slug: "test",
        name: "Test",
        trustLevel: "INVALID_LEVEL",
        interpretation: "test",
      }),
    });

    const response = await POST(makeRequest({ description: "test source" }));
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.fields.trustLevel).toBeUndefined(); // Invalid level stripped
    expect(data.fields.slug).toBe("test");
  });

  it("should reject invalid document types from AI", async () => {
    mockAI.mockResolvedValue({
      content: JSON.stringify({
        slug: "test",
        name: "Test",
        documentType: "NEWSPAPER",
        interpretation: "test",
      }),
    });

    const response = await POST(makeRequest({ description: "test source" }));
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.fields.documentType).toBeUndefined(); // Invalid type stripped
  });

  it("should reject out-of-range publication years", async () => {
    mockAI.mockResolvedValue({
      content: JSON.stringify({
        slug: "test",
        name: "Test",
        publicationYear: 1800,
        interpretation: "test",
      }),
    });

    const response = await POST(makeRequest({ description: "old book" }));
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.fields.publicationYear).toBeUndefined(); // Out of range
  });

  it("should return 400 for empty description", async () => {
    const response = await POST(makeRequest({ description: "" }));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("description must be at least 3 characters");
  });

  it("should return 400 for too-short description", async () => {
    const response = await POST(makeRequest({ description: "hi" }));
    expect(response.status).toBe(400);
  });

  it("should return 502 when AI returns unparseable response", async () => {
    mockAI.mockResolvedValue({ content: "not json" });

    const response = await POST(
      makeRequest({ description: "some source" })
    );
    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data.error).toContain("Failed to parse AI response");
  });

  it("should reject unauthenticated requests", async () => {
    mockIsAuthError.mockReturnValue(true);
    mockRequireAuth.mockResolvedValue({
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    });

    const response = await POST(
      makeRequest({ description: "some source" })
    );
    expect(response.status).toBe(401);
  });

  it("should call AI with correct call point", async () => {
    await POST(makeRequest({ description: "CII R04 syllabus" }));

    expect(mockAI).toHaveBeenCalledWith(
      expect.objectContaining({ callPoint: "content-sources.suggest" }),
      expect.objectContaining({ sourceOp: "content-sources:suggest" })
    );
  });

  it("should handle AI response with only required fields", async () => {
    mockAI.mockResolvedValue({
      content: JSON.stringify({
        slug: "minimal",
        name: "Minimal Source",
        interpretation: "Minimal info",
      }),
    });

    const response = await POST(makeRequest({ description: "minimal source" }));
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.fields.slug).toBe("minimal");
    expect(data.fields.name).toBe("Minimal Source");
    expect(data.fields.trustLevel).toBeUndefined();
    expect(data.fields.publisherOrg).toBeUndefined();
  });
});
