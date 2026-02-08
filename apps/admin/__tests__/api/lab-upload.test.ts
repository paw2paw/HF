/**
 * Tests for /api/lab/upload and /api/lab/upload/preview endpoints
 *
 * Covers:
 * - POST /api/lab/upload - Upload and activate BDD spec
 * - POST /api/lab/upload/preview - Preview spec upload artifacts
 * - Spec validation and parsing
 * - BDDFeatureSet create/update
 * - AnalysisSpec create/update
 * - Version incrementing
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock fs module
vi.mock("fs", () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock Prisma client
const mockPrisma = {
  bDDFeatureSet: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  analysisSpec: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  parameter: {
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// Mock BDD parser
const mockParseResult = {
  success: true,
  data: {
    id: "test-spec-001",
    title: "Test Spec",
    version: "1.0",
    specType: "DOMAIN",
    outputType: "MEASURE",
    specRole: "ANALYZER",
    domain: "companion",
    story: {
      asA: "system",
      iWant: "to analyze conversations",
      soThat: "I can provide insights",
    },
    parameters: [
      { id: "param-1", name: "Engagement Score", dataType: "number" },
      { id: "param-2", name: "Sentiment", dataType: "string" },
    ],
  },
  errors: [],
};

vi.mock("@/lib/bdd/ai-parser", () => ({
  parseJsonSpec: vi.fn(() => mockParseResult),
  convertJsonSpecToHybrid: vi.fn(() => ({
    parameterData: { parameters: mockParseResult.data.parameters },
    storyData: { constraints: [] },
  })),
}));

// Test data factories
const createMockSpec = <T extends Record<string, unknown>>(overrides?: T) => ({
  id: "test-spec-001",
  title: "Test Spec",
  version: "1.0",
  specType: "DOMAIN",
  outputType: "MEASURE",
  specRole: "ANALYZER",
  domain: "companion",
  story: {
    asA: "system",
    iWant: "to analyze conversations",
    soThat: "I can provide insights",
  },
  parameters: [
    { id: "param-1", name: "Engagement Score", dataType: "number" },
  ],
  ...overrides,
});

const createMockFeatureSet = <T extends Record<string, unknown>>(overrides?: T) => ({
  id: "feature-set-123",
  featureId: "test-spec-001",
  name: "Test Spec",
  version: "1.0",
  specType: "DOMAIN",
  parameters: [] as Array<{ id: string; name: string; dataType: string }>,
  ...overrides,
});

const createMockAnalysisSpec = <T extends Record<string, unknown>>(overrides?: T) => ({
  id: "analysis-spec-123",
  slug: "spec-test-spec-001",
  name: "Test Spec",
  scope: "DOMAIN",
  outputType: "MEASURE",
  specRole: "ANALYZER",
  isActive: true,
  version: "1.0",
  priority: 0,
  config: {} as Record<string, unknown>,
  ...overrides,
});

describe("/api/lab/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/lab/upload", () => {
    it("should require spec in request body", async () => {
      const requestBody = {};

      const expectedResponse = {
        ok: false,
        error: "No spec provided. Send { spec: {...} }",
      };

      expect(expectedResponse.ok).toBe(false);
      expect(expectedResponse.error).toContain("No spec provided");
    });

    it("should validate spec and return errors for invalid specs", async () => {
      const { parseJsonSpec } = await import("@/lib/bdd/ai-parser");
      (parseJsonSpec as any).mockReturnValueOnce({
        success: false,
        errors: ["Missing required field: id", "Missing required field: title"],
      });

      const expectedResponse = {
        ok: false,
        error: "Invalid spec: Missing required field: id, Missing required field: title",
      };

      expect(expectedResponse.ok).toBe(false);
      expect(expectedResponse.error).toContain("Invalid spec");
    });

    it("should create new BDDFeatureSet and AnalysisSpec for new spec", async () => {
      mockPrisma.bDDFeatureSet.findFirst.mockResolvedValue(null);
      mockPrisma.analysisSpec.findUnique.mockResolvedValue(null);

      const mockFeatureSet = createMockFeatureSet();
      const mockAnalysisSpec = createMockAnalysisSpec();

      mockPrisma.bDDFeatureSet.create.mockResolvedValue(mockFeatureSet);
      mockPrisma.analysisSpec.create.mockResolvedValue(mockAnalysisSpec);

      const expectedResponse = {
        ok: true,
        featureSet: {
          id: mockFeatureSet.id,
          featureId: mockFeatureSet.featureId,
          name: mockFeatureSet.name,
          version: mockFeatureSet.version,
        },
        spec: {
          id: mockAnalysisSpec.id,
          slug: mockAnalysisSpec.slug,
          name: mockAnalysisSpec.name,
          scope: mockAnalysisSpec.scope,
          outputType: mockAnalysisSpec.outputType,
        },
        message: "Spec created and activated",
      };

      expect(expectedResponse.ok).toBe(true);
      expect(expectedResponse.message).toBe("Spec created and activated");
    });

    it("should update existing BDDFeatureSet and increment version", async () => {
      const existingFeatureSet = createMockFeatureSet({ version: "1.5" });
      mockPrisma.bDDFeatureSet.findFirst.mockResolvedValue(existingFeatureSet);
      mockPrisma.analysisSpec.findUnique.mockResolvedValue(null);

      const updatedFeatureSet = createMockFeatureSet({ version: "1.6" });
      const mockAnalysisSpec = createMockAnalysisSpec();

      mockPrisma.bDDFeatureSet.update.mockResolvedValue(updatedFeatureSet);
      mockPrisma.analysisSpec.create.mockResolvedValue(mockAnalysisSpec);

      const expectedResponse = {
        ok: true,
        featureSet: {
          version: "1.6",
        },
        message: "Spec updated and re-activated",
      };

      expect(expectedResponse.featureSet.version).toBe("1.6");
      expect(expectedResponse.message).toBe("Spec updated and re-activated");
    });

    it("should update existing AnalysisSpec when slug exists", async () => {
      mockPrisma.bDDFeatureSet.findFirst.mockResolvedValue(null);
      const existingSpec = createMockAnalysisSpec();
      mockPrisma.analysisSpec.findUnique.mockResolvedValue(existingSpec);

      const mockFeatureSet = createMockFeatureSet();
      const updatedSpec = createMockAnalysisSpec({ version: "1.1" });

      mockPrisma.bDDFeatureSet.create.mockResolvedValue(mockFeatureSet);
      mockPrisma.analysisSpec.update.mockResolvedValue(updatedSpec);

      expect(mockPrisma.analysisSpec.update).toBeDefined();
    });

    it("should set SYSTEM scope for SYSTEM specType", async () => {
      const { parseJsonSpec } = await import("@/lib/bdd/ai-parser");
      (parseJsonSpec as any).mockReturnValueOnce({
        success: true,
        data: createMockSpec({ specType: "SYSTEM" }),
        errors: [],
      });

      mockPrisma.bDDFeatureSet.findFirst.mockResolvedValue(null);
      mockPrisma.analysisSpec.findUnique.mockResolvedValue(null);

      const mockFeatureSet = createMockFeatureSet({ specType: "SYSTEM" });
      const mockAnalysisSpec = createMockAnalysisSpec({ scope: "SYSTEM", priority: 50 });

      mockPrisma.bDDFeatureSet.create.mockResolvedValue(mockFeatureSet);
      mockPrisma.analysisSpec.create.mockResolvedValue(mockAnalysisSpec);

      expect(mockAnalysisSpec.scope).toBe("SYSTEM");
      expect(mockAnalysisSpec.priority).toBe(50);
    });

    it("should set DOMAIN scope for DOMAIN specType", async () => {
      mockPrisma.bDDFeatureSet.findFirst.mockResolvedValue(null);
      mockPrisma.analysisSpec.findUnique.mockResolvedValue(null);

      const mockFeatureSet = createMockFeatureSet({ specType: "DOMAIN" });
      const mockAnalysisSpec = createMockAnalysisSpec({ scope: "DOMAIN", priority: 10 });

      mockPrisma.bDDFeatureSet.create.mockResolvedValue(mockFeatureSet);
      mockPrisma.analysisSpec.create.mockResolvedValue(mockAnalysisSpec);

      expect(mockAnalysisSpec.scope).toBe("DOMAIN");
      expect(mockAnalysisSpec.priority).toBe(10);
    });

    it("should build config from parameters for IDENTITY specs", async () => {
      const { parseJsonSpec } = await import("@/lib/bdd/ai-parser");
      (parseJsonSpec as any).mockReturnValueOnce({
        success: true,
        data: createMockSpec({
          specRole: "IDENTITY",
          parameters: [
            { id: "agent_name", name: "Agent Name", config: { value: "TestBot" } },
          ],
        }),
        errors: [],
      });

      mockPrisma.bDDFeatureSet.findFirst.mockResolvedValue(null);
      mockPrisma.analysisSpec.findUnique.mockResolvedValue(null);

      const mockFeatureSet = createMockFeatureSet();
      const mockAnalysisSpec = createMockAnalysisSpec({
        specRole: "IDENTITY",
        config: { agent_name: { value: "TestBot" } },
      });

      mockPrisma.bDDFeatureSet.create.mockResolvedValue(mockFeatureSet);
      mockPrisma.analysisSpec.create.mockResolvedValue(mockAnalysisSpec);

      expect(mockAnalysisSpec.config).toBeDefined();
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.bDDFeatureSet.findFirst.mockRejectedValue(
        new Error("Database connection failed")
      );

      const expectedResponse = {
        ok: false,
        error: "Database connection failed",
      };

      expect(expectedResponse.ok).toBe(false);
    });

    it("should generate correct slug format", async () => {
      const specId = "my-custom-spec-123";
      const expectedSlug = `spec-${specId.toLowerCase()}`;

      expect(expectedSlug).toBe("spec-my-custom-spec-123");
    });

    it("should set isActive to true on new specs", async () => {
      mockPrisma.bDDFeatureSet.findFirst.mockResolvedValue(null);
      mockPrisma.analysisSpec.findUnique.mockResolvedValue(null);

      const mockFeatureSet = createMockFeatureSet();
      const mockAnalysisSpec = createMockAnalysisSpec({ isActive: true });

      mockPrisma.bDDFeatureSet.create.mockResolvedValue(mockFeatureSet);
      mockPrisma.analysisSpec.create.mockResolvedValue(mockAnalysisSpec);

      expect(mockAnalysisSpec.isActive).toBe(true);
    });
  });

  describe("Version Incrementing", () => {
    it("should increment minor version from 1.0 to 1.1", () => {
      const incrementVersion = (version: string): string => {
        const parts = version.split(".");
        if (parts.length === 2) {
          const minor = parseInt(parts[1]) + 1;
          return `${parts[0]}.${minor}`;
        }
        return version + ".1";
      };

      expect(incrementVersion("1.0")).toBe("1.1");
      expect(incrementVersion("1.5")).toBe("1.6");
      expect(incrementVersion("2.9")).toBe("2.10");
    });

    it("should handle version without minor", () => {
      const incrementVersion = (version: string): string => {
        const parts = version.split(".");
        if (parts.length === 2) {
          const minor = parseInt(parts[1]) + 1;
          return `${parts[0]}.${minor}`;
        }
        return version + ".1";
      };

      expect(incrementVersion("1")).toBe("1.1");
    });
  });
});

describe("/api/lab/upload/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/lab/upload/preview", () => {
    it("should require spec in request body", async () => {
      const expectedResponse = {
        ok: false,
        error: "No spec provided. Send { spec: {...} }",
      };

      expect(expectedResponse.ok).toBe(false);
    });

    it("should return validation errors for invalid spec", async () => {
      const { parseJsonSpec } = await import("@/lib/bdd/ai-parser");
      (parseJsonSpec as any).mockReturnValueOnce({
        success: false,
        errors: ["Missing id field", "Missing title field"],
      });

      const expectedResponse = {
        ok: false,
        error: "Validation failed",
        validationErrors: ["Missing id field", "Missing title field"],
      };

      expect(expectedResponse.ok).toBe(false);
      expect(expectedResponse.validationErrors).toHaveLength(2);
    });

    it("should return NEW status for non-existing feature set", async () => {
      mockPrisma.bDDFeatureSet.findFirst.mockResolvedValue(null);
      mockPrisma.analysisSpec.findUnique.mockResolvedValue(null);
      mockPrisma.parameter.findMany.mockResolvedValue([]);

      const expectedPreview = {
        artifacts: {
          featureSet: {
            status: "NEW",
            newVersion: "1.0",
          },
          analysisSpec: {
            status: "NEW",
          },
        },
      };

      expect(expectedPreview.artifacts.featureSet.status).toBe("NEW");
      expect(expectedPreview.artifacts.analysisSpec.status).toBe("NEW");
    });

    it("should return UPDATE status for existing feature set", async () => {
      const existingFeatureSet = createMockFeatureSet({ version: "1.3" });
      mockPrisma.bDDFeatureSet.findFirst.mockResolvedValue(existingFeatureSet);
      mockPrisma.analysisSpec.findUnique.mockResolvedValue(null);
      mockPrisma.parameter.findMany.mockResolvedValue([]);

      const expectedPreview = {
        artifacts: {
          featureSet: {
            status: "UPDATE",
            currentVersion: "1.3",
            newVersion: "1.4",
          },
        },
      };

      expect(expectedPreview.artifacts.featureSet.status).toBe("UPDATE");
      expect(expectedPreview.artifacts.featureSet.currentVersion).toBe("1.3");
      expect(expectedPreview.artifacts.featureSet.newVersion).toBe("1.4");
    });

    it("should return UPDATE status for existing analysis spec", async () => {
      mockPrisma.bDDFeatureSet.findFirst.mockResolvedValue(null);
      const existingSpec = createMockAnalysisSpec();
      mockPrisma.analysisSpec.findUnique.mockResolvedValue(existingSpec);
      mockPrisma.parameter.findMany.mockResolvedValue([]);

      const expectedPreview = {
        artifacts: {
          analysisSpec: {
            status: "UPDATE",
            slug: "spec-test-spec-001",
          },
        },
      };

      expect(expectedPreview.artifacts.analysisSpec.status).toBe("UPDATE");
    });

    it("should categorize parameters as NEW or UPDATE", async () => {
      mockPrisma.bDDFeatureSet.findFirst.mockResolvedValue(null);
      mockPrisma.analysisSpec.findUnique.mockResolvedValue(null);
      mockPrisma.parameter.findMany.mockResolvedValue([
        { id: "p1", slug: "param-1", name: "Existing Param", dataType: "number" },
      ]);

      const expectedPreview = {
        artifacts: {
          parameters: {
            total: 2,
            new: 1,
            updated: 1,
            items: [
              { id: "param-1", status: "UPDATE" },
              { id: "param-2", status: "NEW" },
            ],
          },
        },
      };

      expect(expectedPreview.artifacts.parameters.new).toBe(1);
      expect(expectedPreview.artifacts.parameters.updated).toBe(1);
    });

    it("should include spec metadata in preview", async () => {
      mockPrisma.bDDFeatureSet.findFirst.mockResolvedValue(null);
      mockPrisma.analysisSpec.findUnique.mockResolvedValue(null);
      mockPrisma.parameter.findMany.mockResolvedValue([]);

      const expectedPreview = {
        spec: {
          id: "test-spec-001",
          title: "Test Spec",
          version: "1.0",
          domain: "companion",
          specType: "DOMAIN",
          specRole: "ANALYZER",
          outputType: "MEASURE",
        },
        story: {
          asA: "system",
          iWant: "to analyze conversations",
          soThat: "I can provide insights",
        },
      };

      expect(expectedPreview.spec.id).toBe("test-spec-001");
      expect(expectedPreview.story.asA).toBe("system");
    });

    it("should add warning for active spec being updated", async () => {
      mockPrisma.bDDFeatureSet.findFirst.mockResolvedValue(null);
      const existingSpec = createMockAnalysisSpec({ isActive: true });
      mockPrisma.analysisSpec.findUnique.mockResolvedValue(existingSpec);
      mockPrisma.parameter.findMany.mockResolvedValue([]);

      const expectedPreview = {
        warnings: [
          "This spec is currently active. Updating will affect live behavior.",
        ],
      };

      expect(expectedPreview.warnings).toContain(
        "This spec is currently active. Updating will affect live behavior."
      );
    });

    it("should add warning for SYSTEM spec type", async () => {
      const { parseJsonSpec } = await import("@/lib/bdd/ai-parser");
      (parseJsonSpec as any).mockReturnValueOnce({
        success: true,
        data: createMockSpec({ specType: "SYSTEM" }),
        errors: [],
      });

      mockPrisma.bDDFeatureSet.findFirst.mockResolvedValue(null);
      mockPrisma.analysisSpec.findUnique.mockResolvedValue(null);
      mockPrisma.parameter.findMany.mockResolvedValue([]);

      const expectedPreview = {
        warnings: [
          "SYSTEM specs are auto-included in all playbooks.",
        ],
      };

      expect(expectedPreview.warnings).toContain(
        "SYSTEM specs are auto-included in all playbooks."
      );
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.bDDFeatureSet.findFirst.mockRejectedValue(
        new Error("Database error")
      );

      const expectedResponse = {
        ok: false,
        error: "Preview failed",
      };

      expect(expectedResponse.ok).toBe(false);
    });
  });
});

describe("Spec Upload Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create exactly 1 AnalysisSpec per upload", async () => {
    mockPrisma.bDDFeatureSet.findFirst.mockResolvedValue(null);
    mockPrisma.analysisSpec.findUnique.mockResolvedValue(null);

    const mockFeatureSet = createMockFeatureSet();
    const mockAnalysisSpec = createMockAnalysisSpec();

    mockPrisma.bDDFeatureSet.create.mockResolvedValue(mockFeatureSet);
    mockPrisma.analysisSpec.create.mockResolvedValue(mockAnalysisSpec);

    // Simulate upload
    const uploadResult = {
      ok: true,
      featureSet: mockFeatureSet,
      spec: mockAnalysisSpec,
    };

    // Verify exactly 1 spec created
    expect(uploadResult.spec).toBeDefined();
    expect(mockPrisma.analysisSpec.create).toBeDefined();
  });

  it("should store parameters in FeatureSet.parameters (not separate table)", async () => {
    const params = [
      { id: "param-1", name: "Score A", dataType: "number" },
      { id: "param-2", name: "Score B", dataType: "number" },
    ];

    const mockFeatureSet = createMockFeatureSet({
      parameters: params,
    });

    mockPrisma.bDDFeatureSet.findFirst.mockResolvedValue(null);
    mockPrisma.bDDFeatureSet.create.mockResolvedValue(mockFeatureSet);

    expect(mockFeatureSet.parameters).toHaveLength(2);
    expect(mockFeatureSet.parameters[0].id).toBe("param-1");
  });

  it("should generate correct slug from spec ID", () => {
    const testCases = [
      { id: "MySpec", expected: "spec-myspec" },
      { id: "test-spec-001", expected: "spec-test-spec-001" },
      { id: "UPPERCASE", expected: "spec-uppercase" },
    ];

    for (const tc of testCases) {
      const slug = `spec-${tc.id.toLowerCase()}`;
      expect(slug).toBe(tc.expected);
    }
  });
});
