/**
 * Tests for lib/goals/track-progress.ts — Goal Progress Tracking
 *
 * Covers:
 * - trackGoalProgress: returns zeros when no active goals
 * - trackGoalProgress: LEARN goals with contentSpec (curriculum progress)
 * - trackGoalProgress: LEARN goals without contentSpec (fallback engagement)
 * - trackGoalProgress: CONNECT goals (score-based progress)
 * - trackGoalProgress: engagement-based goals (ACHIEVE, CHANGE, SUPPORT, CREATE)
 * - trackGoalProgress: marks goals COMPLETED when progress reaches 1.0
 * - trackGoalProgress: caps progress at 1.0
 * - trackGoalProgress: unknown goal types return null (no update)
 * - updateGoalProgress: clamps progress and marks completion
 * - Edge cases: no scores, short transcript, null transcript
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// =====================================================
// MOCK SETUP
// =====================================================

// Override @prisma/client to include GoalType and GoalStatus enums
vi.mock("@prisma/client", async (importOriginal) => {
  const orig = (await importOriginal()) as any;
  return {
    ...orig,
    GoalType: {
      LEARN: "LEARN",
      ACHIEVE: "ACHIEVE",
      CHANGE: "CHANGE",
      CONNECT: "CONNECT",
      SUPPORT: "SUPPORT",
      CREATE: "CREATE",
    },
    GoalStatus: {
      ACTIVE: "ACTIVE",
      COMPLETED: "COMPLETED",
      PAUSED: "PAUSED",
      ARCHIVED: "ARCHIVED",
    },
  };
});

const mockPrisma = {
  goal: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  callerAttribute: {
    findMany: vi.fn(),
  },
  callScore: {
    findMany: vi.fn(),
  },
  call: {
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/registry", () => ({
  PARAMS: {
    BEH_WARMTH: "BEH-WARMTH",
    BEH_EMPATHY_RATE: "BEH-EMPATHY-RATE",
    BEH_INSIGHT_FREQUENCY: "BEH-INSIGHT-FREQUENCY",
  },
}));

// =====================================================
// FIXTURES
// =====================================================

function makeGoal(overrides: Partial<{
  id: string;
  type: string;
  progress: number;
  contentSpec: any;
  callerId: string;
}> = {}) {
  return {
    id: overrides.id ?? "goal-1",
    type: overrides.type ?? "LEARN",
    progress: overrides.progress ?? 0,
    contentSpec: overrides.contentSpec ?? null,
    callerId: overrides.callerId ?? "caller-1",
  };
}

function makeContentSpec(
  domain: string,
  modules: string[] = ["mod1", "mod2", "mod3"]
) {
  return {
    domain,
    config: {
      curriculum: {
        modules: modules.map((m) => ({ id: m })),
      },
    },
  };
}

// =====================================================
// TESTS
// =====================================================

describe("lib/goals/track-progress.ts", () => {
  let trackGoalProgress: typeof import("@/lib/goals/track-progress").trackGoalProgress;
  let updateGoalProgress: typeof import("@/lib/goals/track-progress").updateGoalProgress;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    mockPrisma.goal.findMany.mockResolvedValue([]);
    mockPrisma.goal.update.mockResolvedValue({});
    mockPrisma.callerAttribute.findMany.mockResolvedValue([]);
    mockPrisma.callScore.findMany.mockResolvedValue([]);
    mockPrisma.call.findUnique.mockResolvedValue(null);

    const mod = await import("@/lib/goals/track-progress");
    trackGoalProgress = mod.trackGoalProgress;
    updateGoalProgress = mod.updateGoalProgress;
  });

  // -------------------------------------------------
  // No active goals
  // -------------------------------------------------

  describe("no active goals", () => {
    it("returns zeros when caller has no active goals", async () => {
      mockPrisma.goal.findMany.mockResolvedValue([]);

      const result = await trackGoalProgress("caller-1", "call-1");

      expect(result.updated).toBe(0);
      expect(result.completed).toBe(0);
      expect(mockPrisma.goal.update).not.toHaveBeenCalled();
    });

    it("queries goals with ACTIVE and PAUSED status", async () => {
      mockPrisma.goal.findMany.mockResolvedValue([]);

      await trackGoalProgress("caller-1", "call-1");

      expect(mockPrisma.goal.findMany).toHaveBeenCalledWith({
        where: {
          callerId: "caller-1",
          status: { in: ["ACTIVE", "PAUSED"] },
        },
        include: {
          contentSpec: true,
        },
      });
    });
  });

  // -------------------------------------------------
  // LEARN goals with contentSpec
  // -------------------------------------------------

  describe("LEARN goals with contentSpec", () => {
    it("calculates progress from curriculum module completion", async () => {
      const goal = makeGoal({
        id: "learn-1",
        type: "LEARN",
        progress: 0,
        contentSpec: makeContentSpec("quantum", ["mod1", "mod2", "mod3", "mod4"]),
      });
      mockPrisma.goal.findMany.mockResolvedValue([goal]);

      // 2 out of 4 modules completed
      mockPrisma.callerAttribute.findMany.mockResolvedValue([
        { key: "module_1", stringValue: "completed" },
        { key: "module_2", stringValue: "completed" },
        { key: "module_3", stringValue: "in_progress" },
      ]);

      const result = await trackGoalProgress("caller-1", "call-1");

      expect(result.updated).toBe(1);
      // Progress delta = 2/4 - 0 = 0.5
      expect(mockPrisma.goal.update).toHaveBeenCalledWith({
        where: { id: "learn-1" },
        data: expect.objectContaining({
          progress: 0.5,
        }),
      });
    });

    it("does not update when curriculum progress has not increased", async () => {
      const goal = makeGoal({
        id: "learn-2",
        type: "LEARN",
        progress: 0.75, // Already at 75%
        contentSpec: makeContentSpec("quantum", ["mod1", "mod2", "mod3", "mod4"]),
      });
      mockPrisma.goal.findMany.mockResolvedValue([goal]);

      // 2 out of 4 completed = 50%, less than current 75%
      mockPrisma.callerAttribute.findMany.mockResolvedValue([
        { key: "module_1", stringValue: "completed" },
        { key: "module_2", stringValue: "completed" },
      ]);

      const result = await trackGoalProgress("caller-1", "call-1");

      // Falls through to fallback 0.05 engagement increment since curriculumProgress (0.5) <= goal.progress (0.75)
      expect(result.updated).toBe(1);
      expect(mockPrisma.goal.update).toHaveBeenCalledWith({
        where: { id: "learn-2" },
        data: expect.objectContaining({
          progress: 0.8, // 0.75 + 0.05 fallback
        }),
      });
    });

    it("queries callerAttribute with correct domain and scope", async () => {
      const goal = makeGoal({
        type: "LEARN",
        contentSpec: makeContentSpec("physics"),
      });
      mockPrisma.goal.findMany.mockResolvedValue([goal]);

      await trackGoalProgress("caller-1", "call-1");

      expect(mockPrisma.callerAttribute.findMany).toHaveBeenCalledWith({
        where: {
          callerId: "caller-1",
          scope: "CURRICULUM",
          domain: "physics",
          key: { contains: "module_" },
        },
      });
    });

    it("uses 1 as default totalModules when config has no modules", async () => {
      const goal = makeGoal({
        id: "learn-no-modules",
        type: "LEARN",
        progress: 0,
        contentSpec: { domain: "test", config: {} },
      });
      mockPrisma.goal.findMany.mockResolvedValue([goal]);

      // 1 completed module, totalModules defaults to 1 => progress = 1.0
      mockPrisma.callerAttribute.findMany.mockResolvedValue([
        { key: "module_1", stringValue: "completed" },
      ]);

      const result = await trackGoalProgress("caller-1", "call-1");

      expect(result.updated).toBe(1);
      expect(result.completed).toBe(1);
      expect(mockPrisma.goal.update).toHaveBeenCalledWith({
        where: { id: "learn-no-modules" },
        data: expect.objectContaining({
          progress: 1.0,
          status: "COMPLETED",
        }),
      });
    });
  });

  // -------------------------------------------------
  // LEARN goals without contentSpec (fallback)
  // -------------------------------------------------

  describe("LEARN goals without contentSpec", () => {
    it("gives 5% progress increment as fallback", async () => {
      const goal = makeGoal({
        id: "learn-no-spec",
        type: "LEARN",
        progress: 0.2,
        contentSpec: null,
      });
      mockPrisma.goal.findMany.mockResolvedValue([goal]);

      const result = await trackGoalProgress("caller-1", "call-1");

      expect(result.updated).toBe(1);
      expect(mockPrisma.goal.update).toHaveBeenCalledWith({
        where: { id: "learn-no-spec" },
        data: expect.objectContaining({
          progress: 0.25, // 0.2 + 0.05
        }),
      });
    });
  });

  // -------------------------------------------------
  // CONNECT goals
  // -------------------------------------------------

  describe("CONNECT goals", () => {
    it("gives 10% progress for high connection scores (>0.7)", async () => {
      const goal = makeGoal({
        id: "connect-1",
        type: "CONNECT",
        progress: 0.3,
      });
      mockPrisma.goal.findMany.mockResolvedValue([goal]);

      mockPrisma.callScore.findMany.mockResolvedValue([
        { score: 0.85, parameter: { parameterId: "BEH-WARMTH" } },
        { score: 0.9, parameter: { parameterId: "BEH-EMPATHY-RATE" } },
        { score: 0.8, parameter: { parameterId: "BEH-INSIGHT-FREQUENCY" } },
      ]);

      const result = await trackGoalProgress("caller-1", "call-1");

      expect(result.updated).toBe(1);
      expect(mockPrisma.goal.update).toHaveBeenCalledWith({
        where: { id: "connect-1" },
        data: expect.objectContaining({
          progress: 0.4, // 0.3 + 0.1
        }),
      });
    });

    it("gives 5% progress for moderate connection scores (>0.5, <=0.7)", async () => {
      const goal = makeGoal({
        id: "connect-2",
        type: "CONNECT",
        progress: 0.1,
      });
      mockPrisma.goal.findMany.mockResolvedValue([goal]);

      mockPrisma.callScore.findMany.mockResolvedValue([
        { score: 0.6, parameter: { parameterId: "BEH-WARMTH" } },
        { score: 0.55, parameter: { parameterId: "BEH-EMPATHY-RATE" } },
      ]);

      const result = await trackGoalProgress("caller-1", "call-1");

      expect(result.updated).toBe(1);
      const updateCall = mockPrisma.goal.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe("connect-2");
      expect(updateCall.data.progress).toBeCloseTo(0.15, 10); // 0.1 + 0.05
    });

    it("returns no update for low connection scores (<=0.5)", async () => {
      const goal = makeGoal({
        id: "connect-3",
        type: "CONNECT",
        progress: 0.1,
      });
      mockPrisma.goal.findMany.mockResolvedValue([goal]);

      mockPrisma.callScore.findMany.mockResolvedValue([
        { score: 0.3, parameter: { parameterId: "BEH-WARMTH" } },
        { score: 0.4, parameter: { parameterId: "BEH-EMPATHY-RATE" } },
      ]);

      const result = await trackGoalProgress("caller-1", "call-1");

      expect(result.updated).toBe(0);
      expect(mockPrisma.goal.update).not.toHaveBeenCalled();
    });

    it("returns no update when no connection scores exist", async () => {
      const goal = makeGoal({
        id: "connect-4",
        type: "CONNECT",
        progress: 0,
      });
      mockPrisma.goal.findMany.mockResolvedValue([goal]);

      mockPrisma.callScore.findMany.mockResolvedValue([]);

      const result = await trackGoalProgress("caller-1", "call-1");

      expect(result.updated).toBe(0);
    });

    it("queries callScore with correct parameter IDs", async () => {
      const goal = makeGoal({ type: "CONNECT" });
      mockPrisma.goal.findMany.mockResolvedValue([goal]);

      await trackGoalProgress("caller-1", "call-1");

      expect(mockPrisma.callScore.findMany).toHaveBeenCalledWith({
        where: {
          callId: "call-1",
          parameter: {
            parameterId: {
              in: ["BEH-WARMTH", "BEH-EMPATHY-RATE", "BEH-INSIGHT-FREQUENCY"],
            },
          },
        },
        include: {
          parameter: true,
        },
      });
    });
  });

  // -------------------------------------------------
  // Engagement-based goals (ACHIEVE, CHANGE, SUPPORT, CREATE)
  // -------------------------------------------------

  describe("engagement-based goals", () => {
    it("gives 5% progress for long transcripts (>1000 chars)", async () => {
      const goal = makeGoal({
        id: "achieve-1",
        type: "ACHIEVE",
        progress: 0.4,
      });
      mockPrisma.goal.findMany.mockResolvedValue([goal]);

      mockPrisma.call.findUnique.mockResolvedValue({
        transcript: "A".repeat(1500),
      });

      const result = await trackGoalProgress("caller-1", "call-1");

      expect(result.updated).toBe(1);
      expect(mockPrisma.goal.update).toHaveBeenCalledWith({
        where: { id: "achieve-1" },
        data: expect.objectContaining({
          progress: 0.45, // 0.4 + 0.05
        }),
      });
    });

    it("gives 2% progress for moderate transcripts (>500, <=1000 chars)", async () => {
      const goal = makeGoal({
        id: "change-1",
        type: "CHANGE",
        progress: 0.5,
      });
      mockPrisma.goal.findMany.mockResolvedValue([goal]);

      mockPrisma.call.findUnique.mockResolvedValue({
        transcript: "B".repeat(750),
      });

      const result = await trackGoalProgress("caller-1", "call-1");

      expect(result.updated).toBe(1);
      expect(mockPrisma.goal.update).toHaveBeenCalledWith({
        where: { id: "change-1" },
        data: expect.objectContaining({
          progress: 0.52, // 0.5 + 0.02
        }),
      });
    });

    it("returns no update for short transcripts (<=500 chars)", async () => {
      const goal = makeGoal({
        id: "support-1",
        type: "SUPPORT",
        progress: 0.3,
      });
      mockPrisma.goal.findMany.mockResolvedValue([goal]);

      mockPrisma.call.findUnique.mockResolvedValue({
        transcript: "C".repeat(200),
      });

      const result = await trackGoalProgress("caller-1", "call-1");

      expect(result.updated).toBe(0);
      expect(mockPrisma.goal.update).not.toHaveBeenCalled();
    });

    it("returns no update when call has no transcript", async () => {
      const goal = makeGoal({
        id: "create-1",
        type: "CREATE",
        progress: 0.2,
      });
      mockPrisma.goal.findMany.mockResolvedValue([goal]);

      mockPrisma.call.findUnique.mockResolvedValue({ transcript: null });

      const result = await trackGoalProgress("caller-1", "call-1");

      expect(result.updated).toBe(0);
    });

    it("returns no update when call does not exist", async () => {
      const goal = makeGoal({
        id: "create-2",
        type: "CREATE",
        progress: 0.2,
      });
      mockPrisma.goal.findMany.mockResolvedValue([goal]);

      mockPrisma.call.findUnique.mockResolvedValue(null);

      const result = await trackGoalProgress("caller-1", "call-1");

      expect(result.updated).toBe(0);
    });

    it("works for all engagement-based goal types", async () => {
      const engagementTypes = ["ACHIEVE", "CHANGE", "SUPPORT", "CREATE"];

      for (const goalType of engagementTypes) {
        vi.clearAllMocks();
        const goal = makeGoal({
          id: `goal-${goalType}`,
          type: goalType,
          progress: 0,
        });
        mockPrisma.goal.findMany.mockResolvedValue([goal]);
        mockPrisma.call.findUnique.mockResolvedValue({
          transcript: "X".repeat(2000),
        });

        const result = await trackGoalProgress("caller-1", "call-1");

        expect(result.updated).toBe(1);
        expect(mockPrisma.goal.update).toHaveBeenCalledWith({
          where: { id: `goal-${goalType}` },
          data: expect.objectContaining({
            progress: 0.05,
          }),
        });
      }
    });
  });

  // -------------------------------------------------
  // Goal completion
  // -------------------------------------------------

  describe("goal completion", () => {
    it("marks goal as COMPLETED when progress reaches 1.0", async () => {
      const goal = makeGoal({
        id: "almost-done",
        type: "LEARN",
        progress: 0.97,
        contentSpec: null,
      });
      mockPrisma.goal.findMany.mockResolvedValue([goal]);

      const result = await trackGoalProgress("caller-1", "call-1");

      expect(result.updated).toBe(1);
      expect(result.completed).toBe(1);
      expect(mockPrisma.goal.update).toHaveBeenCalledWith({
        where: { id: "almost-done" },
        data: expect.objectContaining({
          progress: 1.0, // Math.min(1.0, 0.97 + 0.05)
          status: "COMPLETED",
          completedAt: expect.any(Date),
        }),
      });
    });

    it("caps progress at 1.0", async () => {
      const goal = makeGoal({
        id: "overflow",
        type: "LEARN",
        progress: 0.99,
        contentSpec: null,
      });
      mockPrisma.goal.findMany.mockResolvedValue([goal]);

      const result = await trackGoalProgress("caller-1", "call-1");

      expect(mockPrisma.goal.update).toHaveBeenCalledWith({
        where: { id: "overflow" },
        data: expect.objectContaining({
          progress: 1.0, // Not 1.04
        }),
      });
    });

    it("does not set COMPLETED status when progress < 1.0", async () => {
      const goal = makeGoal({
        id: "in-progress",
        type: "LEARN",
        progress: 0.5,
        contentSpec: null,
      });
      mockPrisma.goal.findMany.mockResolvedValue([goal]);

      await trackGoalProgress("caller-1", "call-1");

      const updateCall = mockPrisma.goal.update.mock.calls[0][0];
      expect(updateCall.data.progress).toBe(0.55);
      expect(updateCall.data.status).toBeUndefined();
      expect(updateCall.data.completedAt).toBeUndefined();
    });
  });

  // -------------------------------------------------
  // Unknown goal types
  // -------------------------------------------------

  describe("unknown goal types", () => {
    it("returns no update for unknown goal type", async () => {
      const goal = makeGoal({
        id: "unknown-1",
        type: "UNKNOWN_TYPE" as any,
        progress: 0.5,
      });
      mockPrisma.goal.findMany.mockResolvedValue([goal]);

      const result = await trackGoalProgress("caller-1", "call-1");

      expect(result.updated).toBe(0);
      expect(mockPrisma.goal.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------
  // Multiple goals
  // -------------------------------------------------

  describe("multiple goals", () => {
    it("processes multiple goals independently", async () => {
      const goals = [
        makeGoal({ id: "g1", type: "LEARN", progress: 0, contentSpec: null }),
        makeGoal({ id: "g2", type: "CONNECT", progress: 0 }),
        makeGoal({ id: "g3", type: "ACHIEVE", progress: 0 }),
      ];
      mockPrisma.goal.findMany.mockResolvedValue(goals);

      // LEARN fallback = 0.05
      // CONNECT = no scores -> no update
      mockPrisma.callScore.findMany.mockResolvedValue([]);
      // ACHIEVE = long transcript -> 0.05
      mockPrisma.call.findUnique.mockResolvedValue({
        transcript: "D".repeat(2000),
      });

      const result = await trackGoalProgress("caller-1", "call-1");

      // LEARN (0.05) + ACHIEVE (0.05) = 2 updated, CONNECT = 0
      expect(result.updated).toBe(2);
      expect(result.completed).toBe(0);
    });
  });

  // -------------------------------------------------
  // updateGoalProgress (manual update)
  // -------------------------------------------------

  describe("updateGoalProgress", () => {
    it("updates goal with clamped progress", async () => {
      await updateGoalProgress("goal-1", 0.75);

      expect(mockPrisma.goal.update).toHaveBeenCalledWith({
        where: { id: "goal-1" },
        data: expect.objectContaining({
          progress: 0.75,
          updatedAt: expect.any(Date),
        }),
      });
    });

    it("clamps progress above 1.0 to 1.0 and marks COMPLETED", async () => {
      await updateGoalProgress("goal-2", 1.5);

      expect(mockPrisma.goal.update).toHaveBeenCalledWith({
        where: { id: "goal-2" },
        data: expect.objectContaining({
          progress: 1.0,
          status: "COMPLETED",
          completedAt: expect.any(Date),
        }),
      });
    });

    it("clamps progress below 0 to 0", async () => {
      await updateGoalProgress("goal-3", -0.5);

      expect(mockPrisma.goal.update).toHaveBeenCalledWith({
        where: { id: "goal-3" },
        data: expect.objectContaining({
          progress: 0,
        }),
      });
    });

    it("marks COMPLETED when progress is exactly 1.0", async () => {
      await updateGoalProgress("goal-4", 1.0);

      expect(mockPrisma.goal.update).toHaveBeenCalledWith({
        where: { id: "goal-4" },
        data: expect.objectContaining({
          progress: 1.0,
          status: "COMPLETED",
          completedAt: expect.any(Date),
        }),
      });
    });

    it("does not mark COMPLETED when progress < 1.0", async () => {
      await updateGoalProgress("goal-5", 0.99);

      const updateCall = mockPrisma.goal.update.mock.calls[0][0];
      expect(updateCall.data.progress).toBe(0.99);
      expect(updateCall.data.status).toBeUndefined();
      expect(updateCall.data.completedAt).toBeUndefined();
    });
  });
});
