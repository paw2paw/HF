import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

type Params = { params: Promise<{ subjectId: string }> };

/**
 * GET /api/subjects/:subjectId/sources
 * List sources attached to this subject
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { subjectId } = await params;

    const sources = await prisma.subjectSource.findMany({
      where: { subjectId },
      include: {
        source: {
          include: { _count: { select: { assertions: true } } },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ sources });
  } catch (error: any) {
    console.error("[subjects/:id/sources] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/subjects/:subjectId/sources
 * Attach an existing source or create a new one and attach it
 * Body: { sourceId } to attach existing, or { slug, name, trustLevel?, role? } to create+attach
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { subjectId } = await params;
    const body = await req.json();

    // Verify subject exists
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    let sourceId = body.sourceId;
    let source;

    if (!sourceId && body.slug && body.name) {
      // Create new ContentSource and attach
      source = await prisma.contentSource.create({
        data: {
          slug: body.slug,
          name: body.name,
          description: body.description,
          trustLevel: body.trustLevel || subject.defaultTrustLevel,
        },
      });
      sourceId = source.id;
    } else if (!sourceId) {
      return NextResponse.json(
        { error: "Provide sourceId to attach existing, or slug+name to create new" },
        { status: 400 }
      );
    }

    const subjectSource = await prisma.subjectSource.create({
      data: {
        subjectId,
        sourceId,
        tags: body.tags || ["content"],
        trustLevelOverride: body.trustLevelOverride || null,
        sortOrder: body.sortOrder || 0,
      },
      include: {
        source: {
          include: { _count: { select: { assertions: true } } },
        },
      },
    });

    return NextResponse.json({ subjectSource, source }, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "This source is already attached to this subject" },
        { status: 409 }
      );
    }
    console.error("[subjects/:id/sources] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/subjects/:subjectId/sources
 * Detach a source from this subject (does not delete the ContentSource itself)
 * Body: { sourceId }
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { subjectId } = await params;
    const body = await req.json();

    if (!body.sourceId) {
      return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
    }

    await prisma.subjectSource.delete({
      where: {
        subjectId_sourceId: {
          subjectId,
          sourceId: body.sourceId,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[subjects/:id/sources] DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
