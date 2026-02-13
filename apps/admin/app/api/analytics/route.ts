import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

export const runtime = "nodejs";

/**
 * @api GET /api/analytics
 * @visibility internal
 * @scope analytics:read
 * @auth session
 * @tags analytics
 * @description Returns aggregated analytics data for the dashboard including learner progress,
 *   goal analytics, onboarding metrics, pipeline health, and activity trends
 * @query days number - Lookback period in days (default: 30)
 * @response 200 { ok: true, period, learnerProgress, goals, onboarding, pipeline, activity }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30", 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Run all independent queries in parallel
    const [
      // Panel 1: Learner Progress
      callersWithCurricula,
      masteryAttributes,
      readinessAttributes,
      // Panel 2: Goals
      goalsByStatus,
      goalsByType,
      avgProgress,
      recentlyCompleted,
      totalGoals,
      // Panel 3: Onboarding
      totalSessions,
      completedSessions,
      avgGoalsDiscovered,
      onboardingByDomain,
      onboardingCompletedByDomain,
      completedSessionDates,
      // Panel 4: Pipeline
      pipelineByStatus,
      pipelineAvgDuration,
      pipelineRecentFailures,
      pipelineByPhase,
      pipelineSuccessByPhase,
      // Panel 5: Activity
      callsPerDayRaw,
      newCallersPerDayRaw,
      activeCallers7dRaw,
      totalCalls,
      totalCallers,
    ] = await Promise.all([
      // --- Panel 1: Learner Progress ---
      prisma.callerAttribute.groupBy({
        by: ["callerId"],
        where: { scope: "CURRICULUM" },
      }),
      prisma.callerAttribute.findMany({
        where: {
          scope: "TRUST_PROGRESS",
          key: { contains: "certified_mastery" },
        },
        select: { callerId: true, numberValue: true },
      }),
      prisma.callerAttribute.findMany({
        where: {
          scope: "TRUST_PROGRESS",
          key: { contains: "certification_readiness" },
        },
        select: { callerId: true, numberValue: true },
      }),

      // --- Panel 2: Goals ---
      prisma.goal.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.goal.groupBy({
        by: ["type"],
        _count: { id: true },
      }),
      prisma.goal.aggregate({
        _avg: { progress: true },
      }),
      prisma.goal.count({
        where: {
          status: "COMPLETED",
          completedAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.goal.count(),

      // --- Panel 3: Onboarding ---
      prisma.onboardingSession.count(),
      prisma.onboardingSession.count({
        where: { isComplete: true },
      }),
      prisma.onboardingSession.aggregate({
        _avg: { discoveredGoals: true },
      }),
      prisma.onboardingSession.groupBy({
        by: ["domainId"],
        _count: { id: true },
      }),
      prisma.onboardingSession.groupBy({
        by: ["domainId"],
        where: { isComplete: true },
        _count: { id: true },
      }),
      prisma.onboardingSession.findMany({
        where: { isComplete: true, completedAt: { not: null } },
        select: { createdAt: true, completedAt: true },
      }),

      // --- Panel 4: Pipeline ---
      prisma.pipelineRun.groupBy({
        by: ["status"],
        where: { startedAt: { gte: startDate } },
        _count: { id: true },
      }),
      prisma.pipelineRun.aggregate({
        where: { startedAt: { gte: startDate }, durationMs: { not: null } },
        _avg: { durationMs: true },
      }),
      prisma.pipelineRun.count({
        where: {
          status: "FAILED",
          startedAt: { gte: twentyFourHoursAgo },
        },
      }),
      prisma.pipelineRun.groupBy({
        by: ["phase"],
        where: { startedAt: { gte: startDate } },
        _count: { id: true },
      }),
      prisma.pipelineRun.groupBy({
        by: ["phase"],
        where: { startedAt: { gte: startDate }, status: "SUCCESS" },
        _count: { id: true },
      }),

      // --- Panel 5: Activity ---
      prisma.$queryRaw<Array<{ date: Date; call_count: bigint }>>`
        SELECT
          DATE_TRUNC('day', "createdAt") as date,
          COUNT(*) as call_count
        FROM "Call"
        WHERE "createdAt" >= ${startDate}
          AND "createdAt" < ${endDate}
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY date ASC
      `,
      prisma.$queryRaw<Array<{ date: Date; caller_count: bigint }>>`
        SELECT
          DATE_TRUNC('day', "createdAt") as date,
          COUNT(*) as caller_count
        FROM "Caller"
        WHERE "createdAt" >= ${startDate}
          AND "createdAt" < ${endDate}
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY date ASC
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT "callerId") as count
        FROM "Call"
        WHERE "createdAt" >= ${sevenDaysAgo}
          AND "callerId" IS NOT NULL
      `,
      prisma.call.count({
        where: { createdAt: { gte: startDate } },
      }),
      prisma.caller.count(),
    ]);

    // --- Process Panel 1: Learner Progress ---
    const totalWithCurricula = callersWithCurricula.length;

    const masteryValues = masteryAttributes
      .map((a) => a.numberValue)
      .filter((v): v is number => v !== null);
    const averageCertifiedMastery =
      masteryValues.length > 0
        ? masteryValues.reduce((s, v) => s + v, 0) / masteryValues.length
        : 0;

    const readinessValues = readinessAttributes
      .map((a) => a.numberValue)
      .filter((v): v is number => v !== null);
    const averageCertificationReadiness =
      readinessValues.length > 0
        ? readinessValues.reduce((s, v) => s + v, 0) / readinessValues.length
        : 0;

    // Bucket mastery values into distribution
    const distribution = { low: 0, medium: 0, high: 0, mastered: 0 };
    for (const v of masteryValues) {
      if (v < 0.25) distribution.low++;
      else if (v < 0.5) distribution.medium++;
      else if (v < 0.75) distribution.high++;
      else distribution.mastered++;
    }

    // --- Process Panel 3: Onboarding duration ---
    let averageDurationMs: number | null = null;
    if (completedSessionDates.length > 0) {
      const durations = completedSessionDates
        .filter((s) => s.completedAt)
        .map(
          (s) =>
            new Date(s.completedAt!).getTime() -
            new Date(s.createdAt).getTime()
        );
      if (durations.length > 0) {
        averageDurationMs =
          durations.reduce((s, d) => s + d, 0) / durations.length;
      }
    }

    // Build onboarding by-domain with names
    const domainIds = onboardingByDomain.map((d) => d.domainId);
    let domainNames: Record<string, string> = {};
    if (domainIds.length > 0) {
      const domains = await prisma.domain.findMany({
        where: { id: { in: domainIds } },
        select: { id: true, name: true },
      });
      domainNames = Object.fromEntries(domains.map((d) => [d.id, d.name]));
    }

    const completedByDomainMap = Object.fromEntries(
      onboardingCompletedByDomain.map((d) => [d.domainId, d._count.id])
    );

    // --- Process Panel 4: Pipeline ---
    const pipelineStatusMap = Object.fromEntries(
      pipelineByStatus.map((s) => [s.status, s._count.id])
    );
    const pipelineTotalRuns = Object.values(pipelineStatusMap).reduce(
      (s, c) => s + c,
      0
    );
    const pipelineSuccessCount = pipelineStatusMap["SUCCESS"] || 0;
    const pipelineFailedCount = pipelineStatusMap["FAILED"] || 0;

    const phaseSuccessMap = Object.fromEntries(
      pipelineSuccessByPhase.map((p) => [p.phase, p._count.id])
    );

    // --- Build response ---
    return NextResponse.json({
      ok: true,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },

      learnerProgress: {
        totalWithCurricula,
        averageCertifiedMastery: Math.round(averageCertifiedMastery * 1000) / 1000,
        averageCertificationReadiness:
          Math.round(averageCertificationReadiness * 1000) / 1000,
        distribution,
      },

      goals: {
        total: totalGoals,
        byStatus: goalsByStatus.map((s) => ({
          status: s.status,
          count: s._count.id,
        })),
        byType: goalsByType.map((t) => ({
          type: t.type,
          count: t._count.id,
        })),
        averageProgress: Math.round((avgProgress._avg.progress || 0) * 1000) / 1000,
        recentlyCompleted,
      },

      onboarding: {
        totalSessions,
        completedSessions,
        completionRate:
          totalSessions > 0
            ? Math.round((completedSessions / totalSessions) * 1000) / 1000
            : 0,
        averageDurationMs: averageDurationMs
          ? Math.round(averageDurationMs)
          : null,
        averageGoalsDiscovered:
          Math.round((avgGoalsDiscovered._avg.discoveredGoals || 0) * 10) / 10,
        byDomain: onboardingByDomain.map((d) => ({
          domainId: d.domainId,
          domainName: domainNames[d.domainId] || "Unknown",
          total: d._count.id,
          completed: completedByDomainMap[d.domainId] || 0,
        })),
      },

      pipeline: {
        totalRuns: pipelineTotalRuns,
        successCount: pipelineSuccessCount,
        failedCount: pipelineFailedCount,
        successRate:
          pipelineTotalRuns > 0
            ? Math.round((pipelineSuccessCount / pipelineTotalRuns) * 1000) / 1000
            : 0,
        averageDurationMs: pipelineAvgDuration._avg.durationMs
          ? Math.round(pipelineAvgDuration._avg.durationMs)
          : null,
        recentFailures: pipelineRecentFailures,
        byPhase: pipelineByPhase.map((p) => ({
          phase: p.phase,
          count: p._count.id,
          successCount: phaseSuccessMap[p.phase] || 0,
        })),
      },

      activity: {
        callsPerDay: callsPerDayRaw.map((d) => ({
          date: d.date.toISOString().split("T")[0],
          count: Number(d.call_count),
        })),
        newCallersPerDay: newCallersPerDayRaw.map((d) => ({
          date: d.date.toISOString().split("T")[0],
          count: Number(d.caller_count),
        })),
        activeCallers7d:
          activeCallers7dRaw.length > 0
            ? Number(activeCallers7dRaw[0].count)
            : 0,
        totalCalls,
        totalCallers,
      },
    });
  } catch (error: unknown) {
    console.error("[analytics] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch analytics",
      },
      { status: 500 }
    );
  }
}
