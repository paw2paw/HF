import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * @api GET /api/tasks/counts
 * @visibility internal
 * @scope tasks:read
 * @auth session
 * @tags tasks
 * @description Returns lightweight task counts by status for the current user.
 *   Used by the Account Panel to show Processing/Done pill badges.
 * @response 200 { ok: true, counts: { processing: number, completedRecent: number } }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET() {
  const authResult = await requireAuth("VIEWER");
  if (isAuthError(authResult)) return authResult.error;
  const { session } = authResult;

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [processing, completedRecent] = await Promise.all([
    prisma.userTask.count({
      where: {
        userId: session.user.id,
        status: "in_progress",
      },
    }),
    prisma.userTask.count({
      where: {
        userId: session.user.id,
        status: "completed",
        completedAt: { gte: twentyFourHoursAgo },
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    counts: { processing, completedRecent },
  });
}
