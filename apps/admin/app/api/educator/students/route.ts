import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { requireEducator, isEducatorAuthError } from "@/lib/educator-access";

const studentSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  cohortMemberships: {
    include: { cohortGroup: { select: { id: true, name: true } } },
  },
  _count: { select: { calls: true } },
  calls: {
    select: { createdAt: true },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
};

function formatStudents(students: Awaited<ReturnType<typeof prisma.caller.findMany<{ select: typeof studentSelect }>>>) {
  return students.map((s) => {
    const primaryMembership = s.cohortMemberships?.[0];
    return {
      id: s.id,
      name: s.name ?? "Unknown",
      email: s.email,
      classroom: primaryMembership?.cohortGroup
        ? { id: primaryMembership.cohortGroup.id, name: primaryMembership.cohortGroup.name }
        : null,
      classrooms: (s.cohortMemberships ?? []).map((m) => ({
        id: m.cohortGroup.id,
        name: m.cohortGroup.name,
      })),
      totalCalls: s._count.calls,
      lastCallAt: s.calls[0]?.createdAt ?? null,
      joinedAt: s.createdAt,
    };
  });
}

/**
 * @api GET /api/educator/students
 * @visibility internal
 * @scope educator:read
 * @auth bearer
 * @tags educator, students
 * @query institutionId - Optional institution ID for ADMIN+ users to view all students in an institution
 * @description List students. ADMIN+ users see all learners (optionally scoped by institutionId). Educators see learners in their owned classrooms only.
 * @response 200 { ok: true, students: [{ id, name, email, classroom, totalCalls, lastCallAt, joinedAt }] }
 */
export async function GET(request: NextRequest) {
  const institutionId = request.nextUrl.searchParams.get("institutionId");

  // ADMIN+ path — see all learners (optionally scoped to institution)
  const adminAuth = await requireAuth("ADMIN");
  if (!isAuthError(adminAuth)) {
    const where: Record<string, unknown> = { role: "LEARNER" };

    if (institutionId) {
      // Learners in this institution's cohorts + unassigned learners in domains linked to this institution
      where.OR = [
        { cohortMemberships: { some: { cohortGroup: { institutionId, isActive: true } } } },
        {
          cohortMemberships: { none: {} },
          domain: { cohortGroups: { some: { institutionId } } },
        },
      ];
    }

    const students = await prisma.caller.findMany({
      where,
      select: studentSelect,
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ ok: true, students: formatStudents(students) });
  }

  // Educator path — see learners in owned cohorts only
  const auth = await requireEducator();
  if (isEducatorAuthError(auth)) return auth.error;

  const students = await prisma.caller.findMany({
    where: {
      cohortMemberships: { some: { cohortGroup: { ownerId: auth.callerId, isActive: true } } },
      role: "LEARNER",
    },
    select: studentSelect,
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ ok: true, students: formatStudents(students) });
}
