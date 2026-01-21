import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * GET /api/prompt-blocks/[id]
 * Get a single prompt block by ID or slug
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const block = await prisma.promptBlock.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        stackItems: {
          include: {
            stack: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!block) {
      return NextResponse.json(
        { ok: false, error: "Prompt block not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      block: {
        ...block,
        usedInStacks: block.stackItems.map((si) => si.stack),
        stackItems: undefined,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch prompt block" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/prompt-blocks/[id]
 * Update a prompt block
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, description, category, content, isActive } = body;

    const existing = await prisma.promptBlock.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Prompt block not found" },
        { status: 404 }
      );
    }

    const block = await prisma.promptBlock.update({
      where: { id: existing.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(category && { category }),
        ...(content && { content }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ ok: true, block });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update prompt block" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/prompt-blocks/[id]
 * Delete a prompt block (only if not used in any stacks)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.promptBlock.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        _count: { select: { stackItems: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Prompt block not found" },
        { status: 404 }
      );
    }

    if (existing._count.stackItems > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cannot delete block used in ${existing._count.stackItems} stack(s). Remove from stacks first or deactivate instead.`,
        },
        { status: 400 }
      );
    }

    await prisma.promptBlock.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete prompt block" },
      { status: 500 }
    );
  }
}
