import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
import { requireAuth, isAuthError } from "@/lib/permissions";

export const runtime = "nodejs";

/**
 * @api GET /api/prompt-blocks
 * @visibility internal
 * @scope prompts:read
 * @auth session
 * @tags prompts
 * @description List all prompt blocks with optional category and active status filtering
 * @query category string - Filter by block category
 * @query isActive string - Filter by active status ("true" or "false")
 * @response 200 { ok: true, blocks: PromptBlock[], categories: [...] }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const isActive = searchParams.get("isActive");

    const where: any = {};
    if (category) where.category = category;
    if (isActive !== null) where.isActive = isActive === "true";

    const blocks = await prisma.promptBlock.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: { stackItems: true },
        },
      },
    });

    // Get distinct categories for filter UI
    const categories = await prisma.promptBlock.groupBy({
      by: ["category"],
      _count: true,
    });

    return NextResponse.json({
      ok: true,
      blocks: blocks.map((b) => ({
        ...b,
        usageCount: b._count.stackItems,
        _count: undefined,
      })),
      categories: categories.map((c) => ({
        category: c.category,
        count: c._count,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch prompt blocks" },
      { status: 500 }
    );
  }
}

/**
 * @api POST /api/prompt-blocks
 * @visibility internal
 * @scope prompts:write
 * @auth session
 * @tags prompts
 * @description Create a new prompt block with slug, name, category, and content
 * @body slug string - Unique slug identifier (required)
 * @body name string - Display name (required)
 * @body description string - Block description
 * @body category string - Block category (required)
 * @body content string - Block content text (required)
 * @body isActive boolean - Active status (default true)
 * @response 201 { ok: true, block: PromptBlock }
 * @response 400 { ok: false, error: "Missing required fields: slug, name, category, content" }
 * @response 409 { ok: false, error: "Block with slug '...' already exists" }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const body = await req.json();
    const { slug, name, description, category, content, isActive = true } = body;

    if (!slug || !name || !category || !content) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: slug, name, category, content" },
        { status: 400 }
      );
    }

    // Check for duplicate slug
    const existing = await prisma.promptBlock.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: `Block with slug '${slug}' already exists` },
        { status: 409 }
      );
    }

    const block = await prisma.promptBlock.create({
      data: {
        slug,
        name,
        description,
        category,
        content,
        isActive,
      },
    });

    return NextResponse.json({ ok: true, block }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create prompt block" },
      { status: 500 }
    );
  }
}
