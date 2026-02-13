import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/playbooks
 * @visibility public
 * @scope playbooks:read
 * @auth session
 * @tags playbooks
 * @description List all playbooks with optional domain and status filters
 * @query domainId string - Filter playbooks by domain ID
 * @query status string - Filter playbooks by status (DRAFT, PUBLISHED, ARCHIVED)
 * @response 200 { ok: true, playbooks: Playbook[], count: number }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

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
                domain: true,
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
 * @api POST /api/playbooks
 * @visibility public
 * @scope playbooks:write
 * @auth session
 * @tags playbooks
 * @description Create a new playbook in DRAFT status
 * @body name string - Playbook name (required)
 * @body description string - Playbook description
 * @body domainId string - Domain ID to associate (required)
 * @response 200 { ok: true, playbook: Playbook }
 * @response 400 { ok: false, error: "name and domainId are required" }
 * @response 404 { ok: false, error: "Domain not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

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
