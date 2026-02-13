import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { extractCurriculumFromAssertions } from "@/lib/content-trust/extract-curriculum";
import { requireAuth, isAuthError } from "@/lib/permissions";

type Params = { params: Promise<{ subjectId: string }> };

/**
 * GET /api/subjects/:subjectId/curriculum
 * Get the curriculum for this subject (most recent)
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { subjectId } = await params;

    const curriculum = await prisma.curriculum.findFirst({
      where: { subjectId },
      orderBy: { updatedAt: "desc" },
    });

    if (!curriculum) {
      return NextResponse.json({ curriculum: null });
    }

    return NextResponse.json({ curriculum });
  } catch (error: any) {
    console.error("[subjects/:id/curriculum] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/subjects/:subjectId/curriculum
 * Generate curriculum from the syllabus source's assertions using AI
 * Body: { mode: "generate" | "save" }
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { subjectId } = await params;
    const body = await req.json();
    const mode = body.mode || "generate";

    // Get subject
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });
    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    // Find ALL sources tagged "syllabus" (for curriculum structure)
    const syllabusSources = await prisma.subjectSource.findMany({
      where: { subjectId, tags: { has: "syllabus" } },
      select: { sourceId: true },
    });

    // If no syllabus-tagged sources, fall back to all sources
    const sourceIds = syllabusSources.length > 0
      ? syllabusSources.map((s) => s.sourceId)
      : (
          await prisma.subjectSource.findMany({
            where: { subjectId },
            select: { sourceId: true },
          })
        ).map((s) => s.sourceId);

    if (sourceIds.length === 0) {
      return NextResponse.json(
        { error: "No sources attached to this subject. Upload documents first." },
        { status: 400 }
      );
    }

    // Load assertions from the relevant sources
    const assertions = await prisma.contentAssertion.findMany({
      where: { sourceId: { in: sourceIds } },
      select: {
        assertion: true,
        category: true,
        chapter: true,
        section: true,
        tags: true,
      },
      orderBy: [{ chapter: "asc" }, { section: "asc" }, { createdAt: "asc" }],
    });

    if (assertions.length === 0) {
      return NextResponse.json(
        { error: "No assertions found. Import documents and extract assertions first." },
        { status: 400 }
      );
    }

    // Generate curriculum using AI
    const result = await extractCurriculumFromAssertions(
      assertions,
      subject.name,
      subject.qualificationRef || undefined,
    );

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, warnings: result.warnings },
        { status: 422 }
      );
    }

    // Generate mode — return without saving
    if (mode === "generate") {
      return NextResponse.json({
        ok: true,
        mode: "generate",
        curriculum: result,
      });
    }

    // Save mode — upsert curriculum record
    const slug = `${subject.slug}-curriculum`;
    const primarySourceId = syllabusSources[0]?.sourceId || sourceIds[0];

    const curriculum = await prisma.curriculum.upsert({
      where: { slug },
      create: {
        slug,
        name: result.name,
        description: result.description,
        subjectId,
        primarySourceId,
        trustLevel: subject.defaultTrustLevel,
        qualificationBody: subject.qualificationBody,
        qualificationNumber: subject.qualificationRef,
        qualificationLevel: subject.qualificationLevel,
        notableInfo: { modules: result.modules } as unknown as Prisma.InputJsonValue,
        coreArgument: Prisma.JsonNull,
        deliveryConfig: result.deliveryConfig as unknown as Prisma.InputJsonValue,
        version: "1.0",
      },
      update: {
        name: result.name,
        description: result.description,
        primarySourceId,
        trustLevel: subject.defaultTrustLevel,
        notableInfo: { modules: result.modules } as unknown as Prisma.InputJsonValue,
        deliveryConfig: result.deliveryConfig as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      mode: "save",
      curriculum,
    });
  } catch (error: any) {
    console.error("[subjects/:id/curriculum] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/subjects/:subjectId/curriculum
 * Update curriculum (user edits to modules, delivery config, etc.)
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { subjectId } = await params;
    const body = await req.json();

    const curriculum = await prisma.curriculum.findFirst({
      where: { subjectId },
      orderBy: { updatedAt: "desc" },
    });

    if (!curriculum) {
      return NextResponse.json({ error: "No curriculum found for this subject" }, { status: 404 });
    }

    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.modules !== undefined) data.notableInfo = { modules: body.modules };
    if (body.deliveryConfig !== undefined) data.deliveryConfig = body.deliveryConfig;

    const updated = await prisma.curriculum.update({
      where: { id: curriculum.id },
      data,
    });

    return NextResponse.json({ curriculum: updated });
  } catch (error: any) {
    console.error("[subjects/:id/curriculum] PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
