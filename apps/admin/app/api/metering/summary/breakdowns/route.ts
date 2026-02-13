import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

export const runtime = "nodejs";

/**
 * @api GET /api/metering/summary/breakdowns
 * @visibility internal
 * @scope metering:read
 * @auth session
 * @tags metering
 * @description Returns usage breakdowns by caller, domain, most expensive operations, and most used operations
 * @query days number - Number of days to aggregate (default: 30)
 * @query limit number - Max rows per breakdown (default: 25, max: 100)
 * @response 200 { ok: true, period, byCaller, byDomain, mostExpensive, mostUsed, attribution }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "25", 10), 100);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date();

    // Run all queries in parallel
    const [
      byCallerRows,
      byDomainRows,
      mostExpensive,
      mostUsed,
      totalCount,
      attributedCount,
    ] = await Promise.all([
      // By Caller (raw SQL - needs JOIN)
      prisma.$queryRaw<
        Array<{
          callerId: string;
          callerName: string | null;
          callerEmail: string | null;
          callerPhone: string | null;
          domainSlug: string | null;
          domainName: string | null;
          eventCount: bigint;
          totalCostCents: number;
        }>
      >`
        SELECT
          ue."callerId",
          c.name AS "callerName",
          c.email AS "callerEmail",
          c.phone AS "callerPhone",
          d.slug AS "domainSlug",
          d.name AS "domainName",
          COUNT(*)::bigint AS "eventCount",
          COALESCE(SUM(ue."costCents"), 0) AS "totalCostCents"
        FROM "UsageEvent" ue
        LEFT JOIN "Caller" c ON c.id = ue."callerId"
        LEFT JOIN "Domain" d ON d.id = c."domainId"
        WHERE ue."createdAt" >= ${startDate}
          AND ue."createdAt" < ${endDate}
          AND ue."callerId" IS NOT NULL
        GROUP BY ue."callerId", c.name, c.email, c.phone, d.slug, d.name
        ORDER BY "totalCostCents" DESC
        LIMIT ${limit}
      `,

      // By Domain (raw SQL - needs JOIN)
      prisma.$queryRaw<
        Array<{
          domainId: string | null;
          domainSlug: string | null;
          domainName: string | null;
          callerCount: bigint;
          eventCount: bigint;
          totalCostCents: number;
        }>
      >`
        SELECT
          d.id AS "domainId",
          d.slug AS "domainSlug",
          d.name AS "domainName",
          COUNT(DISTINCT ue."callerId")::bigint AS "callerCount",
          COUNT(*)::bigint AS "eventCount",
          COALESCE(SUM(ue."costCents"), 0) AS "totalCostCents"
        FROM "UsageEvent" ue
        LEFT JOIN "Caller" c ON c.id = ue."callerId"
        LEFT JOIN "Domain" d ON d.id = c."domainId"
        WHERE ue."createdAt" >= ${startDate}
          AND ue."createdAt" < ${endDate}
          AND ue."callerId" IS NOT NULL
        GROUP BY d.id, d.slug, d.name
        ORDER BY "totalCostCents" DESC
        LIMIT ${limit}
      `,

      // Most Expensive (Prisma groupBy)
      prisma.usageEvent.groupBy({
        by: ["category", "operation"],
        where: { createdAt: { gte: startDate, lt: endDate } },
        _count: { id: true },
        _sum: { quantity: true, costCents: true },
        _avg: { costCents: true },
        orderBy: { _sum: { costCents: "desc" } },
        take: limit,
      }),

      // Most Used (Prisma groupBy)
      prisma.usageEvent.groupBy({
        by: ["category", "operation"],
        where: { createdAt: { gte: startDate, lt: endDate } },
        _count: { id: true },
        _sum: { quantity: true, costCents: true },
        orderBy: { _count: { id: "desc" } },
        take: limit,
      }),

      // Total events
      prisma.usageEvent.count({
        where: { createdAt: { gte: startDate, lt: endDate } },
      }),

      // Attributed events (have callerId)
      prisma.usageEvent.count({
        where: {
          createdAt: { gte: startDate, lt: endDate },
          callerId: { not: null },
        },
      }),
    ]);

    const unattributedEvents = totalCount - attributedCount;

    return NextResponse.json({
      ok: true,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      byCaller: byCallerRows.map((r) => ({
        callerId: r.callerId,
        callerName: r.callerName,
        callerEmail: r.callerEmail,
        callerPhone: r.callerPhone,
        domainSlug: r.domainSlug,
        domainName: r.domainName,
        eventCount: Number(r.eventCount),
        totalCostCents: r.totalCostCents,
        costDollars: (r.totalCostCents / 100).toFixed(2),
      })),
      byDomain: byDomainRows.map((r) => ({
        domainId: r.domainId,
        domainSlug: r.domainSlug,
        domainName: r.domainName,
        callerCount: Number(r.callerCount),
        eventCount: Number(r.eventCount),
        totalCostCents: r.totalCostCents,
        costDollars: (r.totalCostCents / 100).toFixed(2),
      })),
      mostExpensive: mostExpensive.map((op) => ({
        category: op.category,
        operation: op.operation,
        eventCount: op._count.id,
        totalQty: op._sum.quantity || 0,
        avgCostCents: op._avg.costCents || 0,
        totalCostCents: op._sum.costCents || 0,
        costDollars: ((op._sum.costCents || 0) / 100).toFixed(2),
      })),
      mostUsed: mostUsed.map((op) => ({
        category: op.category,
        operation: op.operation,
        eventCount: op._count.id,
        totalQty: op._sum.quantity || 0,
        totalCostCents: op._sum.costCents || 0,
        costDollars: ((op._sum.costCents || 0) / 100).toFixed(2),
      })),
      attribution: {
        totalEvents: totalCount,
        attributedEvents: attributedCount,
        unattributedEvents,
        attributionRate: totalCount > 0 ? Math.round((attributedCount / totalCount) * 100) : 0,
      },
    });
  } catch (error: unknown) {
    console.error("[metering/summary/breakdowns] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to fetch breakdowns",
      },
      { status: 500 }
    );
  }
}
