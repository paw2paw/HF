/**
 * @api GET /api/ai/errors
 * @visibility internal
 * @scope admin:read
 * @auth session
 * @tags ai, monitoring
 * @description Get recent AI interaction failures and failure statistics for the error monitor dashboard
 * @queryParam hours number - Time window in hours (default: 24)
 * @queryParam limit number - Max failures to return (default: 50)
 * @queryParam callPoint string - Filter by call point (e.g. "pipeline.memory_extract")
 * @response 200 { ok: true, failures: Array, stats: object }
 * @response 500 { ok: false, error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getRecentFailures, getFailureStats } from "@/lib/ai/knowledge-accumulation";
import { requireAuth, isAuthError } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get("hours") || "24", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const callPoint = searchParams.get("callPoint") || undefined;

    const [{ failures, total }, stats] = await Promise.all([
      getRecentFailures({ hours, limit, callPoint }),
      getFailureStats(hours),
    ]);

    return NextResponse.json({
      ok: true,
      failures,
      total,
      stats,
    });
  } catch (error) {
    console.error("AI errors endpoint error:", error);
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
