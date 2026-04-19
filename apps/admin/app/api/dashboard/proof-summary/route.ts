import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/dashboard/proof-summary
 * @visibility internal
 * @scope dashboard:read
 * @auth session
 * @tags dashboard
 * @description Aggregate proof points for the dashboard — total students, mastery, calls,
 *   memories learned, content mix, and spotlight learners. Designed for fast loading (SQL
 *   aggregates, no per-caller fetches). Used by the proof-points strip, spotlight cards,
 *   and content mix treemap on the SUPERADMIN/DEMO dashboard.
 * @response 200 { ok: true, totalStudents, totalCalls, avgMastery, memoriesLearned, modulesCompleted, activeThisWeek, contentMix, spotlights, recentActivity }
 * @response 401 Unauthorized
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(): Promise<NextResponse> {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Run all aggregates in parallel
    const [
      totalStudents,
      totalCalls,
      masteryAgg,
      memoriesLearned,
      modulesCompleted,
      activeThisWeek,
      contentMixRaw,
      spotlightCallers,
      recentCalls,
      recentPlaybooks,
      recentEnrollments,
    ] = await Promise.all([
      // Total active callers
      prisma.caller.count({ where: { archivedAt: null } }),

      // Total calls
      prisma.call.count(),

      // Average mastery across all module progress records
      prisma.moduleProgress.aggregate({
        _avg: { mastery: true },
        where: { mastery: { gt: 0 } },
      }),

      // Total active memories (not superseded)
      prisma.callerMemory.count({ where: { supersededById: null } }),

      // Modules with mastery >= 0.8
      prisma.moduleProgress.count({
        where: { status: "COMPLETED" },
      }),

      // Callers with calls in the last 7 days
      prisma.caller.count({
        where: {
          archivedAt: null,
          calls: { some: { createdAt: { gte: weekAgo } } },
        },
      }),

      // Content mix — category counts from ContentAssertion
      prisma.contentAssertion.groupBy({
        by: ["category"],
        _count: { _all: true },
        orderBy: { _count: { category: "desc" } },
        take: 12,
      }),

      // Spotlight learners — top 5 by mastery with call + memory counts
      prisma.caller.findMany({
        where: {
          archivedAt: null,
          moduleProgress: { some: { mastery: { gt: 0 } } },
        },
        take: 10,
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              calls: true,
              memories: true,
            },
          },
          moduleProgress: {
            select: { mastery: true },
            where: { mastery: { gt: 0 } },
          },
        },
      }),

      // Recent calls (last 8)
      prisma.call.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          caller: { select: { id: true, name: true } },
        },
      }),

      // Recently created playbooks (last 5)
      prisma.playbook.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      }),

      // Recent enrollments (last 5)
      prisma.callerPlaybook.findMany({
        take: 5,
        orderBy: { enrolledAt: "desc" },
        select: {
          id: true,
          enrolledAt: true,
          caller: { select: { id: true, name: true } },
          playbook: { select: { name: true } },
        },
      }),
    ]);

    // Transform content mix
    const contentMix: Record<string, number> = {};
    for (const row of contentMixRaw) {
      contentMix[row.category] = row._count._all;
    }

    // Transform spotlights — compute average mastery per caller
    const spotlights = spotlightCallers
      .map((c) => {
        const avgMastery =
          c.moduleProgress.length > 0
            ? c.moduleProgress.reduce((sum, p) => sum + p.mastery, 0) /
              c.moduleProgress.length
            : 0;
        return {
          id: c.id,
          name: c.name ?? "Unnamed",
          mastery: Math.round(avgMastery * 100) / 100,
          callCount: c._count.calls,
          memoryCount: c._count.memories,
        };
      })
      .sort((a, b) => b.mastery - a.mastery)
      .slice(0, 3);

    // Build recent activity feed — merge calls, playbooks, enrollments sorted by time
    type ActivityItem = {
      type: "call" | "course" | "enrollment";
      entityName: string;
      entityId: string;
      action: string;
      timestamp: string;
      href: string;
    };

    const recentActivity: ActivityItem[] = [];

    for (const call of recentCalls) {
      recentActivity.push({
        type: "call",
        entityName: call.caller?.name ?? "Unknown",
        entityId: call.caller?.id ?? call.id,
        action: "had a call",
        timestamp: call.createdAt.toISOString(),
        href: `/x/callers/${call.caller?.id}?tab=calls-prompts`,
      });
    }

    for (const pb of recentPlaybooks) {
      recentActivity.push({
        type: "course",
        entityName: pb.name,
        entityId: pb.id,
        action: "course created",
        timestamp: pb.createdAt.toISOString(),
        href: `/x/courses/${pb.id}`,
      });
    }

    for (const en of recentEnrollments) {
      recentActivity.push({
        type: "enrollment",
        entityName: en.caller?.name ?? "Unknown",
        entityId: en.caller?.id ?? en.id,
        action: `enrolled in ${en.playbook?.name ?? "a course"}`,
        timestamp: en.enrolledAt.toISOString(),
        href: `/x/callers/${en.caller?.id}`,
      });
    }

    // Sort by timestamp descending, take top 8
    recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    recentActivity.splice(8);

    return NextResponse.json({
      ok: true,
      totalStudents,
      totalCalls,
      avgMastery: masteryAgg._avg.mastery,
      memoriesLearned,
      modulesCompleted,
      activeThisWeek,
      contentMix,
      spotlights,
      recentActivity,
    });
  } catch (error: unknown) {
    console.error("Proof summary API error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to load proof summary" },
      { status: 500 },
    );
  }
}
