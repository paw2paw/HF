import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/prompt-templates
 * @visibility internal
 * @scope prompts:read
 * @auth session
 * @tags prompts
 * @description List all prompt templates with optional inactive inclusion
 * @query includeInactive string - Include inactive templates ("true")
 * @response 200 { ok: true, templates: PromptTemplate[], count: number }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const templates = await prisma.promptTemplate.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      include: {
        _count: {
          select: { playbookItems: true },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      templates,
      count: templates.length,
    });
  } catch (error: any) {
    console.error("Error fetching prompt templates:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch prompt templates" },
      { status: 500 }
    );
  }
}

/**
 * @api POST /api/prompt-templates
 * @visibility internal
 * @scope prompts:write
 * @auth session
 * @tags prompts
 * @description Create a new prompt template with system prompt and optional modifiers
 * @body slug string - Unique slug identifier (required)
 * @body name string - Display name (required)
 * @body description string - Template description
 * @body systemPrompt string - System prompt content (required)
 * @body personalityModifiers string - Personality modifier template
 * @body contextTemplate string - Context template
 * @response 200 { ok: true, template: PromptTemplate }
 * @response 400 { ok: false, error: "slug, name, and systemPrompt are required" }
 * @response 409 { ok: false, error: "Template with slug \"...\" already exists" }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const body = await request.json();
    const { slug, name, description, systemPrompt, personalityModifiers, contextTemplate } = body;

    if (!slug || !name || !systemPrompt) {
      return NextResponse.json(
        { ok: false, error: "slug, name, and systemPrompt are required" },
        { status: 400 }
      );
    }

    // Check for duplicate slug
    const existing = await prisma.promptTemplate.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: `Template with slug "${slug}" already exists` },
        { status: 409 }
      );
    }

    const template = await prisma.promptTemplate.create({
      data: {
        slug,
        name,
        description: description || null,
        systemPrompt,
        personalityModifiers: personalityModifiers || null,
        contextTemplate: contextTemplate || null,
        isActive: true,
        version: "1.0",
      },
    });

    return NextResponse.json({
      ok: true,
      template,
    });
  } catch (error: any) {
    console.error("Error creating prompt template:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create prompt template" },
      { status: 500 }
    );
  }
}
