import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireEducator,
  isEducatorAuthError,
  requireEducatorStudentAccess,
} from "@/lib/educator-access";

/**
 * @api GET /api/educator/students/[id]
 * @visibility internal
 * @scope educator:read
 * @auth bearer
 * @tags educator, students
 * @description Get detailed student view including recent call history (last 20), goals with progress, and personality profile parameter values. Requires educator access to the student's cohort.
 * @response 200 { ok: true, student: { id, name, email, classroom, domain, joinedAt }, calls: [...], goals: [...], profile: { parameterValues, lastUpdatedAt } | null }
 * @response 403 { ok: false, error: "Not authorized" }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEducator();
  if (isEducatorAuthError(auth)) return auth.error;

  const { id } = await params;
  const access = await requireEducatorStudentAccess(id, auth.callerId);
  if ("error" in access) return access.error;

  const { student } = access;

  // Get calls, goals, and profile data
  const [calls, goals, profile] = await Promise.all([
    prisma.call.findMany({
      where: { callerId: id },
      select: {
        id: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),

    prisma.goal.findMany({
      where: { callerId: id },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        progress: true,
      },
      orderBy: { createdAt: "desc" },
    }),

    prisma.callerPersonalityProfile.findUnique({
      where: { callerId: id },
      select: { parameterValues: true, lastUpdatedAt: true },
    }),
  ]);

  // Fetch cohort memberships for this student
  const cohortMemberships = await prisma.callerCohortMembership.findMany({
    where: { callerId: id },
    include: { cohortGroup: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    ok: true,
    student: {
      id: student.id,
      name: (student as any).name ?? "Unknown",
      email: (student as any).email,
      classroom: student.cohortGroup
        ? { id: student.cohortGroup.id, name: student.cohortGroup.name }
        : null,
      classrooms: cohortMemberships.map((m) => ({
        id: m.cohortGroup.id,
        name: m.cohortGroup.name,
      })),
      domain: student.domain,
      joinedAt: (student as any).createdAt,
    },
    calls: calls.map((c) => ({
      id: c.id,
      createdAt: c.createdAt,
    })),
    goals,
    profile: profile
      ? {
          parameterValues: profile.parameterValues,
          lastUpdatedAt: profile.lastUpdatedAt,
        }
      : null,
  });
}
