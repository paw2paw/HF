/**
 * Tests for /api/prompt-templates endpoint
 *
 * This endpoint handles prompt template CRUD operations:
 * - GET: List all prompt templates (with optional inactive filter)
 * - POST: Create a new prompt template with validation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock must be hoisted, so we can't reference external variables
vi.mock("@/lib/prisma", () => ({
  prisma: {
    promptTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Import the mocked module to get the mock functions
import { prisma } from "@/lib/prisma";

// Import the route handlers after mocking
import { GET, POST } from "@/app/api/prompt-templates/route";

// Type-cast for easier mocking
const mockPrisma = prisma as unknown as {
  promptTemplate: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

describe("/api/prompt-templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("should return list of active templates by default", async () => {
      const mockTemplates = [
        {
          id: "template-1",
          slug: "friendly-support",
          name: "Friendly Support",
          description: "A friendly support template",
          systemPrompt: "You are a friendly support agent...",
          personalityModifiers: null,
          contextTemplate: null,
          isActive: true,
          version: "1.0",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-15"),
          _count: { playbookItems: 3 },
        },
        {
          id: "template-2",
          slug: "formal-business",
          name: "Formal Business",
          description: "A formal business template",
          systemPrompt: "You are a professional business assistant...",
          personalityModifiers: "Be concise and direct.",
          contextTemplate: "Company: {{company}}",
          isActive: true,
          version: "1.0",
          createdAt: new Date("2026-01-02"),
          updatedAt: new Date("2026-01-16"),
          _count: { playbookItems: 5 },
        },
      ];

      mockPrisma.promptTemplate.findMany.mockResolvedValue(mockTemplates);

      const request = new NextRequest("http://localhost:3000/api/prompt-templates");
      const response = await GET(request);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.templates).toHaveLength(2);
      expect(data.templates[0].slug).toBe("friendly-support");
      expect(data.templates[0].name).toBe("Friendly Support");
      expect(data.templates[0]._count.playbookItems).toBe(3);
      expect(data.templates[1].slug).toBe("formal-business");
      expect(data.count).toBe(2);
      expect(mockPrisma.promptTemplate.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
        include: {
          _count: {
            select: { playbookItems: true },
          },
        },
      });
    });

    it("should include inactive templates when includeInactive=true", async () => {
      const mockTemplates = [
        {
          id: "template-1",
          slug: "active-template",
          name: "Active Template",
          isActive: true,
          _count: { playbookItems: 2 },
        },
        {
          id: "template-2",
          slug: "inactive-template",
          name: "Inactive Template",
          isActive: false,
          _count: { playbookItems: 0 },
        },
      ];

      mockPrisma.promptTemplate.findMany.mockResolvedValue(mockTemplates);

      const request = new NextRequest(
        "http://localhost:3000/api/prompt-templates?includeInactive=true"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.count).toBe(2);
      expect(mockPrisma.promptTemplate.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
        include: {
          _count: {
            select: { playbookItems: true },
          },
        },
      });
    });

    it("should return empty list when no templates exist", async () => {
      mockPrisma.promptTemplate.findMany.mockResolvedValue([]);

      const request = new NextRequest("http://localhost:3000/api/prompt-templates");
      const response = await GET(request);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.templates).toEqual([]);
      expect(data.count).toBe(0);
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.promptTemplate.findMany.mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = new NextRequest("http://localhost:3000/api/prompt-templates");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.ok).toBe(false);
      expect(data.error).toBe("Database connection failed");
    });

    it("should include playbook items count for each template", async () => {
      const mockTemplates = [
        {
          id: "template-1",
          slug: "popular-template",
          name: "Popular Template",
          isActive: true,
          _count: { playbookItems: 10 },
        },
      ];

      mockPrisma.promptTemplate.findMany.mockResolvedValue(mockTemplates);

      const request = new NextRequest("http://localhost:3000/api/prompt-templates");
      const response = await GET(request);
      const data = await response.json();

      expect(data.templates[0]._count.playbookItems).toBe(10);
    });
  });

  describe("POST", () => {
    it("should create a new template with required fields", async () => {
      const newTemplateData = {
        slug: "new-template",
        name: "New Template",
        systemPrompt: "You are a helpful assistant...",
      };

      const createdTemplate = {
        id: "template-new",
        ...newTemplateData,
        description: null,
        personalityModifiers: null,
        contextTemplate: null,
        isActive: true,
        version: "1.0",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.promptTemplate.findUnique.mockResolvedValue(null);
      mockPrisma.promptTemplate.create.mockResolvedValue(createdTemplate);

      const request = new NextRequest("http://localhost:3000/api/prompt-templates", {
        method: "POST",
        body: JSON.stringify(newTemplateData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.template.id).toBe("template-new");
      expect(data.template.slug).toBe("new-template");
      expect(data.template.name).toBe("New Template");
      expect(data.template.systemPrompt).toBe("You are a helpful assistant...");
      expect(data.template.isActive).toBe(true);
      expect(data.template.version).toBe("1.0");
      expect(mockPrisma.promptTemplate.findUnique).toHaveBeenCalledWith({
        where: { slug: "new-template" },
      });
      expect(mockPrisma.promptTemplate.create).toHaveBeenCalledWith({
        data: {
          slug: "new-template",
          name: "New Template",
          description: null,
          systemPrompt: "You are a helpful assistant...",
          personalityModifiers: null,
          contextTemplate: null,
          isActive: true,
          version: "1.0",
        },
      });
    });

    it("should create a template with all optional fields", async () => {
      const fullTemplateData = {
        slug: "full-template",
        name: "Full Template",
        description: "A comprehensive template with all fields",
        systemPrompt: "You are a specialized assistant...",
        personalityModifiers: "Be empathetic and patient.",
        contextTemplate: "Customer: {{customer_name}}\nIssue: {{issue_type}}",
      };

      const createdTemplate = {
        id: "template-full",
        ...fullTemplateData,
        isActive: true,
        version: "1.0",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.promptTemplate.findUnique.mockResolvedValue(null);
      mockPrisma.promptTemplate.create.mockResolvedValue(createdTemplate);

      const request = new NextRequest("http://localhost:3000/api/prompt-templates", {
        method: "POST",
        body: JSON.stringify(fullTemplateData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.template.description).toBe("A comprehensive template with all fields");
      expect(data.template.personalityModifiers).toBe("Be empathetic and patient.");
      expect(data.template.contextTemplate).toContain("{{customer_name}}");
    });

    it("should reject duplicate slug with 409 conflict", async () => {
      const existingTemplate = {
        id: "existing-template",
        slug: "existing-slug",
        name: "Existing Template",
      };

      mockPrisma.promptTemplate.findUnique.mockResolvedValue(existingTemplate);

      const request = new NextRequest("http://localhost:3000/api/prompt-templates", {
        method: "POST",
        body: JSON.stringify({
          slug: "existing-slug",
          name: "New Template",
          systemPrompt: "Some prompt...",
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.ok).toBe(false);
      expect(data.error).toBe('Template with slug "existing-slug" already exists');
      expect(mockPrisma.promptTemplate.create).not.toHaveBeenCalled();
    });

    it("should return 400 when slug is missing", async () => {
      const request = new NextRequest("http://localhost:3000/api/prompt-templates", {
        method: "POST",
        body: JSON.stringify({
          name: "Template Without Slug",
          systemPrompt: "Some prompt...",
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toBe("slug, name, and systemPrompt are required");
    });

    it("should return 400 when name is missing", async () => {
      const request = new NextRequest("http://localhost:3000/api/prompt-templates", {
        method: "POST",
        body: JSON.stringify({
          slug: "template-without-name",
          systemPrompt: "Some prompt...",
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toBe("slug, name, and systemPrompt are required");
    });

    it("should return 400 when systemPrompt is missing", async () => {
      const request = new NextRequest("http://localhost:3000/api/prompt-templates", {
        method: "POST",
        body: JSON.stringify({
          slug: "template-without-prompt",
          name: "Template Without Prompt",
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toBe("slug, name, and systemPrompt are required");
    });

    it("should return 400 when all required fields are missing", async () => {
      const request = new NextRequest("http://localhost:3000/api/prompt-templates", {
        method: "POST",
        body: JSON.stringify({
          description: "Only optional fields provided",
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toBe("slug, name, and systemPrompt are required");
    });

    it("should handle database errors during creation", async () => {
      mockPrisma.promptTemplate.findUnique.mockResolvedValue(null);
      mockPrisma.promptTemplate.create.mockRejectedValue(
        new Error("Database write failed")
      );

      const request = new NextRequest("http://localhost:3000/api/prompt-templates", {
        method: "POST",
        body: JSON.stringify({
          slug: "error-template",
          name: "Error Template",
          systemPrompt: "Some prompt...",
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.ok).toBe(false);
      expect(data.error).toBe("Database write failed");
    });

    it("should set isActive to true by default", async () => {
      mockPrisma.promptTemplate.findUnique.mockResolvedValue(null);
      mockPrisma.promptTemplate.create.mockResolvedValue({
        id: "new-id",
        slug: "test",
        name: "Test",
        systemPrompt: "Prompt",
        isActive: true,
        version: "1.0",
      });

      const request = new NextRequest("http://localhost:3000/api/prompt-templates", {
        method: "POST",
        body: JSON.stringify({
          slug: "test",
          name: "Test",
          systemPrompt: "Prompt",
        }),
      });
      await POST(request);

      expect(mockPrisma.promptTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: true,
          }),
        })
      );
    });

    it("should set version to 1.0 by default", async () => {
      mockPrisma.promptTemplate.findUnique.mockResolvedValue(null);
      mockPrisma.promptTemplate.create.mockResolvedValue({
        id: "new-id",
        slug: "test",
        name: "Test",
        systemPrompt: "Prompt",
        isActive: true,
        version: "1.0",
      });

      const request = new NextRequest("http://localhost:3000/api/prompt-templates", {
        method: "POST",
        body: JSON.stringify({
          slug: "test",
          name: "Test",
          systemPrompt: "Prompt",
        }),
      });
      await POST(request);

      expect(mockPrisma.promptTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version: "1.0",
          }),
        })
      );
    });
  });
});
