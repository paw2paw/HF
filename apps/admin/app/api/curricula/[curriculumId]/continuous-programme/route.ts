/**
 * @api GET /api/curricula/:curriculumId/continuous-programme
 * @visibility internal
 * @scope educator:read
 * @auth session (OPERATOR+)
 * @tags curriculum, continuous-learning
 * @description Returns the full module → LO → TP hierarchy for a continuous-mode course.
 *   Used by the ContinuousProgrammeView component on the course journey tab.
 * @response 200 { ok, modules[], instructions[] }
 * @response 404 { ok: false, error: "..." }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ curriculumId: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("OPERATOR");
  if (isAuthError(auth)) return auth.error;

  const { curriculumId } = await params;

  const curriculum = await prisma.curriculum.findUnique({
    where: { id: curriculumId },
    select: {
      id: true,
      deliveryConfig: true,
      subject: {
        select: {
          id: true,
          teachingProfile: true,
          sources: {
            where: { source: { extractorVersion: { not: null } } },
            select: {
              id: true,
              assertions: {
                select: {
                  id: true,
                  assertion: true,
                  category: true,
                  teachMethod: true,
                  learningOutcomeRef: true,
                  learningObjectiveId: true,
                  orderIndex: true,
                  depth: true,
                },
                orderBy: { orderIndex: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!curriculum) {
    return NextResponse.json({ ok: false, error: "Curriculum not found" }, { status: 404 });
  }

  // Load modules with LOs
  const dbModules = await prisma.curriculumModule.findMany({
    where: { curriculumId },
    include: {
      learningObjectives: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, ref: true, description: true, sortOrder: true },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  // Collect all assertions
  const allAssertions = curriculum.subject?.sources?.flatMap((s) => s.assertions) || [];

  // Build assertion lookup by learningObjectiveId
  const assertionsByLoId = new Map<string, typeof allAssertions>();
  const orphanAssertions: typeof allAssertions = [];
  for (const a of allAssertions) {
    if (a.learningObjectiveId) {
      const list = assertionsByLoId.get(a.learningObjectiveId) || [];
      list.push(a);
      assertionsByLoId.set(a.learningObjectiveId, list);
    } else {
      orphanAssertions.push(a);
    }
  }

  // Build response
  const modules = dbModules.map((mod) => {
    const los = mod.learningObjectives.map((lo) => {
      const loAssertions = assertionsByLoId.get(lo.id) || [];
      const teachMethods = [...new Set(loAssertions.map((a) => a.teachMethod).filter(Boolean))] as string[];

      return {
        id: lo.id,
        ref: lo.ref,
        description: lo.description,
        sortOrder: lo.sortOrder,
        assertions: loAssertions.map((a) => ({
          id: a.id,
          assertion: a.assertion,
          teachMethod: a.teachMethod,
          category: a.category,
        })),
        teachMethods,
      };
    });

    return {
      id: mod.id,
      slug: mod.slug,
      title: mod.title,
      description: mod.description,
      sortOrder: mod.sortOrder,
      learningObjectives: los,
      tpCount: los.reduce((sum, lo) => sum + lo.assertions.length, 0),
    };
  });

  // Extract teaching instructions from deliveryConfig or course-level metadata
  const dc = curriculum.deliveryConfig as Record<string, unknown> | null;
  const instructions: string[] = (dc?.teachingInstructions as string[]) || [];

  return NextResponse.json({
    ok: true,
    modules,
    instructions,
    totalLOs: modules.reduce((sum, m) => sum + m.learningObjectives.length, 0),
    totalTPs: modules.reduce((sum, m) => sum + m.tpCount, 0),
  });
}
