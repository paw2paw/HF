import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEntityAccess, isEntityAuthError } from "@/lib/access-control";
import {
  requireCohortOwnership,
  isCohortOwnershipError,
} from "@/lib/cohort-access";

/**
 * @api GET /api/cohorts/:cohortId/dashboard
 * @visibility public
 * @scope cohorts:read
 * @auth session
 * @tags cohorts
 * @description Aggregated dashboard stats for a cohort. Returns per-pupil call counts,
 *   recent call dates, goal progress, and engagement metrics. Used by the cohort dashboard UI.
 * @pathParam cohortId string - Cohort group ID
 * @response 200 { ok: true, cohort, summary, pupils }
 * @response 404 { ok: false, error: "Cohort not found" }
 * @response 500 { ok: false, error: "Failed to fetch dashboard" }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ cohortId: string }> }
) {
  try {
    const authResult = await requireEntityAccess("cohorts", "R");
    if (isEntityAuthError(authResult)) return authResult.error;
    const { scope, session } = authResult;

    const { cohortId } = await params;

    const ownershipResult = await requireCohortOwnership(
      cohortId,
      session,
      scope
    );
    if (isCohortOwnershipError(ownershipResult)) return ownershipResult.error;
    const { cohort } = ownershipResult;

    // Fetch members with their stats
    const members = await prisma.caller.findMany({
      where: { cohortGroupId: cohortId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        archivedAt: true,
        personality: {
          select: {
            openness: true,
            conscientiousness: true,
            extraversion: true,
            agreeableness: true,
            neuroticism: true,
            confidenceScore: true,
          },
        },
        _count: {
          select: {
            calls: true,
            goals: true,
            memories: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Get the most recent call per member
    const memberIds = members.map((m) => m.id);
    const recentCalls =
      memberIds.length > 0
        ? await prisma.call.findMany({
            where: { callerId: { in: memberIds } },
            select: {
              callerId: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            distinct: ["callerId"],
          })
        : [];

    const lastCallMap = new Map(
      recentCalls.map((c) => [c.callerId, c.createdAt])
    );

    // Get goal completion counts per member
    const goalStats =
      memberIds.length > 0
        ? await prisma.goal.groupBy({
            by: ["callerId", "status"],
            where: { callerId: { in: memberIds } },
            _count: { id: true },
          })
        : [];

    const goalMap = new Map<
      string,
      { total: number; completed: number; active: number }
    >();
    for (const g of goalStats) {
      const callerId = g.callerId;
      if (!goalMap.has(callerId)) {
        goalMap.set(callerId, { total: 0, completed: 0, active: 0 });
      }
      const entry = goalMap.get(callerId)!;
      entry.total += g._count.id;
      if (g.status === "COMPLETED") entry.completed += g._count.id;
      if (g.status === "ACTIVE") entry.active += g._count.id;
    }

    // Build per-pupil dashboard rows
    const pupils = members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      createdAt: m.createdAt,
      archivedAt: m.archivedAt,
      personality: m.personality,
      callCount: m._count.calls,
      goalCount: m._count.goals,
      memoryCount: m._count.memories,
      lastCallAt: lastCallMap.get(m.id) || null,
      goals: goalMap.get(m.id) || { total: 0, completed: 0, active: 0 },
    }));

    // Aggregate summary
    const totalCalls = pupils.reduce((sum, p) => sum + p.callCount, 0);
    const totalGoals = pupils.reduce((sum, p) => sum + p.goals.total, 0);
    const completedGoals = pupils.reduce(
      (sum, p) => sum + p.goals.completed,
      0
    );
    const activePupils = pupils.filter((p) => p.lastCallAt !== null).length;

    // Pupils active in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentlyActive = pupils.filter(
      (p) => p.lastCallAt && new Date(p.lastCallAt) > sevenDaysAgo
    ).length;

    const summary = {
      memberCount: pupils.length,
      activePupils,
      recentlyActive,
      totalCalls,
      totalGoals,
      completedGoals,
      goalCompletionRate:
        totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0,
    };

    return NextResponse.json({ ok: true, cohort, summary, pupils });
  } catch (error: any) {
    console.error("Error fetching cohort dashboard:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch dashboard" },
      { status: 500 }
    );
  }
}
