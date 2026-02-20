/**
 * Tests for POST /api/content-sources/:sourceId/lesson-plan
 *
 * Verifies:
 * - Auth enforcement (OPERATOR required)
 * - Calls generateLessonPlan with correct params
 * - Returns generated plan
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  generateLessonPlan: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  requireAuth: (...args: any[]) => mocks.requireAuth(...args),
  isAuthError: (result: any) => "error" in result,
}));

vi.mock("@/lib/content-trust/lesson-planner", () => ({
  generateLessonPlan: mocks.generateLessonPlan,
}));

import { POST } from "@/app/api/content-sources/[sourceId]/lesson-plan/route";
import { NextRequest } from "next/server";

function makeRequest(body: Record<string, any> = {}) {
  return {
    json: () => Promise.resolve(body),
  } as unknown as NextRequest;
}

const makeParams = () => Promise.resolve({ sourceId: "src-1" });

const MOCK_PLAN = {
  totalSessions: 3,
  estimatedMinutesPerSession: 30,
  sessions: [
    {
      sessionNumber: 1,
      title: "Introduction to Food Safety",
      objectives: ["Understand basic food safety"],
      assertionIds: ["a1"],
      questionIds: [],
      vocabularyIds: ["v1"],
      estimatedMinutes: 25,
      sessionType: "introduce",
    },
  ],
  prerequisites: [],
  generatedAt: "2026-02-20T10:00:00.000Z",
};

describe("POST /api/content-sources/:sourceId/lesson-plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({
      session: { user: { id: "u1", role: "OPERATOR" } },
    });
    mocks.generateLessonPlan.mockResolvedValue(MOCK_PLAN);
  });

  it("returns 401 when not authenticated", async () => {
    const { NextResponse } = await import("next/server");
    mocks.requireAuth.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const res = await POST(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(401);
  });

  it("generates lesson plan with default options", async () => {
    const res = await POST(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.plan).toBeDefined();
    expect(data.plan.totalSessions).toBe(3);

    expect(mocks.generateLessonPlan).toHaveBeenCalledWith("src-1", {
      sessionLength: undefined,
      includeAssessment: undefined,
      includeReview: undefined,
    });
  });

  it("passes options to generateLessonPlan", async () => {
    const res = await POST(
      makeRequest({ sessionLength: 45, includeAssessment: false }),
      { params: makeParams() },
    );
    expect(res.status).toBe(200);

    expect(mocks.generateLessonPlan).toHaveBeenCalledWith("src-1", {
      sessionLength: 45,
      includeAssessment: false,
      includeReview: undefined,
    });
  });

  it("propagates errors from generateLessonPlan", async () => {
    mocks.generateLessonPlan.mockRejectedValue(new Error("No content found"));

    await expect(POST(makeRequest(), { params: makeParams() })).rejects.toThrow("No content found");
  });
});
