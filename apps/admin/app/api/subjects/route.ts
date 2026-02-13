import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * GET /api/subjects
 * List all subjects with source/domain/assertion counts
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("activeOnly") !== "false";
    const domainId = searchParams.get("domainId");

    const where: any = {};
    if (activeOnly) where.isActive = true;
    if (domainId) where.domains = { some: { domainId } };

    const subjects = await prisma.subject.findMany({
      where,
      include: {
        _count: {
          select: {
            sources: true,
            domains: true,
            curricula: true,
          },
        },
        domains: {
          include: { domain: { select: { id: true, name: true, slug: true } } },
        },
      },
      orderBy: [{ name: "asc" }],
    });

    return NextResponse.json({ subjects });
  } catch (error: any) {
    console.error("[subjects] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/subjects
 * Create a new subject
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

    const body = await req.json();
    const {
      slug,
      name,
      description,
      defaultTrustLevel,
      qualificationBody,
      qualificationRef,
      qualificationLevel,
    } = body;

    if (!slug || !name) {
      return NextResponse.json(
        { error: "slug and name are required" },
        { status: 400 }
      );
    }

    const subject = await prisma.subject.create({
      data: {
        slug,
        name,
        description,
        defaultTrustLevel: defaultTrustLevel || "UNVERIFIED",
        qualificationBody,
        qualificationRef,
        qualificationLevel,
      },
    });

    return NextResponse.json({ subject }, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A subject with this slug already exists" },
        { status: 409 }
      );
    }
    console.error("[subjects] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
