import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * GET /api/prompt-stacks/[id]
 * Get a single prompt stack with all items
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const stack = await prisma.promptStack.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            block: {
              select: {
                id: true,
                slug: true,
                name: true,
                category: true,
                content: true,
                isActive: true,
              },
            },
            slug: {
              select: {
                id: true,
                slug: true,
                name: true,
                sourceType: true,
                mode: true,
                parameterId: true,
                parameter: {
                  select: {
                    parameterId: true,
                    name: true,
                  },
                },
                memoryCategory: true,
                fallbackPrompt: true,
                isActive: true,
                ranges: {
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
        },
        parentVersion: {
          select: {
            id: true,
            name: true,
            version: true,
          },
        },
        childVersions: {
          select: {
            id: true,
            name: true,
            version: true,
            status: true,
          },
        },
        _count: {
          select: { callers: true },
        },
      },
    });

    if (!stack) {
      return NextResponse.json(
        { ok: false, error: "Prompt stack not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      stack: {
        ...stack,
        callerCount: stack._count.callers,
        _count: undefined,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch prompt stack" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/prompt-stacks/[id]
 * Update a prompt stack and its items
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, description, status, isDefault, items } = body;

    const existing = await prisma.promptStack.findUnique({
      where: { id },
      include: {
        _count: { select: { callers: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Prompt stack not found" },
        { status: 404 }
      );
    }

    // Prevent modifying PUBLISHED stacks with callers (create new version instead)
    if (existing.status === "PUBLISHED" && existing._count.callers > 0 && items !== undefined) {
      return NextResponse.json(
        {
          ok: false,
          error: "Cannot modify items of a published stack with active callers. Create a new version instead.",
          hint: "Use POST /api/prompt-stacks/[id]/version to create a new draft version",
        },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults
    if (isDefault === true) {
      await prisma.promptStack.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    // Update in transaction
    const stack = await prisma.$transaction(async (tx) => {
      const updatedStack = await tx.promptStack.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(status && { status }),
          ...(isDefault !== undefined && { isDefault }),
          ...(status === "PUBLISHED" && !existing.publishedAt && { publishedAt: new Date() }),
        },
      });

      // If items are provided, replace all items
      if (items !== undefined) {
        // Delete existing items
        await tx.promptStackItem.deleteMany({
          where: { stackId: id },
        });

        // Create new items
        if (items.length > 0) {
          await tx.promptStackItem.createMany({
            data: items.map((item: any, index: number) => ({
              stackId: id,
              itemType: item.itemType,
              blockId: item.itemType === "BLOCK" ? item.blockId : null,
              slugId: item.itemType === "SLUG" ? item.slugId : null,
              callerMemoryCategories: item.itemType === "CALLER" ? item.callerMemoryCategories || [] : [],
              callerMemoryLimit: item.itemType === "CALLER" ? item.callerMemoryLimit : null,
              // AUTO_SLUGS configuration
              autoSlugSourceTypes: item.itemType === "AUTO_SLUGS" ? item.autoSlugSourceTypes || ["PARAMETER", "COMPOSITE"] : [],
              autoSlugOrderBy: item.itemType === "AUTO_SLUGS" ? item.autoSlugOrderBy || "priority" : null,
              autoSlugLimit: item.itemType === "AUTO_SLUGS" ? item.autoSlugLimit : null,
              autoSlugDomainFilter: item.itemType === "AUTO_SLUGS" ? item.autoSlugDomainFilter || [] : [],
              isEnabled: item.isEnabled ?? true,
              sortOrder: item.sortOrder ?? index,
            })),
          });
        }
      }

      return tx.promptStack.findUnique({
        where: { id },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
            include: {
              block: {
                select: {
                  id: true,
                  slug: true,
                  name: true,
                  category: true,
                },
              },
              slug: {
                select: {
                  id: true,
                  slug: true,
                  name: true,
                  sourceType: true,
                },
              },
            },
          },
        },
      });
    });

    return NextResponse.json({ ok: true, stack });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update prompt stack" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/prompt-stacks/[id]
 * Delete a prompt stack (only if no callers)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.promptStack.findUnique({
      where: { id },
      include: {
        _count: { select: { callers: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Prompt stack not found" },
        { status: 404 }
      );
    }

    if (existing._count.callers > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cannot delete stack with ${existing._count.callers} active caller(s). Archive instead.`,
        },
        { status: 400 }
      );
    }

    // Delete stack and items (cascade)
    await prisma.promptStack.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete prompt stack" },
      { status: 500 }
    );
  }
}
