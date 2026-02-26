import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * @api GET /api/courses/[courseId]/students
 * @auth OPERATOR
 * @description List all students (callers) enrolled in a course (playbook).
 * @response 200 { ok: true, students: Student[] }
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

  const enrollments = await prisma.callerPlaybook.findMany({
    where: { playbookId: courseId, status: "ACTIVE" },
    orderBy: { enrolledAt: "desc" },
    select: {
      enrolledAt: true,
      status: true,
      caller: {
        select: {
          id: true,
          name: true,
          phone: true,
          createdAt: true,
          _count: { select: { calls: true } },
        },
      },
    },
  });

  const students = enrollments.map(({ caller: c, enrolledAt, status }) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    callCount: c._count.calls,
    enrolledAt: enrolledAt.toISOString(),
    status,
    createdAt: c.createdAt.toISOString(),
  }));

  return NextResponse.json({ ok: true, students });
}
