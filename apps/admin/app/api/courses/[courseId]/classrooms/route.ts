import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * @api GET /api/courses/[courseId]/classrooms
 * @auth OPERATOR
 * @description List all classrooms (cohort groups) assigned to a course (playbook).
 * @response 200 { ok: true, classrooms: Classroom[] }
 * @response 404 { ok: false, error: "Course not found" }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await requireAuth("OPERATOR");
  if (isAuthError(auth)) return auth.error;

  const { courseId } = await params;

  const playbook = await prisma.playbook.findUnique({
    where: { id: courseId },
    select: { id: true },
  });

  if (!playbook) {
    return NextResponse.json({ ok: false, error: "Course not found" }, { status: 404 });
  }

  const assignments = await prisma.cohortPlaybook.findMany({
    where: { playbookId: courseId },
    orderBy: { createdAt: "desc" },
    select: {
      cohortGroup: {
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          maxMembers: true,
          createdAt: true,
          domain: { select: { id: true, name: true } },
          _count: { select: { members: true } },
        },
      },
    },
  });

  const classrooms = assignments.map(({ cohortGroup: c }) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    isActive: c.isActive,
    memberCount: c._count.members,
    maxMembers: c.maxMembers,
    domainId: c.domain.id,
    domainName: c.domain.name,
    createdAt: c.createdAt.toISOString(),
  }));

  return NextResponse.json({ ok: true, classrooms });
}
