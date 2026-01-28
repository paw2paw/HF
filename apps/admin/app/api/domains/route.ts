import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/domains
 * List all domains with caller counts and playbook info
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const domains = await prisma.domain.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: {
        _count: {
          select: {
            callers: true,
            playbooks: true,
          },
        },
        playbooks: {
          where: { status: "PUBLISHED" },
          take: 1,
          select: {
            id: true,
            name: true,
            version: true,
            publishedAt: true,
          },
        },
      },
    });

    // Transform to include published playbook info
    const domainsWithInfo = domains.map((domain) => ({
      ...domain,
      callerCount: domain._count.callers,
      playbookCount: domain._count.playbooks,
      publishedPlaybook: domain.playbooks[0] || null,
      _count: undefined,
      playbooks: undefined,
    }));

    return NextResponse.json({
      ok: true,
      domains: domainsWithInfo,
      count: domains.length,
    });
  } catch (error: any) {
    console.error("Error fetching domains:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch domains" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/domains
 * Create a new domain
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, name, description, isDefault } = body;

    if (!slug || !name) {
      return NextResponse.json(
        { ok: false, error: "slug and name are required" },
        { status: 400 }
      );
    }

    // Check for duplicate slug
    const existing = await prisma.domain.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: `Domain with slug "${slug}" already exists` },
        { status: 409 }
      );
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.domain.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const domain = await prisma.domain.create({
      data: {
        slug,
        name,
        description: description || null,
        isDefault: isDefault || false,
        isActive: true,
      },
    });

    return NextResponse.json({
      ok: true,
      domain,
    });
  } catch (error: any) {
    console.error("Error creating domain:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create domain" },
      { status: 500 }
    );
  }
}
