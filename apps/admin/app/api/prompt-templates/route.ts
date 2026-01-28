import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/prompt-templates
 * List all prompt templates
 */
export async function GET(request: NextRequest) {
  try {
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
 * POST /api/prompt-templates
 * Create a new prompt template
 */
export async function POST(request: NextRequest) {
  try {
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
