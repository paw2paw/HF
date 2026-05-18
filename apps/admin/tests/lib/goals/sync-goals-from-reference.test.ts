import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPrismaState = {
  contentSource: { findUnique: vi.fn() },
  contentAssertion: { findMany: vi.fn() },
  playbookSource: { findMany: vi.fn() },
  subjectSource: { findMany: vi.fn() },
  playbookSubject: { findMany: vi.fn() },
  playbook: { findMany: vi.fn(), update: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({} as Record<string, unknown>, {
    get: (_t, prop: string) => mockPrismaState[prop as keyof typeof mockPrismaState],
  }),
}));

beforeEach(() => {
  for (const model of Object.values(mockPrismaState)) {
    for (const fn of Object.values(model) as ReturnType<typeof vi.fn>[]) fn.mockReset();
  }
});

describe("syncGoalsFromReference — #447 rubric exclusion", () => {
  it("rejects COURSE_REFERENCE_ASSESSOR_RUBRIC sources without writing", async () => {
    mockPrismaState.contentSource.findUnique.mockResolvedValue({
      id: "src-rubric",
      documentType: "COURSE_REFERENCE_ASSESSOR_RUBRIC",
    });

    const { syncGoalsFromReference } = await import("@/lib/goals/sync-goals-from-reference");
    const result = await syncGoalsFromReference("src-rubric");

    expect(result).toEqual({ playbooksUpdated: 0, goalsAdded: 0, goalsSkipped: 0 });
    expect(mockPrismaState.contentAssertion.findMany).not.toHaveBeenCalled();
    expect(mockPrismaState.playbook.update).not.toHaveBeenCalled();
  });

  it("rejects an unknown documentType without writing", async () => {
    mockPrismaState.contentSource.findUnique.mockResolvedValue({
      id: "src-other",
      documentType: "TEXTBOOK",
    });

    const { syncGoalsFromReference } = await import("@/lib/goals/sync-goals-from-reference");
    const result = await syncGoalsFromReference("src-other");

    expect(result.goalsAdded).toBe(0);
    expect(mockPrismaState.contentAssertion.findMany).not.toHaveBeenCalled();
  });

  it.each([
    "COURSE_REFERENCE",
    "COURSE_REFERENCE_CANONICAL",
    "COURSE_REFERENCE_TUTOR_BRIEFING",
  ])("still accepts %s", async (subtype) => {
    mockPrismaState.contentSource.findUnique.mockResolvedValue({
      id: "src-ok",
      documentType: subtype,
    });
    // Empty downstream — exercise the gate, not the body.
    mockPrismaState.contentAssertion.findMany.mockResolvedValue([]);

    const { syncGoalsFromReference } = await import("@/lib/goals/sync-goals-from-reference");
    const result = await syncGoalsFromReference("src-ok");

    expect(result.goalsAdded).toBe(0);
    // Gate passed — assertions were queried even though none were returned.
    expect(mockPrismaState.contentAssertion.findMany).toHaveBeenCalled();
  });
});
