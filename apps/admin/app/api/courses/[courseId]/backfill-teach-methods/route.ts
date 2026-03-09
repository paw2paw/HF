import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { getSubjectsForPlaybook } from "@/lib/knowledge/domain-sources";
import {
  categoryToTeachMethod,
  type TeachingMode,
} from "@/lib/content-trust/resolve-config";
import {
  getTeachingProfile,
  resolveTeachingProfile,
} from "@/lib/content-trust/teaching-profiles";

/**
 * @api POST /api/courses/:courseId/backfill-teach-methods
 * @visibility internal
 * @scope courses:write
 * @auth OPERATOR
 * @tags courses, content-trust
 * @description Backfill teachMethod on ContentAssertions that have teachMethod=null.
 *   Uses the course's teachingMode (from playbook config) or falls back to each
 *   subject's teaching profile. Only updates assertions with null teachMethod.
 * @pathParam courseId string - Playbook UUID
 * @response 200 { ok, updated, total, teachingMode }
 * @response 404 { ok: false, error }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { courseId } = await params;

    const playbook = await prisma.playbook.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        config: true,
        domain: { select: { id: true } },
      },
    });

    if (!playbook) {
      return NextResponse.json(
        { ok: false, error: "Course not found" },
        { status: 404 },
      );
    }

    const domainId = playbook.domain?.id;
    if (!domainId) {
      return NextResponse.json({
        ok: true,
        updated: 0,
        total: 0,
        teachingMode: null,
      });
    }

    const pbConfig = (playbook.config as Record<string, any>) || {};
    const courseTeachingMode: TeachingMode | undefined = pbConfig.teachingMode || undefined;

    // Get course-scoped subjects + sources
    const { subjects, scoped } = await getSubjectsForPlaybook(courseId, domainId);
    if (!scoped || subjects.length === 0) {
      return NextResponse.json({
        ok: true,
        updated: 0,
        total: 0,
        teachingMode: courseTeachingMode || null,
      });
    }

    // For each subject, resolve its teachingMode and update its assertions
    let totalUpdated = 0;
    let totalCount = 0;

    for (const subject of subjects) {
      const sourceIds = subject.sources.map((s) => s.sourceId);
      if (sourceIds.length === 0) continue;

      // Resolve teachingMode: course-level > subject profile > fallback "recall"
      let subjectTeachingMode: TeachingMode = courseTeachingMode || "recall";
      if (!courseTeachingMode && subject.id) {
        const subjectRecord = await prisma.subject.findUnique({
          where: { id: subject.id },
          select: { teachingProfile: true, teachingOverrides: true },
        });
        if (subjectRecord?.teachingProfile) {
          const profile = getTeachingProfile(subjectRecord.teachingProfile);
          if (profile) {
            const overrides = subjectRecord.teachingOverrides as Record<string, any> | null;
            subjectTeachingMode = (overrides?.teachingMode || profile.teachingMode) as TeachingMode;
          }
        }
      }

      // Get assertions with null teachMethod for this subject's sources
      const nullAssertions = await prisma.contentAssertion.findMany({
        where: {
          sourceId: { in: sourceIds },
          teachMethod: null,
        },
        select: { id: true, category: true },
      });

      totalCount += nullAssertions.length;

      if (nullAssertions.length === 0) continue;

      // Batch update by category (group to minimize queries)
      const byCat = new Map<string, string[]>();
      for (const a of nullAssertions) {
        const cat = a.category || "fact";
        if (!byCat.has(cat)) byCat.set(cat, []);
        byCat.get(cat)!.push(a.id);
      }

      for (const [category, ids] of byCat) {
        const teachMethod = categoryToTeachMethod(category, subjectTeachingMode);
        const result = await prisma.contentAssertion.updateMany({
          where: { id: { in: ids } },
          data: { teachMethod },
        });
        totalUpdated += result.count;
      }
    }

    return NextResponse.json({
      ok: true,
      updated: totalUpdated,
      total: totalCount,
      teachingMode: courseTeachingMode || "per-subject",
    });
  } catch (error: unknown) {
    console.error("[courses/:id/backfill-teach-methods] POST error:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to backfill teach methods",
      },
      { status: 500 },
    );
  }
}
