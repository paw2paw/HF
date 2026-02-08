import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/domains/[domainId]
 * Get domain details with callers and playbooks
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> }
) {
  try {
    const { domainId } = await params;

    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      include: {
        callers: {
          take: 50,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            externalId: true,
            createdAt: true,
            _count: {
              select: { calls: true },
            },
          },
        },
        playbooks: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            version: true,
            sortOrder: true,
            publishedAt: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: { items: true },
            },
          },
        },
        _count: {
          select: {
            callers: true,
            playbooks: true,
          },
        },
      },
    });

    if (!domain) {
      return NextResponse.json(
        { ok: false, error: "Domain not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      domain,
    });
  } catch (error: any) {
    console.error("Error fetching domain:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch domain" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/domains/[domainId]
 * Update a domain
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> }
) {
  try {
    const { domainId } = await params;
    const body = await request.json();
    const { name, description, isDefault, isActive } = body;

    const existing = await prisma.domain.findUnique({
      where: { id: domainId },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Domain not found" },
        { status: 404 }
      );
    }

    // If setting as default, unset other defaults
    if (isDefault && !existing.isDefault) {
      await prisma.domain.updateMany({
        where: { isDefault: true, id: { not: domainId } },
        data: { isDefault: false },
      });
    }

    const domain = await prisma.domain.update({
      where: { id: domainId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({
      ok: true,
      domain,
    });
  } catch (error: any) {
    console.error("Error updating domain:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update domain" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/domains/[domainId]
 * Delete a domain (soft delete by setting isActive = false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> }
) {
  try {
    const { domainId } = await params;

    const existing = await prisma.domain.findUnique({
      where: { id: domainId },
      include: {
        _count: {
          select: { callers: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Domain not found" },
        { status: 404 }
      );
    }

    if (existing.isDefault) {
      return NextResponse.json(
        { ok: false, error: "Cannot delete the default domain" },
        { status: 400 }
      );
    }

    if (existing._count.callers > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cannot delete domain with ${existing._count.callers} callers assigned. Reassign callers first.`,
        },
        { status: 400 }
      );
    }

    // Soft delete
    await prisma.domain.update({
      where: { id: domainId },
      data: { isActive: false },
    });

    return NextResponse.json({
      ok: true,
      message: "Domain deactivated",
    });
  } catch (error: any) {
    console.error("Error deleting domain:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete domain" },
      { status: 500 }
    );
  }
}
