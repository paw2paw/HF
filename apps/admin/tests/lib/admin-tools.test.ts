/**
 * Admin Tool Handlers Tests
 *
 * Tests the tool handlers used by the Cmd+K AI assistant.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma — factory must be inline (vi.mock is hoisted)
vi.mock("@/lib/prisma", () => ({
  prisma: {
    analysisSpec: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    caller: {
      findMany: vi.fn(),
    },
    domain: {
      findFirst: vi.fn(),
    },
  },
}));

import { executeAdminTool } from "@/lib/chat/admin-tool-handlers";
import { prisma } from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("executeAdminTool", () => {
  it("returns error for unknown tool", async () => {
    const result = await executeAdminTool("nonexistent_tool", {});
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain("Unknown tool");
  });

  it("handles execution errors gracefully", async () => {
    mockPrisma.analysisSpec.findMany.mockRejectedValue(new Error("DB connection failed"));
    const result = await executeAdminTool("query_specs", {});
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain("Tool execution failed");
  });
});

describe("query_specs", () => {
  it("returns specs matching filters", async () => {
    mockPrisma.analysisSpec.findMany.mockResolvedValue([
      {
        id: "spec-1",
        name: "Test Tutor Identity",
        slug: "test-tutor-identity",
        specRole: "IDENTITY",
        outputType: "COMPOSE",
        scope: "DOMAIN",
        extendsAgent: "TUT-001",
        isActive: true,
        description: "A test tutor",
      },
    ] as any);

    const result = await executeAdminTool("query_specs", { spec_role: "IDENTITY" });
    const parsed = JSON.parse(result);

    expect(parsed.count).toBe(1);
    expect(parsed.specs[0].name).toBe("Test Tutor Identity");
    expect(parsed.specs[0].specRole).toBe("IDENTITY");
    expect(mockPrisma.analysisSpec.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ specRole: "IDENTITY", isActive: true }),
      })
    );
  });

  it("limits results to max 25", async () => {
    mockPrisma.analysisSpec.findMany.mockResolvedValue([] as any);
    await executeAdminTool("query_specs", { limit: 100 });
    expect(mockPrisma.analysisSpec.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 })
    );
  });

  it("searches by name case-insensitively", async () => {
    mockPrisma.analysisSpec.findMany.mockResolvedValue([] as any);
    await executeAdminTool("query_specs", { name: "creative" });
    expect(mockPrisma.analysisSpec.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: "creative", mode: "insensitive" },
        }),
      })
    );
  });
});

describe("get_spec_config", () => {
  it("returns full config for a spec", async () => {
    mockPrisma.analysisSpec.findUnique.mockResolvedValue({
      id: "spec-1",
      name: "Test Spec",
      slug: "test-spec",
      specRole: "IDENTITY",
      extendsAgent: "TUT-001",
      config: { roleStatement: "You are a tutor", styleGuidelines: ["Be friendly"] },
      description: "A test spec",
      isActive: true,
    } as any);

    const result = await executeAdminTool("get_spec_config", { spec_id: "spec-1" });
    const parsed = JSON.parse(result);

    expect(parsed.config.roleStatement).toBe("You are a tutor");
    expect(parsed.config.styleGuidelines).toEqual(["Be friendly"]);
    expect(parsed.extendsAgent).toBe("TUT-001");
  });

  it("returns error for missing spec", async () => {
    mockPrisma.analysisSpec.findUnique.mockResolvedValue(null);
    const result = await executeAdminTool("get_spec_config", { spec_id: "nonexistent" });
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain("Spec not found");
  });
});

describe("update_spec_config", () => {
  it("merges updates into existing config", async () => {
    mockPrisma.analysisSpec.findUnique.mockResolvedValue({
      id: "spec-1",
      name: "Test Spec",
      config: { roleStatement: "Old role", warmth: "high" },
      isLocked: false,
    } as any);
    mockPrisma.analysisSpec.update.mockResolvedValue({} as any);

    const result = await executeAdminTool("update_spec_config", {
      spec_id: "spec-1",
      config_updates: { roleStatement: "New role", styleGuidelines: ["Be warm"] },
      reason: "Improve tone",
    });
    const parsed = JSON.parse(result);

    expect(parsed.ok).toBe(true);
    expect(parsed.fieldsUpdated).toContain("roleStatement");
    expect(parsed.fieldsUpdated).toContain("styleGuidelines");

    expect(mockPrisma.analysisSpec.update).toHaveBeenCalledWith({
      where: { id: "spec-1" },
      data: {
        config: {
          roleStatement: "New role",
          warmth: "high",
          styleGuidelines: ["Be warm"],
        },
      },
    });
  });

  it("refuses to update locked specs", async () => {
    mockPrisma.analysisSpec.findUnique.mockResolvedValue({
      id: "spec-1",
      name: "Locked Spec",
      config: {},
      isLocked: true,
    } as any);

    const result = await executeAdminTool("update_spec_config", {
      spec_id: "spec-1",
      config_updates: { roleStatement: "New" },
      reason: "Test",
    });
    const parsed = JSON.parse(result);

    expect(parsed.error).toContain("locked");
    expect(mockPrisma.analysisSpec.update).not.toHaveBeenCalled();
  });

  it("returns error for missing spec", async () => {
    mockPrisma.analysisSpec.findUnique.mockResolvedValue(null);
    const result = await executeAdminTool("update_spec_config", {
      spec_id: "nonexistent",
      config_updates: { roleStatement: "New" },
      reason: "Test",
    });
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain("Spec not found");
  });
});

describe("query_callers", () => {
  it("returns callers with personality summary", async () => {
    mockPrisma.caller.findMany.mockResolvedValue([
      {
        id: "caller-1",
        name: "Alice",
        email: "alice@test.com",
        domain: { name: "Creative Comprehension" },
        personality: {
          openness: 0.8,
          conscientiousness: 0.6,
          extraversion: 0.4,
          agreeableness: 0.7,
          neuroticism: 0.3,
        },
        _count: { calls: 5 },
      },
    ] as any);

    const result = await executeAdminTool("query_callers", { name: "alice" });
    const parsed = JSON.parse(result);

    expect(parsed.count).toBe(1);
    expect(parsed.callers[0].name).toBe("Alice");
    expect(parsed.callers[0].personality.O).toBe(80);
    expect(parsed.callers[0].totalCalls).toBe(5);
  });
});

describe("get_domain_info", () => {
  it("returns domain with specs and config", async () => {
    mockPrisma.domain.findFirst.mockResolvedValue({
      id: "domain-1",
      name: "Creative Comprehension",
      slug: "creative-comprehension",
      description: "11+ exam prep",
      playbooks: [
        {
          id: "pb-1",
          name: "CC Playbook",
          status: "PUBLISHED",
          items: [
            {
              spec: {
                id: "spec-1",
                name: "CC Identity",
                slug: "cc-identity",
                specRole: "IDENTITY",
                config: { roleStatement: "You are a tutor" },
                extendsAgent: "TUT-001",
              },
            },
          ],
        },
      ],
      _count: { callers: 12 },
    } as any);

    const result = await executeAdminTool("get_domain_info", { domain_name: "Creative" });
    const parsed = JSON.parse(result);

    expect(parsed.name).toBe("Creative Comprehension");
    expect(parsed.callerCount).toBe(12);
    expect(parsed.publishedPlaybook.status).toBe("PUBLISHED");
    expect(parsed.identitySpecConfig.roleStatement).toBe("You are a tutor");
  });

  it("returns error when neither id nor name provided", async () => {
    const result = await executeAdminTool("get_domain_info", {});
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain("domain_id or domain_name");
  });
});

describe("result truncation", () => {
  it("truncates large results", async () => {
    const largeConfig: Record<string, string> = {};
    for (let i = 0; i < 200; i++) {
      largeConfig[`field_${i}`] = "x".repeat(50);
    }

    mockPrisma.analysisSpec.findUnique.mockResolvedValue({
      id: "spec-1",
      name: "Big Spec",
      slug: "big-spec",
      specRole: "IDENTITY",
      extendsAgent: null,
      config: largeConfig,
      description: "Has a huge config",
      isActive: true,
    } as any);

    const result = await executeAdminTool("get_spec_config", { spec_id: "spec-1" });
    expect(result.length).toBeLessThanOrEqual(3100);
    expect(result).toContain("truncated");
  });
});
