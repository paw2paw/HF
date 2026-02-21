import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────

const mockRequireAuth = vi.fn();
vi.mock("@/lib/permissions", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
  isAuthError: (result: any) => !!result.error,
}));

const mockPrisma = {
  subject: { create: vi.fn() },
  curriculum: { create: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockGenerateCurriculum = vi.fn();
vi.mock("@/lib/content-trust/extract-curriculum", () => ({
  generateCurriculumFromGoals: (...args: any[]) => mockGenerateCurriculum(...args),
}));

const mockAICompletion = vi.fn();
vi.mock("@/lib/metering/instrumented-ai", () => ({
  getConfiguredMeteredAICompletion: (...args: any[]) => mockAICompletion(...args),
}));

const mockStartTaskTracking = vi.fn();
const mockUpdateTaskProgress = vi.fn();
const mockCompleteTask = vi.fn();
const mockFailTask = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/ai/task-guidance", () => ({
  startTaskTracking: (...args: any[]) => mockStartTaskTracking(...args),
  updateTaskProgress: (...args: any[]) => mockUpdateTaskProgress(...args),
  completeTask: (...args: any[]) => mockCompleteTask(...args),
  failTask: (...args: any[]) => mockFailTask(...args),
}));

// ── Helpers ────────────────────────────────────────────

function mockAuth(role = "OPERATOR", userId = "user-1") {
  mockRequireAuth.mockResolvedValue({
    session: { user: { id: userId, role } },
  });
}

function mockAuthFail() {
  mockRequireAuth.mockResolvedValue({
    error: new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    }),
  });
}

function makeRequest(body: any) {
  return new NextRequest("http://localhost/api/courses/generate-plan", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ── Tests ──────────────────────────────────────────────

describe("POST /api/courses/generate-plan", () => {
  let POST: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockStartTaskTracking.mockResolvedValue("task-gen-1");
    mockUpdateTaskProgress.mockResolvedValue(undefined);
    mockCompleteTask.mockResolvedValue(undefined);
    const mod = await import("@/app/api/courses/generate-plan/route");
    POST = mod.POST;
  });

  it("returns 202 with taskId for valid request", async () => {
    mockAuth();
    const body = {
      courseName: "Biology 101",
      learningOutcomes: ["Photosynthesis", "Cell division"],
      teachingStyle: "tutor",
      sessionCount: 10,
      durationMins: 30,
      emphasis: "balanced",
      assessments: "light",
    };

    const res = await POST(makeRequest(body));
    const data = await res.json();

    expect(res.status).toBe(202);
    expect(data.ok).toBe(true);
    expect(data.taskId).toBe("task-gen-1");

    expect(mockStartTaskTracking).toHaveBeenCalledWith(
      "user-1",
      "course_plan_generation",
      expect.objectContaining({ courseName: "Biology 101" }),
    );
  });

  it("returns 400 when courseName is missing", async () => {
    mockAuth();
    const res = await POST(makeRequest({ courseName: "", learningOutcomes: [] }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("courseName");
  });

  it("returns 400 when learningOutcomes is not an array", async () => {
    mockAuth();
    const res = await POST(makeRequest({ courseName: "Test", learningOutcomes: "not-array" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("learningOutcomes");
  });

  it("returns 401 for unauthorized users", async () => {
    mockAuthFail();
    const res = await POST(makeRequest({ courseName: "Test", learningOutcomes: ["LO1"] }));
    expect(res.status).toBe(401);
  });

  it("defaults optional fields", async () => {
    mockAuth();
    const body = {
      courseName: "Minimal Course",
      learningOutcomes: ["Outcome 1"],
    };

    const res = await POST(makeRequest(body));
    const data = await res.json();

    expect(res.status).toBe(202);
    expect(data.ok).toBe(true);

    // Verify defaults in task tracking context
    expect(mockStartTaskTracking).toHaveBeenCalledWith(
      "user-1",
      "course_plan_generation",
      expect.objectContaining({
        emphasis: "balanced",
        assessments: "light",
      }),
    );
  });
});
