import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * POST /api/prompt-stacks/[id]/version
 * Create a new draft version from an existing stack
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { name } = body;

    const existing = await prisma.promptStack.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
        },
        childVersions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Prompt stack not found" },
        { status: 404 }
      );
    }

    // Calculate new version number
    const currentVersion = parseFloat(existing.version) || 1.0;
    const latestChildVersion = existing.childVersions[0]
      ? parseFloat(existing.childVersions[0].version) || currentVersion
      : currentVersion;
    const newVersion = (Math.max(currentVersion, latestChildVersion) + 0.1).toFixed(1);

    // Create new draft version with copied items
    const newStack = await prisma.$transaction(async (tx) => {
      const createdStack = await tx.promptStack.create({
        data: {
          name: name || `${existing.name} v${newVersion}`,
          description: existing.description,
          status: "DRAFT",
          isDefault: false,
          version: newVersion,
          parentVersionId: existing.id,
        },
      });

      // Copy items
      if (existing.items.length > 0) {
        await tx.promptStackItem.createMany({
          data: existing.items.map((item) => ({
            stackId: createdStack.id,
            itemType: item.itemType,
            blockId: item.blockId,
            slugId: item.slugId,
            callerMemoryCategories: item.callerMemoryCategories,
            callerMemoryLimit: item.callerMemoryLimit,
            isEnabled: item.isEnabled,
            sortOrder: item.sortOrder,
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
                select: { id: true, slug: true, name: true, category: true },
              },
              slug: {
                select: { id: true, slug: true, name: true, sourceType: true },
              },
            },
          },
          parentVersion: {
            select: { id: true, name: true, version: true },
          },
        },
      });
    });

    return NextResponse.json({
      ok: true,
      message: `Created new draft version ${newVersion}`,
      stack: newStack,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create new version" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/prompt-stacks/[id]/version
 * Get version history for a stack
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const stack = await prisma.promptStack.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        version: true,
        status: true,
        parentVersionId: true,
      },
    });

    if (!stack) {
      return NextResponse.json(
        { ok: false, error: "Prompt stack not found" },
        { status: 404 }
      );
    }

    // Find the root of the version chain
    let rootId = stack.id;
    let current = stack;
    while (current.parentVersionId) {
      const parent = await prisma.promptStack.findUnique({
        where: { id: current.parentVersionId },
        select: {
          id: true,
          name: true,
          version: true,
          status: true,
          parentVersionId: true,
        },
      });
      if (!parent) break;
      rootId = parent.id;
      current = parent;
    }

    // Get all versions in the chain
    const getAllVersions = async (stackId: string): Promise<any[]> => {
      const s = await prisma.promptStack.findUnique({
        where: { id: stackId },
        select: {
          id: true,
          name: true,
          version: true,
          status: true,
          createdAt: true,
          publishedAt: true,
          _count: { select: { callers: true } },
          childVersions: {
            select: { id: true },
          },
        },
      });
      if (!s) return [];

      const children = await Promise.all(
        s.childVersions.map((c) => getAllVersions(c.id))
      );

      return [
        {
          id: s.id,
          name: s.name,
          version: s.version,
          status: s.status,
          createdAt: s.createdAt,
          publishedAt: s.publishedAt,
          callerCount: s._count.callers,
          isCurrent: s.id === id,
        },
        ...children.flat(),
      ];
    };

    const versions = await getAllVersions(rootId);

    return NextResponse.json({
      ok: true,
      currentStackId: id,
      versions: versions.sort((a, b) => parseFloat(b.version) - parseFloat(a.version)),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to get version history" },
      { status: 500 }
    );
  }
}
