import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEducator, isEducatorAuthError } from "@/lib/educator-access";

/**
 * @api GET /api/educator/reports
 * @visibility internal
 * @scope educator:read
 * @auth bearer
 * @tags educator, analytics, reports
 * @description Aggregated analytics across all classrooms or filtered to a specific one. Includes student count, total/recent calls, engagement rate, and 30-day calls-per-day trend.
 * @query cohortId? string - Filter to a specific classroom
 * @response 200 { ok: true, classrooms: [...], stats: { totalStudents, totalCalls, callsThisWeek, activeStudents7d, engagementRate }, callsPerDay: [{ date, count }] }
 */
export async function GET(request: NextRequest) {
  const auth = await requireEducator();
  if (isEducatorAuthError(auth)) return auth.error;

  const cohortId = request.nextUrl.searchParams.get("cohortId");

  // Get classrooms for the dropdown
  const classrooms = await prisma.cohortGroup.findMany({
    where: { ownerId: auth.callerId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Build cohort filter
  const cohortFilter = cohortId
    ? { cohortGroupId: cohortId, cohortGroup: { ownerId: auth.callerId } }
    : { cohortGroup: { ownerId: auth.callerId, isActive: true } };

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [totalStudents, totalCalls, recentCalls, callsLast30, activeStudents] =
    await Promise.all([
      prisma.caller.count({
        where: { ...cohortFilter, role: "LEARNER" },
      }),

      prisma.call.count({
        where: { caller: { ...cohortFilter, role: "LEARNER" } },
      }),

      prisma.call.count({
        where: {
          caller: { ...cohortFilter, role: "LEARNER" },
          createdAt: { gte: sevenDaysAgo },
        },
      }),

      prisma.call.findMany({
        where: {
          caller: { ...cohortFilter, role: "LEARNER" },
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { createdAt: true },
      }),

      prisma.caller.count({
        where: {
          ...cohortFilter,
          role: "LEARNER",
          calls: { some: { createdAt: { gte: sevenDaysAgo } } },
        },
      }),
    ]);

  // Build calls-per-day trend
  const callsPerDay: Record<string, number> = {};
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    callsPerDay[d.toISOString().slice(0, 10)] = 0;
  }

  for (const call of callsLast30) {
    const day = call.createdAt.toISOString().slice(0, 10);
    if (callsPerDay[day] !== undefined) callsPerDay[day]++;
  }

  return NextResponse.json({
    ok: true,
    classrooms,
    stats: {
      totalStudents,
      totalCalls,
      callsThisWeek: recentCalls,
      activeStudents7d: activeStudents,
      engagementRate:
        totalStudents > 0
          ? Math.round((activeStudents / totalStudents) * 100)
          : 0,
    },
    callsPerDay: Object.entries(callsPerDay).map(([date, count]) => ({
      date,
      count,
    })),
  });
}
