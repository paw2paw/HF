/**
 * @api GET /api/curricula/:curriculumId/modules/:moduleId
 * @scope curricula:read
 * @auth session (VIEWER+)
 * @desc Single module detail with learning objectives and assertion count
 *
 * @api PATCH /api/curricula/:curriculumId/modules/:moduleId
 * @scope curricula:write
 * @auth session (OPERATOR+)
 * @desc Update module fields. When learningObjectives[] is provided, full-replaces LOs in transaction.
 *
 * @api DELETE /api/curricula/:curriculumId/modules/:moduleId
 * @scope curricula:write
 * @auth session (OPERATOR+)
 * @desc Delete module (cascades LOs via FK)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ curriculumId: string; moduleId: string }> };

// ---------------------------------------------------------------------------
// GET — single module detail
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { curriculumId, moduleId } = await params;

    const mod = await prisma.curriculumModule.findFirst({
      where: { id: moduleId, curriculumId },
      include: {
        learningObjectives: {
          orderBy: { sortOrder: "asc" },
          include: {
            _count: { select: { assertions: true } },
          },
        },
        _count: { select: { callerProgress: true, calls: true } },
      },
    });

    if (!mod) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, module: mod });
  } catch (error: any) {
    console.error("[curricula/:id/modules/:id] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — update module (including LOs via full-replace)
// ---------------------------------------------------------------------------

interface LOInput {
  ref: string;
  description: string;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { curriculumId, moduleId } = await params;
    const body = await req.json();

    // Verify module belongs to this curriculum
    const existing = await prisma.curriculumModule.findFirst({
      where: { id: moduleId, curriculumId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    // Build update data from provided fields only
    const updateData: Record<string, any> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    if (body.estimatedDurationMinutes !== undefined) updateData.estimatedDurationMinutes = body.estimatedDurationMinutes;
    if (body.masteryThreshold !== undefined) updateData.masteryThreshold = body.masteryThreshold;
    if (body.prerequisites !== undefined) updateData.prerequisites = body.prerequisites;
    if (body.keyTerms !== undefined) updateData.keyTerms = body.keyTerms;
    if (body.assessmentCriteria !== undefined) updateData.assessmentCriteria = body.assessmentCriteria;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const learningObjectives: LOInput[] | undefined = body.learningObjectives;

    // Transaction: update module + full-replace LOs if provided
    const updated = await prisma.$transaction(async (tx) => {
      const mod = await tx.curriculumModule.update({
        where: { id: moduleId },
        data: updateData,
      });

      if (learningObjectives !== undefined) {
        // Full-replace: delete all existing, re-create from array
        await tx.learningObjective.deleteMany({ where: { moduleId } });

        for (let i = 0; i < learningObjectives.length; i++) {
          const lo = learningObjectives[i];
          await tx.learningObjective.create({
            data: {
              moduleId,
              ref: lo.ref,
              description: lo.description,
              sortOrder: i,
            },
          });
        }
      }

      return mod;
    });

    // Re-fetch with includes for response
    const result = await prisma.curriculumModule.findUnique({
      where: { id: updated.id },
      include: {
        learningObjectives: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json({ ok: true, module: result });
  } catch (error: any) {
    console.error("[curricula/:id/modules/:id] PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — remove module (LOs cascade via FK)
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { curriculumId, moduleId } = await params;

    // Verify module belongs to this curriculum
    const existing = await prisma.curriculumModule.findFirst({
      where: { id: moduleId, curriculumId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    await prisma.curriculumModule.delete({ where: { id: moduleId } });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[curricula/:id/modules/:id] DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
