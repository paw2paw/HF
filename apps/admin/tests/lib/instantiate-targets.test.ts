/**
 * Tests for lib/enrollment/instantiate-targets.ts.
 *
 * Eager creation of CallerTarget placeholders at enrolment time, mirroring
 * instantiate-goals.ts. Verifies the targetValue is preserved from the
 * source BehaviorTarget (NOT hardcoded to 1.0), and that the helper is
 * idempotent via createMany skipDuplicates.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  callerPlaybook: { findMany: vi.fn() },
  behaviorTarget: { findMany: vi.fn() },
  callerTarget: { createMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
  db: (tx?: unknown) => tx ?? mockPrisma,
}));

import { instantiatePlaybookTargets } from "@/lib/enrollment/instantiate-targets";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.callerTarget.createMany.mockResolvedValue({ count: 0 });
});

describe("instantiatePlaybookTargets", () => {
  it("creates one CallerTarget per PLAYBOOK skill BehaviorTarget", async () => {
    mockPrisma.callerPlaybook.findMany.mockResolvedValue([{ playbookId: "pb-1" }]);
    mockPrisma.behaviorTarget.findMany.mockResolvedValue([
      { parameterId: "skill_fluency_and_coherence", targetValue: 1.0 },
      { parameterId: "skill_pronunciation", targetValue: 1.0 },
    ]);
    mockPrisma.callerTarget.createMany.mockResolvedValue({ count: 2 });

    const result = await instantiatePlaybookTargets("caller-1");

    expect(mockPrisma.behaviorTarget.findMany).toHaveBeenCalledWith({
      where: {
        playbookId: { in: ["pb-1"] },
        scope: "PLAYBOOK",
        skillRef: { not: null },
        effectiveUntil: null,
      },
      select: { parameterId: true, targetValue: true },
    });

    expect(mockPrisma.callerTarget.createMany).toHaveBeenCalledWith({
      data: [
        {
          callerId: "caller-1",
          parameterId: "skill_fluency_and_coherence",
          targetValue: 1.0,
          currentScore: null,
          callsUsed: 0,
        },
        {
          callerId: "caller-1",
          parameterId: "skill_pronunciation",
          targetValue: 1.0,
          currentScore: null,
          callsUsed: 0,
        },
      ],
      skipDuplicates: true,
    });

    expect(result).toEqual({ created: 2, skipped: 0 });
  });

  it("preserves non-1.0 targetValue from BehaviorTarget (does not hardcode 1.0)", async () => {
    mockPrisma.callerPlaybook.findMany.mockResolvedValue([{ playbookId: "pb-1" }]);
    mockPrisma.behaviorTarget.findMany.mockResolvedValue([
      { parameterId: "skill_fluency_and_coherence", targetValue: 0.65 },
    ]);
    mockPrisma.callerTarget.createMany.mockResolvedValue({ count: 1 });

    await instantiatePlaybookTargets("caller-1");

    const data = mockPrisma.callerTarget.createMany.mock.calls[0][0].data;
    expect(data[0].targetValue).toBe(0.65);
  });

  it("returns {created:0, skipped:0} when the caller has no ACTIVE enrolments", async () => {
    mockPrisma.callerPlaybook.findMany.mockResolvedValue([]);

    const result = await instantiatePlaybookTargets("caller-1");

    expect(result).toEqual({ created: 0, skipped: 0 });
    expect(mockPrisma.behaviorTarget.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.callerTarget.createMany).not.toHaveBeenCalled();
  });

  it("returns {created:0, skipped:0} when no skill targets exist on enrolled playbooks", async () => {
    mockPrisma.callerPlaybook.findMany.mockResolvedValue([{ playbookId: "pb-1" }]);
    mockPrisma.behaviorTarget.findMany.mockResolvedValue([]);

    const result = await instantiatePlaybookTargets("caller-1");

    expect(result).toEqual({ created: 0, skipped: 0 });
    expect(mockPrisma.callerTarget.createMany).not.toHaveBeenCalled();
  });

  it("dedupes by parameterId across multiple enrolments sharing a skill", async () => {
    mockPrisma.callerPlaybook.findMany.mockResolvedValue([
      { playbookId: "pb-1" },
      { playbookId: "pb-2" },
    ]);
    mockPrisma.behaviorTarget.findMany.mockResolvedValue([
      { parameterId: "skill_fluency_and_coherence", targetValue: 1.0 },
      // Same parameter on a second playbook with a different targetValue:
      { parameterId: "skill_fluency_and_coherence", targetValue: 0.8 },
      { parameterId: "skill_pronunciation", targetValue: 1.0 },
    ]);
    mockPrisma.callerTarget.createMany.mockResolvedValue({ count: 2 });

    await instantiatePlaybookTargets("caller-1");

    const data = mockPrisma.callerTarget.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(2);
    expect(data.map((d: { parameterId: string }) => d.parameterId)).toEqual([
      "skill_fluency_and_coherence",
      "skill_pronunciation",
    ]);
    // First seen wins — keeps behaviour deterministic without prescribing
    // a "preferred" playbook here.
    expect(data[0].targetValue).toBe(1.0);
  });

  it("is idempotent — re-runs report skipped rows when createMany returns count<rows.length", async () => {
    mockPrisma.callerPlaybook.findMany.mockResolvedValue([{ playbookId: "pb-1" }]);
    mockPrisma.behaviorTarget.findMany.mockResolvedValue([
      { parameterId: "skill_fluency_and_coherence", targetValue: 1.0 },
    ]);
    // Row already exists from a prior run.
    mockPrisma.callerTarget.createMany.mockResolvedValue({ count: 0 });

    const result = await instantiatePlaybookTargets("caller-1");

    expect(mockPrisma.callerTarget.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    expect(result).toEqual({ created: 0, skipped: 1 });
  });

  it("queries only PLAYBOOK-scope, skillRef-bearing, currently-active targets", async () => {
    mockPrisma.callerPlaybook.findMany.mockResolvedValue([{ playbookId: "pb-1" }]);
    mockPrisma.behaviorTarget.findMany.mockResolvedValue([]);

    await instantiatePlaybookTargets("caller-1");

    const where = mockPrisma.behaviorTarget.findMany.mock.calls[0][0].where;
    expect(where.scope).toBe("PLAYBOOK");
    expect(where.skillRef).toEqual({ not: null });
    expect(where.effectiveUntil).toBe(null);
  });

  it("ignores non-ACTIVE enrolments at the callerPlaybook query", async () => {
    mockPrisma.callerPlaybook.findMany.mockResolvedValue([{ playbookId: "pb-1" }]);
    mockPrisma.behaviorTarget.findMany.mockResolvedValue([]);

    await instantiatePlaybookTargets("caller-1");

    const where = mockPrisma.callerPlaybook.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("ACTIVE");
  });
});
