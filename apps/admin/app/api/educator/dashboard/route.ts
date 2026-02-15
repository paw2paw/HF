import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEducator, isEducatorAuthError } from "@/lib/educator-access";

/**
 * @api GET /api/educator/dashboard
 * @visibility internal
 * @scope educator:read
 * @auth bearer
 * @tags educator, dashboard
 * @description Educator dashboard overview with classroom list, aggregate stats (total students, active this week), recent calls, and students needing attention (no calls in 7+ days).
 * @response 200 { ok: true, classrooms: [...], stats: { classroomCount, totalStudents, activeThisWeek }, recentCalls: [...], needsAttention: [...] }
 */
export async function GET() {
  const auth = await requireEducator();
  if (isEducatorAuthError(auth)) return auth.error;

  const { callerId } = auth;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [classrooms, totalStudents, activeStudents, recentCalls, needsAttention] =
    await Promise.all([
      // Classrooms owned by this educator
      prisma.cohortGroup.findMany({
        where: { ownerId: callerId, isActive: true },
        include: {
          domain: { select: { id: true, name: true, slug: true } },
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: "desc" },
      }),

      // Total students across all owned cohorts
      prisma.caller.count({
        where: {
          cohortGroup: { ownerId: callerId, isActive: true },
          role: "LEARNER",
        },
      }),

      // Students active in the last 7 days (have calls created recently)
      prisma.caller.count({
        where: {
          cohortGroup: { ownerId: callerId, isActive: true },
          role: "LEARNER",
          calls: { some: { createdAt: { gte: sevenDaysAgo } } },
        },
      }),

      // Recent calls across all cohort students (last 10)
      prisma.call.findMany({
        where: {
          caller: {
            cohortGroup: { ownerId: callerId, isActive: true },
            role: "LEARNER",
          },
        },
        include: {
          caller: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      // Students with no calls in 7+ days
      prisma.caller.findMany({
        where: {
          cohortGroup: { ownerId: callerId, isActive: true },
          role: "LEARNER",
          OR: [
            { calls: { none: {} } },
            {
              calls: {
                every: { createdAt: { lt: sevenDaysAgo } },
              },
            },
          ],
        },
        include: {
          cohortGroup: { select: { name: true } },
        },
        take: 10,
      }),
    ]);

  return NextResponse.json({
    ok: true,
    classrooms: classrooms.map((c) => ({
      id: c.id,
      name: c.name,
      domain: c.domain,
      memberCount: c._count.members,
      createdAt: c.createdAt,
    })),
    stats: {
      classroomCount: classrooms.length,
      totalStudents,
      activeThisWeek: activeStudents,
    },
    recentCalls: recentCalls.map((c) => ({
      id: c.id,
      createdAt: c.createdAt,
      studentName: c.caller?.name ?? "Unknown",
      studentId: c.caller?.id,
    })),
    needsAttention: needsAttention.map((s) => ({
      id: s.id,
      name: s.name ?? "Unknown",
      classroom: s.cohortGroup?.name ?? "Unknown",
    })),
  });
}
