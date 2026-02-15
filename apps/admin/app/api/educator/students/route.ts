import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEducator, isEducatorAuthError } from "@/lib/educator-access";

/**
 * @api GET /api/educator/students
 * @visibility internal
 * @scope educator:read
 * @auth bearer
 * @tags educator, students
 * @description List all students across the educator's active classrooms, including classroom assignment, call counts, and last activity.
 * @response 200 { ok: true, students: [{ id, name, email, classroom, totalCalls, lastCallAt, joinedAt }] }
 */
export async function GET() {
  const auth = await requireEducator();
  if (isEducatorAuthError(auth)) return auth.error;

  const students = await prisma.caller.findMany({
    where: {
      cohortGroup: { ownerId: auth.callerId, isActive: true },
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
