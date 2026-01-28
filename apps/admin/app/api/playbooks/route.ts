import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/playbooks
 * List all playbooks with optional domain filter
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domainId = searchParams.get("domainId");
    const status = searchParams.get("status");

    const playbooks = await prisma.playbook.findMany({
      where: {
        ...(domainId && { domainId }),
        ...(status && { status: status as any }),
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
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
                scope: true,
                outputType: true,
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
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      playbooks,
      count: playbooks.length,
    });
  } catch (error: any) {
    console.error("Error fetching playbooks:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch playbooks" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/playbooks
 * Create a new playbook
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, domainId } = body;

    if (!name || !domainId) {
      return NextResponse.json(
        { ok: false, error: "name and domainId are required" },
        { status: 400 }
      );
    }

    // Verify domain exists
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      return NextResponse.json(
        { ok: false, error: "Domain not found" },
        { status: 404 }
      );
    }

    const playbook = await prisma.playbook.create({
      data: {
        name,
        description: description || null,
        domainId,
        status: "DRAFT",
        version: "1.0",
      },
      include: {
        domain: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      playbook,
    });
  } catch (error: any) {
    console.error("Error creating playbook:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create playbook" },
      { status: 500 }
    );
  }
}
