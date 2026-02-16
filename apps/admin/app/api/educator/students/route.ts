import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { requireEducator, isEducatorAuthError } from "@/lib/educator-access";

/**
 * @api GET /api/educator/students
 * @visibility internal
 * @scope educator:read
 * @auth bearer
 * @tags educator, students
 * @query institutionId - Optional institution ID for ADMIN+ users to view all students in an institution
 * @description List all students across the educator's active classrooms, including classroom assignment, call counts, and last activity. ADMIN+ users can pass ?institutionId= to view all students in an institution.
 * @response 200 { ok: true, students: [{ id, name, email, classroom, totalCalls, lastCallAt, joinedAt }] }
 */
export async function GET(request: NextRequest) {
  const institutionId = request.nextUrl.searchParams.get("institutionId");

  let cohortFilter: Record<string, unknown>;

  if (institutionId) {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;
    cohortFilter = { institutionId, isActive: true };
  } else {
    const auth = await requireEducator();
    if (isEducatorAuthError(auth)) return auth.error;
    cohortFilter = { ownerId: auth.callerId, isActive: true };
  }

  const students = await prisma.caller.findMany({
    where: {
      cohortGroup: cohortFilter,
      role: "LEARNER",
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      cohortGroup: { select: { id: true, name: true } },
      _count: { select: { calls: true } },
      calls: {
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    ok: true,
    students: students.map((s) => ({
      id: s.id,
      name: s.name ?? "Unknown",
      email: s.email,
      classroom: s.cohortGroup
        ? { id: s.cohortGroup.id, name: s.cohortGroup.name }
        : null,
      totalCalls: s._count.calls,
      lastCallAt: s.calls[0]?.createdAt ?? null,
      joinedAt: s.createdAt,
    })),
  });
}
