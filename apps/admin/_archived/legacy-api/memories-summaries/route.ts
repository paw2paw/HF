import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @archived 2026-02-12 — Only referenced by archived legacy memories page.
 * No active frontend consumer.
 *
 * TO RESTORE: Move this file back to  app/api/memories/summaries/route.ts
 *
 * @api GET /api/memories/summaries
 * @visibility public
 * @scope memories:read
 * @auth session
 * @tags memories
 * @description List caller memory summaries with filtering and pagination. Summaries aggregate individual memories per caller, ordered by most recent memory activity.
 * @query callerId string - Filter by caller ID (optional)
 * @query limit number - Max results to return (default 50, max 100)
 * @query offset number - Pagination offset (default 0)
 * @response 200 { ok: true, summaries: [...], total: number, limit: number, offset: number }
 * @response 500 { ok: false, error: "Failed to fetch memory summaries" }
 */
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const url = new URL(req.url);
    const callerId = url.searchParams.get("callerId");
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50"));
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const where: any = {};

    if (callerId) {
      where.callerId = callerId;
    }

    const [summaries, total] = await Promise.all([
      prisma.callerMemorySummary.findMany({
        where,
        orderBy: [{ lastMemoryAt: "desc" }],
        take: limit,
        skip: offset,
        include: {
          caller: {
            select: { id: true, name: true, email: true, externalId: true },
          },
        },
      }),
      prisma.callerMemorySummary.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      summaries,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("Error fetching memory summaries:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch memory summaries" },
      { status: 500 }
    );
  }
}
