import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * GET /api/prompt-stacks
 * List all prompt stacks with optional filtering
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const isDefault = searchParams.get("isDefault");

    const where: any = {};
    if (status) where.status = status;
    if (isDefault !== null) where.isDefault = isDefault === "true";

    const stacks = await prisma.promptStack.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { status: "asc" }, { name: "asc" }],
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
        _count: {
          select: { callers: true },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      stacks: stacks.map((s) => ({
        ...s,
        callerCount: s._count.callers,
        itemCount: s.items.length,
        _count: undefined,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch prompt stacks" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/prompt-stacks
 * Create a new prompt stack with items
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      description,
      status = "DRAFT",
      isDefault = false,
      items = [],
    } = body;

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Missing required field: name" },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.promptStack.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    // Create stack with items in a transaction
    const stack = await prisma.$transaction(async (tx) => {
      const createdStack = await tx.promptStack.create({
        data: {
          name,
          description,
          status,
          isDefault,
        },
      });

      // Create items if provided
      if (items.length > 0) {
        await tx.promptStackItem.createMany({
          data: items.map((item: any, index: number) => ({
            stackId: createdStack.id,
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

      return tx.promptStack.findUnique({
        where: { id: createdStack.id },
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

    return NextResponse.json({ ok: true, stack }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create prompt stack" },
      { status: 500 }
    );
  }
}
