import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    callerAttribute: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/config", () => ({
  config: {
    scheduler: {
      assessmentModes: ["assess", "practice"],
      placeholderMode: "teach",
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { shouldRunCallerAnalysis } from "@/lib/pipeline/event-gate";

const mockFindUnique = prisma.callerAttribute.findUnique as ReturnType<typeof vi.fn>;

describe("event-gate.shouldRunCallerAnalysis", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
  });

  it("allows scoring when no prior SchedulerDecision exists", async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await shouldRunCallerAnalysis("caller-1");
    expect(result.allow).toBe(true);
    expect(result.mode).toBe("unknown");
    expect(result.reason).toMatch(/no prior/i);
  });

  it("denies scoring when prior decision was teach mode", async () => {
    mockFindUnique.mockResolvedValue({
      jsonValue: { mode: "teach", reason: "", writtenAt: "" },
    });
    const result = await shouldRunCallerAnalysis("caller-1");
    expect(result.allow).toBe(false);
    expect(result.mode).toBe("teach");
    expect(result.reason).toMatch(/no assessment evidence/);
  });

  it("denies scoring when prior decision was review mode", async () => {
    mockFindUnique.mockResolvedValue({
      jsonValue: { mode: "review", reason: "", writtenAt: "" },
    });
    const result = await shouldRunCallerAnalysis("caller-1");
    expect(result.allow).toBe(false);
  });

  it("allows scoring when prior decision was assess mode", async () => {
    mockFindUnique.mockResolvedValue({
      jsonValue: { mode: "assess", reason: "", writtenAt: "" },
    });
    const result = await shouldRunCallerAnalysis("caller-1");
    expect(result.allow).toBe(true);
    expect(result.mode).toBe("assess");
  });

  it("allows scoring when prior decision was practice mode", async () => {
    mockFindUnique.mockResolvedValue({
      jsonValue: { mode: "practice", reason: "", writtenAt: "" },
    });
    const result = await shouldRunCallerAnalysis("caller-1");
    expect(result.allow).toBe(true);
    expect(result.mode).toBe("practice");
  });
});
