import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * GET /api/content-sources
 * List all content sources with optional filtering
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { searchParams } = new URL(req.url);
    const trustLevel = searchParams.get("trustLevel");
    const qualificationRef = searchParams.get("qualificationRef");
    const activeOnly = searchParams.get("activeOnly") !== "false";

    const where: any = {};
    if (trustLevel) where.trustLevel = trustLevel;
    if (qualificationRef) where.qualificationRef = { contains: qualificationRef, mode: "insensitive" };
    if (activeOnly) where.isActive = true;

    const sources = await prisma.contentSource.findMany({
      where,
      include: {
        _count: { select: { assertions: true } },
        subjects: {
          include: {
            subject: {
              select: {
                id: true,
                name: true,
                slug: true,
                domains: {
                  include: {
                    domain: { select: { id: true, name: true, slug: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ trustLevel: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ sources });
  } catch (error: any) {
    console.error("[content-sources] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/content-sources
 * Create a new content source
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const body = await req.json();
    const {
      slug,
      name,
      description,
      trustLevel,
      publisherOrg,
      accreditingBody,
      accreditationRef,
      authors,
      isbn,
      doi,
      edition,
      publicationYear,
      validFrom,
      validUntil,
      qualificationRef,
      moduleCoverage,
    } = body;

    if (!slug || !name) {
      return NextResponse.json(
        { error: "slug and name are required" },
        { status: 400 }
      );
    }

    const source = await prisma.contentSource.create({
      data: {
        slug,
        name,
        description,
        trustLevel: trustLevel || "UNVERIFIED",
        publisherOrg,
        accreditingBody,
        accreditationRef,
        authors: authors || [],
        isbn,
        doi,
        edition,
        publicationYear,
        validFrom: validFrom ? new Date(validFrom) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
        qualificationRef,
        moduleCoverage: moduleCoverage || [],
      },
    });

    return NextResponse.json({ source }, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A content source with this slug already exists" },
        { status: 409 }
      );
    }
    console.error("[content-sources] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
