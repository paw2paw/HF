/**
 * Tests for /api/data-dictionary/xrefs endpoint
 *
 * This endpoint finds cross-references for template variables and key prefixes.
 * It searches across:
 * - AnalysisSpec.promptTemplate
 * - AnalysisAction.description
 * - AnalysisTrigger.given/when/then
 * - PromptTemplate.systemPrompt/contextTemplate
 * - PromptSlug.memorySummaryTemplate/ranges
 *
 * And returns related playbooks that use the matching specs.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Must define mock before vi.mock call for hoisting
vi.mock("@/lib/prisma", () => ({
  prisma: {
    analysisSpec: {
      findMany: vi.fn(),
    },
    analysisAction: {
      findMany: vi.fn(),
    },
    analysisTrigger: {
      findMany: vi.fn(),
    },
    promptTemplate: {
      findMany: vi.fn(),
    },
    promptSlug: {
      findMany: vi.fn(),
    },
    playbookItem: {
      findMany: vi.fn(),
    },
    callerMemory: {
      count: vi.fn(),
    },
  },
}));

// Import the route handler and prisma after mocking
import { GET } from "@/app/api/data-dictionary/xrefs/route";
import { prisma } from "@/lib/prisma";

// Cast prisma to mocked type for test access - use type assertion for proper mock method access
const mockPrisma = prisma as unknown as {
  analysisSpec: { findMany: ReturnType<typeof vi.fn> };
  analysisAction: { findMany: ReturnType<typeof vi.fn> };
  analysisTrigger: { findMany: ReturnType<typeof vi.fn> };
  promptTemplate: { findMany: ReturnType<typeof vi.fn> };
  promptSlug: { findMany: ReturnType<typeof vi.fn> };
  playbookItem: { findMany: ReturnType<typeof vi.fn> };
  callerMemory: { count: ReturnType<typeof vi.fn> };
};

describe("/api/data-dictionary/xrefs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET with type=variable", () => {
    it("should search for Mustache variables in AnalysisSpec.promptTemplate", async () => {
      const mockSpecs = [
        {
          id: "spec-1",
          name: "Fact Extractor",
          slug: "fact-extractor",
          outputType: "SINGLE",
        },
      ];

      mockPrisma.analysisSpec.findMany.mockResolvedValue(mockSpecs);
      mockPrisma.analysisAction.findMany.mockResolvedValue([]);
      mockPrisma.analysisTrigger.findMany.mockResolvedValue([]);
      mockPrisma.promptTemplate.findMany.mockResolvedValue([]);
      mockPrisma.promptSlug.findMany.mockResolvedValue([]);
      mockPrisma.playbookItem.findMany.mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/data-dictionary/xrefs?type=variable&pattern={{memories.facts}}"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.type).toBe("variable");
      expect(data.pattern).toBe("{{memories.facts}}");
      expect(data.xrefs.analysisSpecs).toHaveLength(1);
      expect(data.xrefs.analysisSpecs[0].field).toBe("promptTemplate");

      // Verify prisma was called with pattern stripped of {{ }}
      expect(mockPrisma.analysisSpec.findMany).toHaveBeenCalledWith({
        where: {
          promptTemplate: {
            contains: "memories.facts",
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          outputType: true,
        },
      });
    });

    it("should find matches in PromptTemplate.systemPrompt", async () => {
      const mockTemplates = [
        {
          id: "template-1",
          name: "Main Agent Prompt",
          slug: "main-agent",
        },
      ];

      mockPrisma.analysisSpec.findMany.mockResolvedValue([]);
      mockPrisma.analysisAction.findMany.mockResolvedValue([]);
      mockPrisma.analysisTrigger.findMany.mockResolvedValue([]);
      mockPrisma.promptTemplate.findMany
        .mockResolvedValueOnce(mockTemplates) // systemPrompt search
        .mockResolvedValueOnce([]); // contextTemplate search
      mockPrisma.promptSlug.findMany.mockResolvedValue([]);
      mockPrisma.playbookItem.findMany.mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/data-dictionary/xrefs?type=variable&pattern={{caller.name}}"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.xrefs.promptTemplates).toHaveLength(1);
      expect(data.xrefs.promptTemplates[0].field).toBe("systemPrompt");
      expect(data.xrefs.promptTemplates[0].name).toBe("Main Agent Prompt");
    });

    it("should find matches in PromptTemplate.contextTemplate and combine fields", async () => {
      const mockTemplate = {
        id: "template-1",
        name: "Agent Prompt",
        slug: "agent-prompt",
      };

      mockPrisma.analysisSpec.findMany.mockResolvedValue([]);
      mockPrisma.analysisAction.findMany.mockResolvedValue([]);
      mockPrisma.analysisTrigger.findMany.mockResolvedValue([]);
      // Same template found in both systemPrompt and contextTemplate
      mockPrisma.promptTemplate.findMany
        .mockResolvedValueOnce([mockTemplate]) // systemPrompt search
        .mockResolvedValueOnce([mockTemplate]); // contextTemplate search
      mockPrisma.promptSlug.findMany.mockResolvedValue([]);
      mockPrisma.playbookItem.findMany.mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/data-dictionary/xrefs?type=variable&pattern={{personality.openness}}"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.xrefs.promptTemplates).toHaveLength(1);
      expect(data.xrefs.promptTemplates[0].field).toBe(
        "systemPrompt, contextTemplate"
      );
    });

    it("should find matches in PromptSlug memorySummaryTemplate", async () => {
      const mockSlug = {
        id: "slug-1",
        slug: "memory-summary",
        name: "Memory Summary Prompt",
      };

      mockPrisma.analysisSpec.findMany.mockResolvedValue([]);
      mockPrisma.analysisAction.findMany.mockResolvedValue([]);
      mockPrisma.analysisTrigger.findMany.mockResolvedValue([]);
      mockPrisma.promptTemplate.findMany.mockResolvedValue([]);
      mockPrisma.promptSlug.findMany
        .mockResolvedValueOnce([mockSlug]) // memorySummaryTemplate search
        .mockResolvedValueOnce([]); // ranges search
      mockPrisma.playbookItem.findMany.mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/data-dictionary/xrefs?type=variable&pattern={{memories.preferences}}"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.xrefs.promptSlugs).toHaveLength(1);
      expect(data.xrefs.promptSlugs[0].field).toBe("summaryTemplate");
    });

    it("should find matches in PromptSlug ranges and combine fields", async () => {
      const mockSlug = {
        id: "slug-1",
        slug: "behavior-prompt",
        name: "Behavior Prompt",
      };

      mockPrisma.analysisSpec.findMany.mockResolvedValue([]);
      mockPrisma.analysisAction.findMany.mockResolvedValue([]);
      mockPrisma.analysisTrigger.findMany.mockResolvedValue([]);
      mockPrisma.promptTemplate.findMany.mockResolvedValue([]);
      // Same slug found in both summary and ranges
      mockPrisma.promptSlug.findMany
        .mockResolvedValueOnce([mockSlug]) // memorySummaryTemplate search
        .mockResolvedValueOnce([mockSlug]); // ranges search
      mockPrisma.playbookItem.findMany.mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/data-dictionary/xrefs?type=variable&pattern={{target.value}}"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.xrefs.promptSlugs).toHaveLength(1);
      expect(data.xrefs.promptSlugs[0].field).toBe("summaryTemplate, ranges");
    });

    it("should find matches in AnalysisAction descriptions", async () => {
      const mockActions = [
        {
          id: "action-1",
          description: "Extract caller name from transcript",
          trigger: {
            spec: {
              id: "spec-1",
              name: "Name Extractor",
              slug: "name-extractor",
              outputType: "SINGLE",
            },
          },
        },
      ];

      mockPrisma.analysisSpec.findMany.mockResolvedValue([]);
      mockPrisma.analysisAction.findMany.mockResolvedValue(mockActions);
      mockPrisma.analysisTrigger.findMany.mockResolvedValue([]);
      mockPrisma.promptTemplate.findMany.mockResolvedValue([]);
      mockPrisma.promptSlug.findMany.mockResolvedValue([]);
      mockPrisma.playbookItem.findMany.mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/data-dictionary/xrefs?type=variable&pattern={{caller.name}}"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.xrefs.analysisSpecs).toHaveLength(1);
      expect(data.xrefs.analysisSpecs[0].field).toBe("action description");
    });

    it("should find matches in AnalysisTrigger given/when/then fields", async () => {
      const mockTriggers = [
        {
          id: "trigger-1",
          spec: {
            id: "spec-1",
            name: "Behavior Detector",
            slug: "behavior-detector",
            outputType: "BOOLEAN",
          },
        },
      ];

      mockPrisma.analysisSpec.findMany.mockResolvedValue([]);
      mockPrisma.analysisAction.findMany.mockResolvedValue([]);
      mockPrisma.analysisTrigger.findMany.mockResolvedValue(mockTriggers);
      mockPrisma.promptTemplate.findMany.mockResolvedValue([]);
      mockPrisma.promptSlug.findMany.mockResolvedValue([]);
      mockPrisma.playbookItem.findMany.mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/data-dictionary/xrefs?type=variable&pattern={{transcript}}"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.xrefs.analysisSpecs).toHaveLength(1);
      expect(data.xrefs.analysisSpecs[0].field).toBe("trigger");
    });

    it("should return related playbooks for matching specs", async () => {
      const mockSpecs = [
        {
          id: "spec-1",
          name: "Fact Extractor",
          slug: "fact-extractor",
          outputType: "SINGLE",
        },
      ];

      const mockPlaybookItems = [
        {
          playbook: {
            id: "playbook-1",
            name: "Memory Extraction Playbook",
            status: "ACTIVE",
            domain: { name: "companion" },
          },
        },
        {
          playbook: {
            id: "playbook-2",
            name: "Learning Playbook",
            status: "DRAFT",
            domain: null,
          },
        },
      ];

      mockPrisma.analysisSpec.findMany.mockResolvedValue(mockSpecs);
      mockPrisma.analysisAction.findMany.mockResolvedValue([]);
      mockPrisma.analysisTrigger.findMany.mockResolvedValue([]);
      mockPrisma.promptTemplate.findMany.mockResolvedValue([]);
      mockPrisma.promptSlug.findMany.mockResolvedValue([]);
      mockPrisma.playbookItem.findMany.mockResolvedValue(mockPlaybookItems);

      const request = new NextRequest(
        "http://localhost:3000/api/data-dictionary/xrefs?type=variable&pattern={{memories.facts}}"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.xrefs.playbooks).toHaveLength(2);
      expect(data.xrefs.playbooks[0].name).toBe("Memory Extraction Playbook");
      expect(data.xrefs.playbooks[0].domain).toBe("companion");
      expect(data.xrefs.playbooks[1].name).toBe("Learning Playbook");
      expect(data.xrefs.playbooks[1].domain).toBeNull();

      // Verify playbook query was called with correct spec IDs
      expect(mockPrisma.playbookItem.findMany).toHaveBeenCalledWith({
        where: {
          specId: { in: ["spec-1"] },
          itemType: "SPEC",
        },
        select: {
          playbook: {
            select: {
              id: true,
              name: true,
              status: true,
              domain: {
                select: { name: true },
              },
            },
          },
        },
      });
    });

    it("should dedupe playbooks when multiple specs reference the same playbook", async () => {
      const mockSpecs = [
        { id: "spec-1", name: "Spec 1", slug: "spec-1", outputType: "SINGLE" },
        { id: "spec-2", name: "Spec 2", slug: "spec-2", outputType: "SINGLE" },
      ];

      const mockPlaybookItems = [
        {
          playbook: {
            id: "playbook-1",
            name: "Shared Playbook",
            status: "ACTIVE",
            domain: { name: "companion" },
          },
        },
        {
          // Same playbook from different spec
          playbook: {
            id: "playbook-1",
            name: "Shared Playbook",
            status: "ACTIVE",
            domain: { name: "companion" },
          },
        },
      ];

      mockPrisma.analysisSpec.findMany.mockResolvedValue(mockSpecs);
      mockPrisma.analysisAction.findMany.mockResolvedValue([]);
      mockPrisma.analysisTrigger.findMany.mockResolvedValue([]);
      mockPrisma.promptTemplate.findMany.mockResolvedValue([]);
      mockPrisma.promptSlug.findMany.mockResolvedValue([]);
      mockPrisma.playbookItem.findMany.mockResolvedValue(mockPlaybookItems);

      const request = new NextRequest(
        "http://localhost:3000/api/data-dictionary/xrefs?type=variable&pattern={{common_var}}"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.ok).toBe(true);
      // Should be deduped to 1 playbook
      expect(data.xrefs.playbooks).toHaveLength(1);
      expect(data.xrefs.playbooks[0].id).toBe("playbook-1");
    });
  });

  describe("GET with type=prefix", () => {
    it("should search for key prefixes in AnalysisAction.learnKeyPrefix", async () => {
      const mockActions = [
        {
          id: "action-1",
          learnKeyPrefix: "location_",
          trigger: {
            spec: {
              id: "spec-1",
              name: "Location Extractor",
              slug: "location-extractor",
              outputType: "SINGLE",
            },
          },
        },
      ];

      mockPrisma.analysisAction.findMany.mockResolvedValue(mockActions);
      mockPrisma.callerMemory.count.mockResolvedValue(15);
      mockPrisma.playbookItem.findMany.mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/data-dictionary/xrefs?type=prefix&pattern=location_"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.type).toBe("prefix");
      expect(data.pattern).toBe("location_");
      expect(data.xrefs.analysisSpecs).toHaveLength(1);
      expect(data.xrefs.analysisSpecs[0].name).toBe("Location Extractor");
      expect(data.xrefs.analysisSpecs[0].field).toBe(
        "learnKeyPrefix: location_"
      );

      // Verify startsWith query for prefix
      expect(mockPrisma.analysisAction.findMany).toHaveBeenCalledWith({
        where: {
          learnKeyPrefix: {
            startsWith: "location_",
          },
        },
        select: {
          id: true,
          learnKeyPrefix: true,
          trigger: {
            select: {
              spec: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  outputType: true,
                },
              },
            },
          },
        },
      });
    });

    it("should not duplicate specs when multiple actions share the same spec", async () => {
      const sharedSpec = {
        id: "spec-1",
        name: "Multi-Action Spec",
        slug: "multi-action",
        outputType: "SINGLE",
      };

      const mockActions = [
        {
          id: "action-1",
          learnKeyPrefix: "preference_food",
          trigger: { spec: sharedSpec },
        },
        {
          id: "action-2",
          learnKeyPrefix: "preference_drink",
          trigger: { spec: sharedSpec },
        },
      ];

      mockPrisma.analysisAction.findMany.mockResolvedValue(mockActions);
      mockPrisma.callerMemory.count.mockResolvedValue(5);
      mockPrisma.playbookItem.findMany.mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/data-dictionary/xrefs?type=prefix&pattern=preference_"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.ok).toBe(true);
      // Should be deduped to 1 spec
      expect(data.xrefs.analysisSpecs).toHaveLength(1);
      expect(data.xrefs.analysisSpecs[0].id).toBe("spec-1");
    });
  });

  describe("Missing params fallback to dictionary listing", () => {
    it("should return dictionary listing when type is missing", async () => {
      mockPrisma.callerMemory.count.mockResolvedValue(0);
      const request = new NextRequest(
        "http://localhost:3000/api/data-dictionary/xrefs?pattern={{memories.facts}}"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.xrefs).toBeDefined();
    });

    it("should return dictionary listing when pattern is missing", async () => {
      mockPrisma.callerMemory.count.mockResolvedValue(0);
      const request = new NextRequest(
        "http://localhost:3000/api/data-dictionary/xrefs?type=variable"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.xrefs).toBeDefined();
    });

    it("should return dictionary listing when both type and pattern are missing", async () => {
      mockPrisma.callerMemory.count.mockResolvedValue(0);
      const request = new NextRequest(
        "http://localhost:3000/api/data-dictionary/xrefs"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.xrefs).toBeDefined();
    });
  });

  describe("Response structure", () => {
    it("should include counts in response", async () => {
      mockPrisma.analysisSpec.findMany.mockResolvedValue([
        { id: "spec-1", name: "Spec 1", slug: "spec-1", outputType: "SINGLE" },
        { id: "spec-2", name: "Spec 2", slug: "spec-2", outputType: "SINGLE" },
      ]);
      mockPrisma.analysisAction.findMany.mockResolvedValue([]);
      mockPrisma.analysisTrigger.findMany.mockResolvedValue([]);
      mockPrisma.promptTemplate.findMany.mockResolvedValue([
        { id: "template-1", name: "Template 1", slug: "template-1" },
      ]);
      mockPrisma.promptSlug.findMany.mockResolvedValue([]);
      mockPrisma.playbookItem.findMany.mockResolvedValue([
        {
          playbook: {
            id: "playbook-1",
            name: "Playbook 1",
            status: "ACTIVE",
            domain: null,
          },
        },
      ]);

      const request = new NextRequest(
        "http://localhost:3000/api/data-dictionary/xrefs?type=variable&pattern={{test}}"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.counts).toEqual({
        analysisSpecs: 2,
        promptTemplates: 1,
        promptSlugs: 0,
        playbooks: 1,
      });
    });

    it("should return empty arrays when no matches found", async () => {
      mockPrisma.analysisSpec.findMany.mockResolvedValue([]);
      mockPrisma.analysisAction.findMany.mockResolvedValue([]);
      mockPrisma.analysisTrigger.findMany.mockResolvedValue([]);
      mockPrisma.promptTemplate.findMany.mockResolvedValue([]);
      mockPrisma.promptSlug.findMany.mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/data-dictionary/xrefs?type=variable&pattern={{nonexistent}}"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.xrefs.analysisSpecs).toEqual([]);
      expect(data.xrefs.promptTemplates).toEqual([]);
      expect(data.xrefs.promptSlugs).toEqual([]);
      expect(data.xrefs.playbooks).toEqual([]);
      expect(data.counts).toEqual({
        analysisSpecs: 0,
        promptTemplates: 0,
        promptSlugs: 0,
        playbooks: 0,
      });
    });
  });

  describe("Error handling", () => {
    it("should handle database errors gracefully", async () => {
      mockPrisma.analysisSpec.findMany.mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = new NextRequest(
        "http://localhost:3000/api/data-dictionary/xrefs?type=variable&pattern={{test}}"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.ok).toBe(false);
      expect(data.error).toBe("Database connection failed");
    });

    it("should handle unknown errors gracefully", async () => {
      mockPrisma.analysisSpec.findMany.mockRejectedValue({});

      const request = new NextRequest(
        "http://localhost:3000/api/data-dictionary/xrefs?type=variable&pattern={{test}}"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.ok).toBe(false);
      expect(data.error).toBe("Failed to fetch cross-references");
    });
  });
});
