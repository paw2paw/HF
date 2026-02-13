import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireAuth, isAuthError } from "@/lib/permissions";

const prisma = new PrismaClient();

/**
 * @api GET /api/calls/rewards
 * @visibility public
 * @scope calls:read
 * @auth session
 * @tags calls, rewards
 * @description List reward scores across all calls, ordered by most recent. Includes associated call source and transcript.
 * @query limit number - Max number of reward scores to return (default: 100)
 * @response 200 { ok: true, scores: RewardScore[], count: number }
 * @response 500 { ok: false, error: "Failed to fetch reward scores" }
 */
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");

    const scores = await prisma.rewardScore.findMany({
      orderBy: { scoredAt: "desc" },
      take: limit,
      include: {
        call: {
          select: { source: true, transcript: true },
        },
      },
    });

    return NextResponse.json({ ok: true, scores, count: scores.length });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch reward scores" },
      { status: 500 }
    );
  }
}
