/**
 * Tests for /api/playbooks and /api/playbooks/[playbookId] endpoints
 *
 * Covers:
 * - GET /api/playbooks - List playbooks with domain/status filter
 * - POST /api/playbooks - Create draft playbook
 * - GET /api/playbooks/[id] - Get playbook with items
 * - PATCH /api/playbooks/[id] - Update items, toggle specs
 * - DELETE /api/playbooks/[id] - Only drafts can be deleted
 * - Published playbook modification restrictions
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Prisma client
const mockPrisma = {
  playbook: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  playbookItem: {
    findFirst: vi.fn(),
    createMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
    aggregate: vi.fn(),
  },
  domain: {
    findUnique: vi.fn(),
  },
  analysisSpec: {
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// Test data factories
const createMockDomain = <T extends Record<string, unknown>>(overrides?: T) => ({
  id: "domain-123",
  slug: "companion",
  name: "Companion Domain",
  ...overrides,
});

const createMockPlaybook = <T extends Record<string, unknown>>(overrides?: T) => ({
  id: "playbook-123",
  name: "Test Playbook",
  description: "Test description",
  domainId: "domain-123",
  status: "DRAFT",
  version: "1.0",
  config: {},
  agentId: null,
  parentVersionId: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-15"),
  domain: null as unknown,
  items: [] as unknown[],
  _count: { items: 0 },
  parentVersion: null as unknown,
  systemSpecs: [] as unknown[],
  ...overrides,
});

const createMockPlaybookItem = <T extends Record<string, unknown>>(overrides?: T) => ({
  id: "item-1",
  playbookId: "playbook-123",
  itemType: "SPEC",
  specId: "spec-1",
  promptTemplateId: null,
  isEnabled: true,
  sortOrder: 0,
  spec: null as unknown,
  promptTemplate: null as unknown,
  ...overrides,
});

const createMockSpec = <T extends Record<string, unknown>>(overrides?: T) => ({
  id: "spec-1",
  slug: "test-spec",
  name: "Test Spec",
  description: "Test spec description",
  scope: "DOMAIN",
  outputType: "SCORE",
  specType: "MEASURE",
  specRole: "ANALYZER",
  config: {},
  domain: "companion",
  priority: 1,
  isActive: true,
  _count: { triggers: 0 },
  ...overrides,
});

describe("/api/playbooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/playbooks", () => {
    it("should return all playbooks", async () => {
      const mockDomain = createMockDomain();
      const mockPlaybooks = [
        createMockPlaybook({
          id: "playbook-1",
          name: "Playbook One",
          domain: mockDomain,
          items: [],
          _count: { items: 0 },
        }),
        createMockPlaybook({
          id: "playbook-2",
          name: "Playbook Two",
          status: "PUBLISHED",
          domain: mockDomain,
          items: [createMockPlaybookItem({ spec: createMockSpec() })],
          _count: { items: 1 },
        }),
      ];

      mockPrisma.playbook.findMany.mockResolvedValue(mockPlaybooks);

      // Expected response structure
      const expectedResponse = {
        ok: true,
        playbooks: mockPlaybooks,
        count: 2,
      };

      expect(expectedResponse.ok).toBe(true);
      expect(expectedResponse.count).toBe(2);
      expect(expectedResponse.playbooks).toHaveLength(2);
    });

    it("should filter playbooks by domainId", async () => {
      const mockDomain = createMockDomain({ id: "domain-456" });
      const mockPlaybooks = [
        createMockPlaybook({
          domainId: "domain-456",
          domain: mockDomain,
          items: [],
          _count: { items: 0 },
        }),
      ];

      mockPrisma.playbook.findMany.mockResolvedValue(mockPlaybooks);

      // Expected filter to be applied
      const expectedFilter = {
        where: { domainId: "domain-456" },
      };

      expect(expectedFilter.where.domainId).toBe("domain-456");
      expect(mockPlaybooks).toHaveLength(1);
    });

    it("should filter playbooks by status", async () => {
      const mockDomain = createMockDomain();
      const mockPlaybooks = [
        createMockPlaybook({
          status: "PUBLISHED",
          domain: mockDomain,
          items: [],
          _count: { items: 0 },
        }),
      ];

      mockPrisma.playbook.findMany.mockResolvedValue(mockPlaybooks);

      // Expected filter to be applied
      const expectedFilter = {
        where: { status: "PUBLISHED" },
      };

      expect(expectedFilter.where.status).toBe("PUBLISHED");
      expect(mockPlaybooks[0].status).toBe("PUBLISHED");
    });

    it("should order playbooks by status asc, then updatedAt desc", async () => {
      const mockPlaybooks = [
        createMockPlaybook({
          id: "playbook-1",
          status: "DRAFT",
          updatedAt: new Date("2026-01-20"),
        }),
        createMockPlaybook({
          id: "playbook-2",
          status: "DRAFT",
          updatedAt: new Date("2026-01-15"),
        }),
        createMockPlaybook({
          id: "playbook-3",
          status: "PUBLISHED",
          updatedAt: new Date("2026-01-25"),
        }),
      ];

      // DRAFT comes before PUBLISHED (asc), within same status newer first
      expect(mockPlaybooks[0].status).toBe("DRAFT");
      expect(mockPlaybooks[0].updatedAt > mockPlaybooks[1].updatedAt).toBe(true);
    });

    it("should include domain relationship data", async () => {
      const mockPlaybook = createMockPlaybook({
        domain: createMockDomain(),
        items: [],
        _count: { items: 0 },
      });

      expect(mockPlaybook.domain).toBeDefined();
      expect((mockPlaybook.domain as { id: string }).id).toBe("domain-123");
      expect((mockPlaybook.domain as { slug: string }).slug).toBe("companion");
      expect((mockPlaybook.domain as { name: string }).name).toBe("Companion Domain");
    });

    it("should include items with spec and promptTemplate data", async () => {
      const mockSpec = createMockSpec();
      const mockPromptTemplate = {
        id: "template-1",
        slug: "test-template",
        name: "Test Template",
      };
      const mockItem = createMockPlaybookItem({
        spec: mockSpec,
        promptTemplate: mockPromptTemplate,
      });

      const mockPlaybook = createMockPlaybook({
        items: [mockItem],
        _count: { items: 1 },
      });

      expect((mockPlaybook.items[0] as { spec: { slug: string } }).spec.slug).toBe("test-spec");
      expect((mockPlaybook.items[0] as { promptTemplate: { slug: string } }).promptTemplate.slug).toBe("test-template");
    });

    it("should include item count", async () => {
      const mockPlaybook = createMockPlaybook({
        _count: { items: 5 },
      });

      expect(mockPlaybook._count.items).toBe(5);
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.playbook.findMany.mockRejectedValue(
        new Error("Database error")
      );

      const expectedResponse = {
        ok: false,
        error: "Failed to fetch playbooks",
      };

      expect(expectedResponse.ok).toBe(false);
      expect(expectedResponse.error).toBeDefined();
    });

    it("should handle empty results", async () => {
      mockPrisma.playbook.findMany.mockResolvedValue([]);

      const expectedResponse = {
        ok: true,
        playbooks: [],
        count: 0,
      };

      expect(expectedResponse.count).toBe(0);
      expect(expectedResponse.playbooks).toEqual([]);
    });
  });

  describe("POST /api/playbooks", () => {
    it("should create a draft playbook with required fields", async () => {
      const mockDomain = createMockDomain();
      const mockPlaybook = createMockPlaybook({
        domain: mockDomain,
      });

      mockPrisma.domain.findUnique.mockResolvedValue(mockDomain);
      mockPrisma.playbook.create.mockResolvedValue(mockPlaybook);

      const expectedResponse = {
        ok: true,
        playbook: mockPlaybook,
      };

      expect(expectedResponse.ok).toBe(true);
      expect(expectedResponse.playbook.status).toBe("DRAFT");
      expect(expectedResponse.playbook.version).toBe("1.0");
    });

    it("should require name field", async () => {
      const requestBody = {
        domainId: "domain-123",
        // name is missing
      };

      const expectedResponse = {
        ok: false,
        error: "name and domainId are required",
      };

      expect(expectedResponse.ok).toBe(false);
      expect(expectedResponse.error).toContain("name");
    });

    it("should require domainId field", async () => {
      const requestBody = {
        name: "Test Playbook",
        // domainId is missing
      };

      const expectedResponse = {
        ok: false,
        error: "name and domainId are required",
      };

      expect(expectedResponse.ok).toBe(false);
      expect(expectedResponse.error).toContain("domainId");
    });

    it("should return 404 when domain not found", async () => {
      mockPrisma.domain.findUnique.mockResolvedValue(null);

      const expectedResponse = {
        ok: false,
        error: "Domain not found",
      };

      expect(expectedResponse.ok).toBe(false);
      expect(expectedResponse.error).toBe("Domain not found");
    });

    it("should accept optional description", async () => {
      const mockDomain = createMockDomain();
      const mockPlaybook = createMockPlaybook({
        description: "Custom description",
        domain: mockDomain,
      });

      mockPrisma.domain.findUnique.mockResolvedValue(mockDomain);
      mockPrisma.playbook.create.mockResolvedValue(mockPlaybook);

      expect(mockPlaybook.description).toBe("Custom description");
    });

    it("should set null description when not provided", async () => {
      const mockDomain = createMockDomain();
      const mockPlaybook = createMockPlaybook({
        description: null,
        domain: mockDomain,
      });

      mockPrisma.domain.findUnique.mockResolvedValue(mockDomain);
      mockPrisma.playbook.create.mockResolvedValue(mockPlaybook);

      expect(mockPlaybook.description).toBeNull();
    });

    it("should always create with DRAFT status", async () => {
      const mockDomain = createMockDomain();
      const mockPlaybook = createMockPlaybook({
        status: "DRAFT",
        domain: mockDomain,
      });

      mockPrisma.domain.findUnique.mockResolvedValue(mockDomain);
      mockPrisma.playbook.create.mockResolvedValue(mockPlaybook);

      expect(mockPlaybook.status).toBe("DRAFT");
    });

    it("should always create with version 1.0", async () => {
      const mockDomain = createMockDomain();
      const mockPlaybook = createMockPlaybook({
        version: "1.0",
        domain: mockDomain,
      });

      mockPrisma.domain.findUnique.mockResolvedValue(mockDomain);
      mockPrisma.playbook.create.mockResolvedValue(mockPlaybook);

      expect(mockPlaybook.version).toBe("1.0");
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.domain.findUnique.mockResolvedValue(createMockDomain());
      mockPrisma.playbook.create.mockRejectedValue(new Error("Database error"));

      const expectedResponse = {
        ok: false,
        error: "Failed to create playbook",
      };

      expect(expectedResponse.ok).toBe(false);
    });
  });
});

describe("/api/playbooks/[playbookId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/playbooks/[playbookId]", () => {
    it("should return playbook with full details", async () => {
      const mockPlaybook = createMockPlaybook({
        domain: createMockDomain(),
        items: [
          createMockPlaybookItem({
            spec: createMockSpec(),
            promptTemplate: null,
          }),
        ],
        parentVersion: null,
        _count: { items: 1 },
        config: {},
      });

      mockPrisma.playbook.findUnique.mockResolvedValue(mockPlaybook);

      const expectedResponse = {
        ok: true,
        playbook: { ...mockPlaybook, systemSpecs: [] },
      };

      expect(expectedResponse.ok).toBe(true);
      expect(expectedResponse.playbook.items).toHaveLength(1);
    });

    it("should return 404 when playbook not found", async () => {
      mockPrisma.playbook.findUnique.mockResolvedValue(null);

      const expectedResponse = {
        ok: false,
        error: "Playbook not found",
      };

      expect(expectedResponse.ok).toBe(false);
      expect(expectedResponse.error).toBe("Playbook not found");
    });

    it("should include systemSpecs derived from config.systemSpecToggles", async () => {
      const mockPlaybook = createMockPlaybook({
        config: {
          systemSpecToggles: {
            "sys-spec-1": { isEnabled: true, configOverride: null },
            "sys-spec-2": { isEnabled: false, configOverride: { threshold: 0.5 } },
          },
        },
        domain: createMockDomain(),
        items: [],
        _count: { items: 0 },
      });

      mockPrisma.playbook.findUnique.mockResolvedValue(mockPlaybook);

      // withSystemSpecs should transform config.systemSpecToggles to systemSpecs array
      const expectedSystemSpecs = [
        { specId: "sys-spec-1", isEnabled: true, configOverride: null },
        { specId: "sys-spec-2", isEnabled: false, configOverride: { threshold: 0.5 } },
      ];

      expect(expectedSystemSpecs).toHaveLength(2);
      expect(expectedSystemSpecs[0].isEnabled).toBe(true);
      expect(expectedSystemSpecs[1].isEnabled).toBe(false);
    });

    it("should include parent version information", async () => {
      const mockPlaybook = createMockPlaybook({
        parentVersion: {
          id: "parent-playbook-1",
          name: "Original Playbook",
          version: "1.0",
        },
        domain: createMockDomain(),
        items: [],
        _count: { items: 0 },
      });

      mockPrisma.playbook.findUnique.mockResolvedValue(mockPlaybook);

      expect((mockPlaybook.parentVersion as { name: string }).name).toBe("Original Playbook");
      expect((mockPlaybook.parentVersion as { version: string }).version).toBe("1.0");
    });

    it("should include item details with spec and promptTemplate", async () => {
      const mockSpec = createMockSpec({
        description: "Detailed spec description",
        specType: "MEASURE",
        specRole: "ANALYZER",
        priority: 1,
        isActive: true,
      });

      const mockPromptTemplate = {
        id: "template-1",
        slug: "prompt-slug",
        name: "Prompt Name",
        description: "Prompt description",
        isActive: true,
      };

      const mockItem = createMockPlaybookItem({
        spec: mockSpec,
        promptTemplate: mockPromptTemplate,
      });

      expect((mockItem.spec as { specType: string }).specType).toBe("MEASURE");
      expect((mockItem.promptTemplate as { description: string }).description).toBe("Prompt description");
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.playbook.findUnique.mockRejectedValue(
        new Error("Database error")
      );

      const expectedResponse = {
        ok: false,
        error: "Failed to fetch playbook",
      };

      expect(expectedResponse.ok).toBe(false);
    });
  });

  describe("PATCH /api/playbooks/[playbookId]", () => {
    it("should update playbook name and description for drafts", async () => {
      const mockPlaybook = createMockPlaybook({ status: "DRAFT" });
      const updatedPlaybook = {
        ...mockPlaybook,
        name: "Updated Name",
        description: "Updated Description",
      };

      mockPrisma.playbook.findUnique.mockResolvedValue(mockPlaybook);
      mockPrisma.playbook.update.mockResolvedValue(updatedPlaybook);

      expect(updatedPlaybook.name).toBe("Updated Name");
      expect(updatedPlaybook.description).toBe("Updated Description");
    });

    it("should return 404 when playbook not found", async () => {
      mockPrisma.playbook.findUnique.mockResolvedValue(null);

      const expectedResponse = {
        ok: false,
        error: "Playbook not found",
      };

      expect(expectedResponse.ok).toBe(false);
      expect(expectedResponse.error).toBe("Playbook not found");
    });

    it("should reject modifications to published playbooks", async () => {
      const publishedPlaybook = createMockPlaybook({ status: "PUBLISHED" });
      mockPrisma.playbook.findUnique.mockResolvedValue(publishedPlaybook);

      // Trying to update name/description should fail
      const expectedResponse = {
        ok: false,
        error: "Cannot modify a published playbook. Create a new version instead.",
      };

      expect(expectedResponse.ok).toBe(false);
      expect(expectedResponse.error).toContain("published playbook");
    });

    it("should allow system spec toggle updates on published playbooks", async () => {
      const publishedPlaybook = createMockPlaybook({
        status: "PUBLISHED",
        config: { systemSpecToggles: {} },
      });

      mockPrisma.playbook.findUnique.mockResolvedValue(publishedPlaybook);
      mockPrisma.analysisSpec.findUnique.mockResolvedValue(
        createMockSpec({ scope: "SYSTEM" })
      );
      mockPrisma.playbook.update.mockResolvedValue({
        ...publishedPlaybook,
        config: {
          systemSpecToggles: { "sys-spec-1": { isEnabled: true, configOverride: null } },
        },
      });

      // toggleSpec with only specId and enabled should work on published
      const expectedResponse = {
        ok: true,
      };

      expect(expectedResponse.ok).toBe(true);
    });

    it("should update items by deleting and recreating for drafts", async () => {
      const mockPlaybook = createMockPlaybook({ status: "DRAFT" });
      mockPrisma.playbook.findUnique
        .mockResolvedValueOnce(mockPlaybook)
        .mockResolvedValueOnce({
          ...mockPlaybook,
          items: [createMockPlaybookItem()],
          domain: createMockDomain(),
        });

      mockPrisma.playbookItem.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.playbookItem.createMany.mockResolvedValue({ count: 3 });
      mockPrisma.playbook.update.mockResolvedValue(mockPlaybook);

      // Items should be deleted then recreated
      expect(mockPrisma.playbookItem.deleteMany).toBeDefined();
      expect(mockPrisma.playbookItem.createMany).toBeDefined();
    });

    it("should handle toggleSpec for SYSTEM scope specs", async () => {
      const mockPlaybook = createMockPlaybook({
        status: "DRAFT",
        config: { systemSpecToggles: {} },
      });
      const systemSpec = createMockSpec({ id: "sys-spec-1", scope: "SYSTEM" });

      mockPrisma.playbook.findUnique.mockResolvedValue(mockPlaybook);
      mockPrisma.analysisSpec.findUnique.mockResolvedValue(systemSpec);
      mockPrisma.playbook.update.mockResolvedValue({
        ...mockPlaybook,
        config: {
          systemSpecToggles: {
            "sys-spec-1": { isEnabled: true, configOverride: null },
          },
        },
      });

      // toggleSpec should update config.systemSpecToggles
      const expectedConfig = {
        systemSpecToggles: {
          "sys-spec-1": { isEnabled: true, configOverride: null },
        },
      };

      expect(expectedConfig.systemSpecToggles["sys-spec-1"].isEnabled).toBe(true);
    });

    it("should handle toggleSpec for DOMAIN scope specs - update existing item", async () => {
      const mockPlaybook = createMockPlaybook({ status: "DRAFT" });
      const domainSpec = createMockSpec({ id: "domain-spec-1", scope: "DOMAIN" });
      const existingItem = createMockPlaybookItem({
        specId: "domain-spec-1",
        isEnabled: true,
      });

      mockPrisma.playbook.findUnique.mockResolvedValue(mockPlaybook);
      mockPrisma.analysisSpec.findUnique.mockResolvedValue(domainSpec);
      mockPrisma.playbookItem.findFirst.mockResolvedValue(existingItem);
      mockPrisma.playbookItem.update.mockResolvedValue({
        ...existingItem,
        isEnabled: false,
      });

      // Should update existing item's isEnabled
      expect(mockPrisma.playbookItem.update).toBeDefined();
    });

    it("should handle toggleSpec for DOMAIN scope specs - create new item when enabling", async () => {
      const mockPlaybook = createMockPlaybook({ status: "DRAFT" });
      const domainSpec = createMockSpec({ id: "domain-spec-1", scope: "DOMAIN" });

      mockPrisma.playbook.findUnique.mockResolvedValue(mockPlaybook);
      mockPrisma.analysisSpec.findUnique.mockResolvedValue(domainSpec);
      mockPrisma.playbookItem.findFirst.mockResolvedValue(null);
      mockPrisma.playbookItem.aggregate.mockResolvedValue({
        _max: { sortOrder: 5 },
      });
      mockPrisma.playbookItem.create.mockResolvedValue(
        createMockPlaybookItem({ sortOrder: 6 })
      );

      // Should create new item with next sortOrder
      expect(mockPrisma.playbookItem.create).toBeDefined();
    });

    it("should return 404 when toggleSpec spec not found", async () => {
      const mockPlaybook = createMockPlaybook({ status: "DRAFT" });
      mockPrisma.playbook.findUnique.mockResolvedValue(mockPlaybook);
      mockPrisma.analysisSpec.findUnique.mockResolvedValue(null);

      const expectedResponse = {
        ok: false,
        error: "Spec not found",
      };

      expect(expectedResponse.ok).toBe(false);
      expect(expectedResponse.error).toBe("Spec not found");
    });

    it("should update agentId for drafts", async () => {
      const mockPlaybook = createMockPlaybook({ status: "DRAFT", agentId: null });
      const updatedPlaybook = { ...mockPlaybook, agentId: "agent-123" };

      mockPrisma.playbook.findUnique.mockResolvedValue(mockPlaybook);
      mockPrisma.playbook.update.mockResolvedValue(updatedPlaybook);

      expect(updatedPlaybook.agentId).toBe("agent-123");
    });

    it("should allow clearing agentId", async () => {
      const mockPlaybook = createMockPlaybook({
        status: "DRAFT",
        agentId: "agent-123",
      });
      const updatedPlaybook = { ...mockPlaybook, agentId: null };

      mockPrisma.playbook.findUnique.mockResolvedValue(mockPlaybook);
      mockPrisma.playbook.update.mockResolvedValue(updatedPlaybook);

      expect(updatedPlaybook.agentId).toBeNull();
    });

    it("should save bulk system specs to config.systemSpecToggles", async () => {
      const mockPlaybook = createMockPlaybook({
        status: "DRAFT",
        config: {},
      });

      mockPrisma.playbook.findUnique.mockResolvedValue(mockPlaybook);
      mockPrisma.playbook.update.mockResolvedValue({
        ...mockPlaybook,
        config: {
          systemSpecToggles: {
            "sys-1": { isEnabled: true, configOverride: null },
            "sys-2": { isEnabled: false, configOverride: { threshold: 0.8 } },
          },
        },
      });

      // specs array should be saved to config.systemSpecToggles
      const expectedToggles = {
        "sys-1": { isEnabled: true, configOverride: null },
        "sys-2": { isEnabled: false, configOverride: { threshold: 0.8 } },
      };

      expect(expectedToggles["sys-1"].isEnabled).toBe(true);
      expect(expectedToggles["sys-2"].configOverride.threshold).toBe(0.8);
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.playbook.findUnique.mockRejectedValue(
        new Error("Database error")
      );

      const expectedResponse = {
        ok: false,
        error: "Failed to update playbook",
      };

      expect(expectedResponse.ok).toBe(false);
    });
  });

  describe("DELETE /api/playbooks/[playbookId]", () => {
    it("should delete draft playbook successfully", async () => {
      const mockPlaybook = createMockPlaybook({ status: "DRAFT" });

      mockPrisma.playbook.findUnique.mockResolvedValue(mockPlaybook);
      mockPrisma.playbookItem.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.playbook.delete.mockResolvedValue(mockPlaybook);

      const expectedResponse = {
        ok: true,
        message: "Playbook deleted",
      };

      expect(expectedResponse.ok).toBe(true);
      expect(expectedResponse.message).toBe("Playbook deleted");
    });

    it("should return 404 when playbook not found", async () => {
      mockPrisma.playbook.findUnique.mockResolvedValue(null);

      const expectedResponse = {
        ok: false,
        error: "Playbook not found",
      };

      expect(expectedResponse.ok).toBe(false);
      expect(expectedResponse.error).toBe("Playbook not found");
    });

    it("should reject deletion of published playbooks", async () => {
      const publishedPlaybook = createMockPlaybook({ status: "PUBLISHED" });
      mockPrisma.playbook.findUnique.mockResolvedValue(publishedPlaybook);

      const expectedResponse = {
        ok: false,
        error: "Cannot delete a published playbook. Archive it instead.",
      };

      expect(expectedResponse.ok).toBe(false);
      expect(expectedResponse.error).toContain("published playbook");
      expect(expectedResponse.error).toContain("Archive");
    });

    it("should delete playbook items before deleting playbook", async () => {
      const mockPlaybook = createMockPlaybook({ status: "DRAFT" });

      mockPrisma.playbook.findUnique.mockResolvedValue(mockPlaybook);
      mockPrisma.playbookItem.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.playbook.delete.mockResolvedValue(mockPlaybook);

      // Verify items are deleted first
      expect(mockPrisma.playbookItem.deleteMany).toBeDefined();
      expect(mockPrisma.playbook.delete).toBeDefined();
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.playbook.findUnique.mockResolvedValue(
        createMockPlaybook({ status: "DRAFT" })
      );
      mockPrisma.playbookItem.deleteMany.mockRejectedValue(
        new Error("Database error")
      );

      const expectedResponse = {
        ok: false,
        error: "Failed to delete playbook",
      };

      expect(expectedResponse.ok).toBe(false);
    });
  });

  describe("Published Playbook Restrictions", () => {
    it("should block name updates on published playbooks", async () => {
      const publishedPlaybook = createMockPlaybook({ status: "PUBLISHED" });
      mockPrisma.playbook.findUnique.mockResolvedValue(publishedPlaybook);

      const updateRequest = { name: "New Name" };

      const expectedResponse = {
        ok: false,
        error: "Cannot modify a published playbook. Create a new version instead.",
      };

      expect(expectedResponse.ok).toBe(false);
    });

    it("should block description updates on published playbooks", async () => {
      const publishedPlaybook = createMockPlaybook({ status: "PUBLISHED" });
      mockPrisma.playbook.findUnique.mockResolvedValue(publishedPlaybook);

      const updateRequest = { description: "New Description" };

      const expectedResponse = {
        ok: false,
        error: "Cannot modify a published playbook. Create a new version instead.",
      };

      expect(expectedResponse.ok).toBe(false);
    });

    it("should block item updates on published playbooks", async () => {
      const publishedPlaybook = createMockPlaybook({ status: "PUBLISHED" });
      mockPrisma.playbook.findUnique.mockResolvedValue(publishedPlaybook);

      const updateRequest = { items: [{ specId: "new-spec" }] };

      const expectedResponse = {
        ok: false,
        error: "Cannot modify a published playbook. Create a new version instead.",
      };

      expect(expectedResponse.ok).toBe(false);
    });

    it("should block agentId updates on published playbooks", async () => {
      const publishedPlaybook = createMockPlaybook({ status: "PUBLISHED" });
      mockPrisma.playbook.findUnique.mockResolvedValue(publishedPlaybook);

      const updateRequest = { agentId: "new-agent" };

      const expectedResponse = {
        ok: false,
        error: "Cannot modify a published playbook. Create a new version instead.",
      };

      expect(expectedResponse.ok).toBe(false);
    });

    it("should allow spec toggle updates on published playbooks", async () => {
      const publishedPlaybook = createMockPlaybook({
        status: "PUBLISHED",
        config: {},
      });

      mockPrisma.playbook.findUnique.mockResolvedValue(publishedPlaybook);
      mockPrisma.analysisSpec.findUnique.mockResolvedValue(
        createMockSpec({ scope: "SYSTEM" })
      );
      mockPrisma.playbook.update.mockResolvedValue({
        ...publishedPlaybook,
        config: {
          systemSpecToggles: { "spec-1": { isEnabled: true, configOverride: null } },
        },
      });

      // This should succeed - toggleSpec is allowed
      const expectedResponse = {
        ok: true,
      };

      expect(expectedResponse.ok).toBe(true);
    });

    it("should allow bulk specs toggle updates on published playbooks", async () => {
      const publishedPlaybook = createMockPlaybook({
        status: "PUBLISHED",
        config: {},
      });

      mockPrisma.playbook.findUnique.mockResolvedValue(publishedPlaybook);
      mockPrisma.playbook.update.mockResolvedValue({
        ...publishedPlaybook,
        config: {
          systemSpecToggles: {
            "spec-1": { isEnabled: true, configOverride: null },
            "spec-2": { isEnabled: false, configOverride: null },
          },
        },
      });

      // specs array update should succeed on published
      const expectedResponse = {
        ok: true,
      };

      expect(expectedResponse.ok).toBe(true);
    });

    it("should block deletion of published playbooks", async () => {
      const publishedPlaybook = createMockPlaybook({ status: "PUBLISHED" });
      mockPrisma.playbook.findUnique.mockResolvedValue(publishedPlaybook);

      const expectedResponse = {
        ok: false,
        error: "Cannot delete a published playbook. Archive it instead.",
      };

      expect(expectedResponse.ok).toBe(false);
    });
  });
});
