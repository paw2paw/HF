import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/playbooks/[playbookId]
 * Get playbook details with all items
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playbookId: string }> }
) {
  try {
    const { playbookId } = await params;

    const playbook = await prisma.playbook.findUnique({
      where: { id: playbookId },
      include: {
        domain: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            spec: {
              select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                scope: true,
                outputType: true,
                domain: true,
                priority: true,
                isActive: true,
                _count: {
                  select: { triggers: true },
                },
              },
            },
            promptTemplate: {
              select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                isActive: true,
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
        _count: {
          select: { items: true },
        },
      },
    });

    if (!playbook) {
      return NextResponse.json(
        { ok: false, error: "Playbook not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      playbook,
    });
  } catch (error: any) {
    console.error("Error fetching playbook:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch playbook" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/playbooks/[playbookId]
 * Update playbook metadata or items
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ playbookId: string }> }
) {
  try {
    const { playbookId } = await params;
    const body = await request.json();
    const { name, description, items } = body;

    const existing = await prisma.playbook.findUnique({
      where: { id: playbookId },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Playbook not found" },
        { status: 404 }
      );
    }

    if (existing.status === "PUBLISHED") {
      return NextResponse.json(
        { ok: false, error: "Cannot modify a published playbook. Create a new version instead." },
        { status: 400 }
      );
    }

    // Update metadata
    const playbook = await prisma.playbook.update({
      where: { id: playbookId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
      },
    });

    // Update items if provided
    if (items !== undefined) {
      // Delete existing items
      await prisma.playbookItem.deleteMany({
        where: { playbookId },
      });

      // Create new items
      if (items.length > 0) {
        await prisma.playbookItem.createMany({
          data: items.map((item: any, index: number) => ({
            playbookId,
            itemType: item.itemType,
            specId: item.specId || null,
            promptTemplateId: item.promptTemplateId || null,
            isEnabled: item.isEnabled !== false,
            sortOrder: index,
          })),
        });
      }
    }

    // Fetch updated playbook
    const updated = await prisma.playbook.findUnique({
      where: { id: playbookId },
      include: {
        domain: {
          select: { id: true, slug: true, name: true },
        },
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            spec: {
              select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                scope: true,
                outputType: true,
                _count: {
                  select: { triggers: true },
                },
              },
            },
            promptTemplate: {
              select: {
                id: true,
                slug: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      playbook: updated,
    });
  } catch (error: any) {
    console.error("Error updating playbook:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update playbook" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/playbooks/[playbookId]
 * Delete a draft playbook
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ playbookId: string }> }
) {
  try {
    const { playbookId } = await params;

    const existing = await prisma.playbook.findUnique({
      where: { id: playbookId },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Playbook not found" },
        { status: 404 }
      );
    }

    if (existing.status === "PUBLISHED") {
      return NextResponse.json(
        { ok: false, error: "Cannot delete a published playbook. Archive it instead." },
        { status: 400 }
      );
    }

    // Delete items first (cascade should handle this, but being explicit)
    await prisma.playbookItem.deleteMany({
      where: { playbookId },
    });

    await prisma.playbook.delete({
      where: { id: playbookId },
    });

    return NextResponse.json({
      ok: true,
      message: "Playbook deleted",
    });
  } catch (error: any) {
    console.error("Error deleting playbook:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete playbook" },
      { status: 500 }
    );
  }
}
