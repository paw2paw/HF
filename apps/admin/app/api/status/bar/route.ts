import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

export const runtime = "nodejs";

const ROLE_LEVEL: Record<string, number> = {
  SUPERADMIN: 5,
  ADMIN: 4,
  OPERATOR: 3,
  SUPER_TESTER: 2,
  TESTER: 1,
  VIEWER: 1,
  DEMO: 0,
};

/**
 * @api GET /api/status/bar
 * @visibility internal
 * @scope status:read
 * @auth session
 * @tags status
 * @description Lightweight status bar data — call activity (OPERATOR+) and AI spend (ADMIN+).
 *   Polled every 60s by the StatusBar component. All queries are fast aggregates/counts.
 * @response 200 { ok: true, activity?: { callsToday, activeCallers7d, totalCallers, recentCalls[] }, spend?: { todayCostDollars, mtdCostDollars } }
 * @response 500 { ok: false, error: string }
 */
export async function GET() {
  const authResult = await requireAuth("VIEWER");
  if (isAuthError(authResult)) return authResult.error;
  const { session } = authResult;

  const roleLevel =
    ROLE_LEVEL[(session.user as Record<string, unknown>).role as string] ?? 0;
  const isAdmin = roleLevel >= 4;
  const isOperator = roleLevel >= 3;

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const mtdStart = new Date();
    mtdStart.setDate(1);
    mtdStart.setHours(0, 0, 0, 0);

    const [callsToday, activeCallers7d, totalCallers, recentCalls, spendToday, spendMtd] =
      await Promise.all([
        isOperator
          ? prisma.call.count({ where: { createdAt: { gte: todayStart } } })
          : Promise.resolve(0),

        isOperator
          ? prisma.call
              .findMany({
                where: { createdAt: { gte: sevenDaysAgo }, callerId: { not: null } },
                select: { callerId: true },
                distinct: ["callerId"],
              })
              .then((rows) => rows.length)
          : Promise.resolve(0),

        isOperator ? prisma.caller.count() : Promise.resolve(0),

        isOperator
          ? prisma.call.findMany({
              take: 5,
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                createdAt: true,
                caller: { select: { id: true, name: true, email: true } },
              },
            })
          : Promise.resolve([]),

        isAdmin
          ? prisma.usageEvent.aggregate({
              where: { createdAt: { gte: todayStart } },
              _sum: { costCents: true },
            })
          : Promise.resolve(null),

        isAdmin
          ? prisma.usageEvent.aggregate({
              where: { createdAt: { gte: mtdStart } },
              _sum: { costCents: true },
            })
          : Promise.resolve(null),
      ]);

    const response: Record<string, unknown> = { ok: true };

    if (isOperator) {
      response.activity = {
        callsToday,
        activeCallers7d,
        totalCallers,
        recentCalls: (recentCalls as Array<Record<string, unknown>>).map(
          (c: Record<string, unknown>) => ({
            id: c.id,
            callerName:
              (c.caller as Record<string, unknown> | null)?.name ||
              (c.caller as Record<string, unknown> | null)?.email ||
              "Unknown",
            callerId: (c.caller as Record<string, unknown> | null)?.id || null,
            createdAt: (c.createdAt as Date).toISOString(),
          })
        ),
      };
    }

    if (isAdmin && spendToday !== null) {
      const todayCents =
        (spendToday as { _sum: { costCents: number | null } })._sum.costCents ?? 0;
      const mtdCents =
        (spendMtd as { _sum: { costCents: number | null } } | null)?._sum?.costCents ?? 0;
      response.spend = {
        todayCostDollars: parseFloat((todayCents / 100).toFixed(2)),
        mtdCostDollars: parseFloat((mtdCents / 100).toFixed(2)),
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[status/bar] Error:", error);
    return NextResponse.json({ ok: false, error: "Failed to fetch status data" }, { status: 500 });
  }
}
