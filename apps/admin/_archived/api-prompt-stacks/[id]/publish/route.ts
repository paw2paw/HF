import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * POST /api/prompt-stacks/[id]/publish
 * Publish a draft stack (DRAFT → PUBLISHED)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.promptStack.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            block: true,
            slug: {
              include: { ranges: true },
            },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Prompt stack not found" },
        { status: 404 }
      );
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { ok: false, error: `Cannot publish stack in ${existing.status} status. Only DRAFT stacks can be published.` },
        { status: 400 }
      );
    }

    // Validation
    const errors: string[] = [];

    if (existing.items.length === 0) {
      errors.push("Stack has no items. Add at least one block or slug.");
    }

    // Check that all referenced blocks/slugs are active
    for (const item of existing.items) {
      if (item.itemType === "BLOCK" && item.block && !item.block.isActive) {
        errors.push(`Block '${item.block.name}' is inactive`);
      }
      if (item.itemType === "SLUG" && item.slug && !item.slug.isActive) {
        errors.push(`Slug '${item.slug.name}' is inactive`);
      }
      if (item.itemType === "SLUG" && item.slug && item.slug.ranges.length === 0 && !item.slug.fallbackPrompt) {
        errors.push(`Slug '${item.slug.name}' has no ranges and no fallback prompt`);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Validation failed",
          errors,
        },
        { status: 400 }
      );
    }

    // Publish
    const stack = await prisma.promptStack.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            block: {
              select: { id: true, slug: true, name: true, category: true },
            },
            slug: {
              select: { id: true, slug: true, name: true, sourceType: true },
            },
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Stack published successfully",
      stack,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to publish stack" },
      { status: 500 }
    );
  }
}
