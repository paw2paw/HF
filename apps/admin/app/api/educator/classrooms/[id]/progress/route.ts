import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireEducator,
  isEducatorAuthError,
  requireEducatorCohortOwnership,
} from "@/lib/educator-access";

/**
 * @api GET /api/educator/classrooms/[id]/progress
 * @visibility internal
 * @scope educator:read
 * @auth bearer
 * @tags educator, classrooms, analytics
 * @description Cohort progress stats including calls-per-day trend (30 days), engagement breakdown (active/moderate/needsAttention/notStarted), and per-student call summary. Requires educator ownership of the cohort.
 * @response 200 { ok: true, callsPerDay: [{ date, count }], engagement: { active, moderate, needsAttention, notStarted, total }, summary: { totalCalls, uniqueActive7d }, perStudent: [{ id, name, totalCalls, recentCalls }] }
 * @response 403 { ok: false, error: "Not authorized" }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEducator();
  if (isEducatorAuthError(auth)) return auth.error;

  const { id } = await params;
  const ownership = await requireEducatorCohortOwnership(id, auth.callerId);
  if ("error" in ownership) return ownership.error;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get all members with their call data
  const members = await prisma.caller.findMany({
    where: { cohortGroupId: id, role: "LEARNER" },
    include: {
      _count: { select: { calls: true } },
      calls: {
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // Build calls-per-day series (last 30 days)
  const callsPerDay: Record<string, number> = {};
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    callsPerDay[d.toISOString().slice(0, 10)] = 0;
  }

  for (const member of members) {
    for (const call of member.calls) {
      const day = call.createdAt.toISOString().slice(0, 10);
      if (callsPerDay[day] !== undefined) {
        callsPerDay[day]++;
      }
    }
  }

  // Engagement buckets
  let active = 0;
  let moderate = 0;
  let needsAttention = 0;
  let notStarted = 0;

  for (const member of members) {
    const recentCalls = member.calls.filter(
      (c) => c.createdAt >= sevenDaysAgo
    );
    if (member._count.calls === 0) notStarted++;
    else if (recentCalls.length > 0) active++;
    else if (member.calls.length > 0) moderate++;
    else needsAttention++;
  }

  return NextResponse.json({
    ok: true,
    callsPerDay: Object.entries(callsPerDay).map(([date, count]) => ({
      date,
      count,
    })),
    engagement: {
      active,
      moderate,
      needsAttention,
      notStarted,
      total: members.length,
    },
    summary: {
      totalCalls: members.reduce((sum, m) => sum + m._count.calls, 0),
      uniqueActive7d: active,
    },
    perStudent: members
      .map((m) => ({
        id: m.id,
        name: m.name ?? "Unknown",
        totalCalls: m._count.calls,
        recentCalls: m.calls.filter((c) => c.createdAt >= sevenDaysAgo).length,
      }))
      .sort((a, b) => b.totalCalls - a.totalCalls),
  });
}
