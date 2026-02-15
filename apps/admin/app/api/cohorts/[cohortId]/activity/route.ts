import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEntityAccess, isEntityAuthError } from "@/lib/access-control";
import {
  requireCohortOwnership,
  isCohortOwnershipError,
} from "@/lib/cohort-access";

/**
 * @api GET /api/cohorts/:cohortId/activity
 * @visibility public
 * @scope cohorts:read
 * @auth session
 * @tags cohorts
 * @description Recent activity feed for a cohort. Returns calls, goal updates, and
 *   memory extractions across all cohort members, ordered by most recent first.
 * @pathParam cohortId string - Cohort group ID
 * @query limit number - Maximum items to return (default 50, max 200)
 * @query offset number - Number of items to skip (default 0)
 * @response 200 { ok: true, activity, total, limit, offset }
 * @response 404 { ok: false, error: "Cohort not found" }
 * @response 500 { ok: false, error: "Failed to fetch activity" }
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

    const url = new URL(req.url);
    const limit = Math.min(200, parseInt(url.searchParams.get("limit") || "50"));
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Get member IDs for this cohort
    const memberIds = await prisma.caller.findMany({
      where: { cohortGroupId: cohortId },
      select: { id: true },
    });
    const callerIds = memberIds.map((m) => m.id);

    if (callerIds.length === 0) {
      return NextResponse.json({
        ok: true,
        activity: [],
        total: 0,
        limit,
        offset,
      });
    }

    // Fetch recent calls for these members
    const [calls, callCount] = await Promise.all([
      prisma.call.findMany({
        where: { callerId: { in: callerIds } },
        select: {
          id: true,
          createdAt: true,
          source: true,
          callerId: true,
          caller: {
            select: { id: true, name: true },
          },
          _count: {
            select: {
              scores: true,
              extractedMemories: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.call.count({
        where: { callerId: { in: callerIds } },
      }),
    ]);

    // Transform into activity items
    const activity = calls.map((call) => ({
      type: "call" as const,
      id: call.id,
      callerId: call.callerId,
      callerName: call.caller?.name || "Unknown",
      timestamp: call.createdAt,
      source: call.source,
      scoreCount: call._count.scores,
      memoryCount: call._count.extractedMemories,
    }));

    return NextResponse.json({
      ok: true,
      activity,
      total: callCount,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("Error fetching cohort activity:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch activity" },
      { status: 500 }
    );
  }
}
