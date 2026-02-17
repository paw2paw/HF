/**
 * Tests for cohort-level enrollment functions in lib/enrollment/index.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  callerPlaybook: {
    upsert: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  cohortPlaybook: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
  playbook: {
    findMany: vi.fn(),
  },
  caller: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import {
  getCohortPlaybookIds,
  enrollCallerInCohortPlaybooks,
  assignPlaybookToCohort,
  removePlaybookFromCohort,
  enrollCohortMembersInPlaybook,
} from "@/lib/enrollment";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCohortPlaybookIds", () => {
  it("returns playbook IDs assigned to a cohort", async () => {
    mockPrisma.cohortPlaybook.findMany.mockResolvedValue([
      { playbookId: "pb-1" },
      { playbookId: "pb-2" },
    ]);

    const ids = await getCohortPlaybookIds("cohort-1");
    expect(ids).toEqual(["pb-1", "pb-2"]);
    expect(mockPrisma.cohortPlaybook.findMany).toHaveBeenCalledWith({
      where: { cohortGroupId: "cohort-1" },
      select: { playbookId: true },
    });
  });

  it("returns empty array when no playbooks assigned", async () => {
    mockPrisma.cohortPlaybook.findMany.mockResolvedValue([]);
    const ids = await getCohortPlaybookIds("cohort-1");
    expect(ids).toEqual([]);
  });
});

describe("enrollCallerInCohortPlaybooks", () => {
  it("enrolls in cohort playbooks when cohort has assignments", async () => {
    mockPrisma.cohortPlaybook.findMany.mockResolvedValue([
      { playbookId: "pb-1" },
      { playbookId: "pb-2" },
    ]);
    mockPrisma.callerPlaybook.upsert
      .mockResolvedValueOnce({ id: "enr-1", callerId: "c-1", playbookId: "pb-1", status: "ACTIVE" })
      .mockResolvedValueOnce({ id: "enr-2", callerId: "c-1", playbookId: "pb-2", status: "ACTIVE" });

    const results = await enrollCallerInCohortPlaybooks("c-1", "cohort-1", "domain-1", "join");

    expect(results).toHaveLength(2);
    expect(mockPrisma.callerPlaybook.upsert).toHaveBeenCalledTimes(2);
    // Should NOT have queried domain playbooks
    expect(mockPrisma.playbook.findMany).not.toHaveBeenCalled();
  });

  it("falls back to domain-wide enrollment when cohort has no assignments", async () => {
    mockPrisma.cohortPlaybook.findMany.mockResolvedValue([]);
    mockPrisma.playbook.findMany.mockResolvedValue([
      { id: "domain-pb-1" },
      { id: "domain-pb-2" },
    ]);
    mockPrisma.callerPlaybook.upsert
      .mockResolvedValueOnce({ id: "enr-1" })
      .mockResolvedValueOnce({ id: "enr-2" });

    const results = await enrollCallerInCohortPlaybooks("c-1", "cohort-1", "domain-1", "join");

    expect(results).toHaveLength(2);
    // Should have queried domain playbooks as fallback
    expect(mockPrisma.playbook.findMany).toHaveBeenCalledWith({
      where: { domainId: "domain-1", status: "PUBLISHED" },
      select: { id: true },
    });
  });
});

describe("assignPlaybookToCohort", () => {
  it("creates cohort-playbook assignment", async () => {
    mockPrisma.cohortPlaybook.upsert.mockResolvedValue({
      id: "cp-1",
      cohortGroupId: "cohort-1",
      playbookId: "pb-1",
      assignedBy: "manual",
    });

    const result = await assignPlaybookToCohort("cohort-1", "pb-1", "manual", false);

    expect(result.assignment.cohortGroupId).toBe("cohort-1");
    expect(result.enrolled).toBe(0);
    expect(mockPrisma.caller.findMany).not.toHaveBeenCalled();
  });

  it("auto-enrolls existing members when requested", async () => {
    mockPrisma.cohortPlaybook.upsert.mockResolvedValue({
      id: "cp-1",
      cohortGroupId: "cohort-1",
      playbookId: "pb-1",
    });
    mockPrisma.caller.findMany.mockResolvedValue([
      { id: "c-1" },
      { id: "c-2" },
    ]);
    mockPrisma.callerPlaybook.upsert
      .mockResolvedValueOnce({ id: "enr-1" })
      .mockResolvedValueOnce({ id: "enr-2" });

    const result = await assignPlaybookToCohort("cohort-1", "pb-1", "manual", true);

    expect(result.enrolled).toBe(2);
    expect(mockPrisma.callerPlaybook.upsert).toHaveBeenCalledTimes(2);
  });
});

describe("removePlaybookFromCohort", () => {
  it("removes assignment without dropping member enrollments", async () => {
    mockPrisma.cohortPlaybook.delete.mockResolvedValue({});

    const result = await removePlaybookFromCohort("cohort-1", "pb-1", false);

    expect(result.removed).toBe(true);
    expect(result.dropped).toBe(0);
    expect(mockPrisma.caller.findMany).not.toHaveBeenCalled();
  });

  it("drops member enrollments when requested", async () => {
    mockPrisma.cohortPlaybook.delete.mockResolvedValue({});
    mockPrisma.caller.findMany.mockResolvedValue([{ id: "c-1" }, { id: "c-2" }]);
    mockPrisma.callerPlaybook.updateMany.mockResolvedValue({ count: 2 });

    const result = await removePlaybookFromCohort("cohort-1", "pb-1", true);

    expect(result.removed).toBe(true);
    expect(result.dropped).toBe(2);
    expect(mockPrisma.callerPlaybook.updateMany).toHaveBeenCalledWith({
      where: {
        playbookId: "pb-1",
        callerId: { in: ["c-1", "c-2"] },
        status: "ACTIVE",
      },
      data: { status: "DROPPED", droppedAt: expect.any(Date) },
    });
  });
});

describe("enrollCohortMembersInPlaybook", () => {
  it("enrolls all cohort members in a playbook", async () => {
    mockPrisma.caller.findMany.mockResolvedValue([
      { id: "c-1" },
      { id: "c-2" },
      { id: "c-3" },
    ]);
    mockPrisma.callerPlaybook.upsert.mockResolvedValue({ id: "enr" });

    const result = await enrollCohortMembersInPlaybook("cohort-1", "pb-1", "sync");

    expect(result.enrolled).toBe(3);
    expect(result.errors).toHaveLength(0);
    expect(mockPrisma.callerPlaybook.upsert).toHaveBeenCalledTimes(3);
  });

  it("collects errors for individual failures", async () => {
    mockPrisma.caller.findMany.mockResolvedValue([
      { id: "c-1" },
      { id: "c-2" },
    ]);
    mockPrisma.callerPlaybook.upsert
      .mockResolvedValueOnce({ id: "enr-1" })
      .mockRejectedValueOnce(new Error("Constraint violation"));

    const result = await enrollCohortMembersInPlaybook("cohort-1", "pb-1", "sync");

    expect(result.enrolled).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("c-2");
  });
});
