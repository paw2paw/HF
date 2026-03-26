import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/courses/:courseId/course-reference
 * @visibility public
 * @scope courses:read
 * @description Returns the most recent COURSE_REFERENCE markdown document
 *   for a course. Used by the Reference tab on the course detail page.
 *   Returns the full textSample (rendered markdown) and creation metadata.
 *
 * @pathParam courseId string - Playbook UUID
 * @response 200 { ok, reference: { id, name, markdown, createdAt } | null }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const user = await requireAuth("VIEWER");
    if (isAuthError(user)) return user;

    const { courseId } = await params;

    // Find all COURSE_REFERENCE sources linked to this course's subjects
    const playbookSubjects = await prisma.playbookSubject.findMany({
      where: { playbookId: courseId },
      select: {
        subject: {
          select: {
            sources: {
              select: {
                source: {
                  select: {
                    id: true,
                    name: true,
                    documentType: true,
                    textSample: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Collect COURSE_REFERENCE sources, pick most recent
    const refSources = playbookSubjects
      .flatMap((ps) => ps.subject.sources)
      .filter((ss) => ss.source.documentType === "COURSE_REFERENCE")
      .map((ss) => ss.source)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const latest = refSources[0] ?? null;

    return NextResponse.json({
      ok: true,
      reference: latest
        ? {
            id: latest.id,
            name: latest.name,
            markdown: latest.textSample,
            createdAt: latest.createdAt,
          }
        : null,
    });
  } catch (err) {
    console.error("[course-reference] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to load course reference" },
      { status: 500 },
    );
  }
}
