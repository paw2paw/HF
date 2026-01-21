import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * GET /api/prompt-blocks
 * List all prompt blocks with optional filtering
 */
export async function GET(req: Request) {
  try {
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
 * POST /api/prompt-blocks
 * Create a new prompt block
 */
export async function POST(req: Request) {
  try {
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
