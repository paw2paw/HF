/**
 * Usage Rollup - Aggregates usage events into period-based summaries
 *
 * Rollup strategy:
 * - Raw events: 30 days retention
 * - Hourly rollups: 90 days
 * - Daily/weekly/monthly: Forever
 */

import { RollupPeriod, UsageCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// =========================
// TYPES
// =========================

export interface RollupOptions {
  period: RollupPeriod;
  since?: Date; // Only rollup events after this time (default: last rollup)
  force?: boolean; // Recompute even if rollup exists
  verbose?: boolean;
}

export interface RollupResult {
  success: boolean;
  period: RollupPeriod;
  periodsProcessed: number;
  eventsAggregated: number;
  rollupsCreated: number;
  rollupsUpdated: number;
  errors: string[];
}

export interface CleanupResult {
  success: boolean;
  eventsDeleted: number;
  hourlyRollupsDeleted: number;
}

// =========================
// PERIOD HELPERS
// =========================

/**
 * Get the start of a period for a given date.
 */
function getPeriodStart(date: Date, period: RollupPeriod): Date {
  const d = new Date(date);

  switch (period) {
    case "HOUR":
      d.setMinutes(0, 0, 0);
      return d;

    case "DAY":
      d.setHours(0, 0, 0, 0);
      return d;

    case "WEEK":
      // Start of week (Sunday)
      const dayOfWeek = d.getDay();
      d.setDate(d.getDate() - dayOfWeek);
      d.setHours(0, 0, 0, 0);
      return d;

    case "MONTH":
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;

    default:
      return d;
  }
}

/**
 * Get the end of a period for a given date.
 */
function getPeriodEnd(periodStart: Date, period: RollupPeriod): Date {
  const d = new Date(periodStart);

  switch (period) {
    case "HOUR":
      d.setHours(d.getHours() + 1);
      return d;

    case "DAY":
      d.setDate(d.getDate() + 1);
      return d;

    case "WEEK":
      d.setDate(d.getDate() + 7);
      return d;

    case "MONTH":
      d.setMonth(d.getMonth() + 1);
      return d;

    default:
      return d;
  }
}

/**
 * Generate all periods between two dates.
 */
function* generatePeriods(
  startDate: Date,
  endDate: Date,
  period: RollupPeriod
): Generator<{ start: Date; end: Date }> {
  let current = getPeriodStart(startDate, period);

  while (current < endDate) {
    const periodEnd = getPeriodEnd(current, period);
    yield { start: new Date(current), end: periodEnd };
    current = periodEnd;
  }
}

// =========================
// ROLLUP EXECUTION
// =========================

/**
 * Run usage rollup for a specific period.
 *
 * This aggregates raw UsageEvents into UsageRollup records.
 */
export async function runUsageRollup(options: RollupOptions): Promise<RollupResult> {
  const { period, force = false, verbose = false } = options;
  const errors: string[] = [];

  const log = verbose ? console.log : () => {};

  log(`[rollup] Starting ${period} rollup...`);

  // Determine date range
  const now = new Date();
  let sinceDate = options.since;

  if (!sinceDate) {
    // Default: look back based on period
    const lookback = {
      HOUR: 2, // 2 hours back
      DAY: 2, // 2 days back
      WEEK: 2, // 2 weeks back
      MONTH: 2, // 2 months back
    };

    sinceDate = new Date(now);
    switch (period) {
      case "HOUR":
        sinceDate.setHours(sinceDate.getHours() - lookback.HOUR);
        break;
      case "DAY":
        sinceDate.setDate(sinceDate.getDate() - lookback.DAY);
        break;
      case "WEEK":
        sinceDate.setDate(sinceDate.getDate() - lookback.WEEK * 7);
        break;
      case "MONTH":
        sinceDate.setMonth(sinceDate.getMonth() - lookback.MONTH);
        break;
    }
  }

  log(`[rollup] Date range: ${sinceDate.toISOString()} to ${now.toISOString()}`);

  let periodsProcessed = 0;
  let eventsAggregated = 0;
  let rollupsCreated = 0;
  let rollupsUpdated = 0;

  // Process each period
  for (const { start, end } of generatePeriods(sinceDate, now, period)) {
    periodsProcessed++;

    try {
      // Aggregate events for this period
      const aggregates = await prisma.usageEvent.groupBy({
        by: ["category", "operation", "userId"],
        where: {
          createdAt: {
            gte: start,
            lt: end,
          },
        },
        _count: { id: true },
        _sum: { quantity: true, costCents: true },
      });

      for (const agg of aggregates) {
        eventsAggregated += agg._count.id;

        // Upsert the rollup
        // Use findFirst instead of findUnique because nullable fields in composite keys
        // require explicit null checks
        const existing = await prisma.usageRollup.findFirst({
          where: {
            period,
            periodStart: start,
            category: agg.category,
            operation: agg.operation ?? null,
            userId: agg.userId ?? null,
          },
        });

        if (existing && !force) {
          // Update existing rollup
          await prisma.usageRollup.update({
            where: { id: existing.id },
            data: {
              eventCount: agg._count.id,
              totalQty: agg._sum.quantity || 0,
              totalCost: agg._sum.costCents || 0,
            },
          });
          rollupsUpdated++;
        } else if (existing && force) {
          // Force recompute
          await prisma.usageRollup.update({
            where: { id: existing.id },
            data: {
              eventCount: agg._count.id,
              totalQty: agg._sum.quantity || 0,
              totalCost: agg._sum.costCents || 0,
            },
          });
          rollupsUpdated++;
        } else {
          // Create new rollup
          await prisma.usageRollup.create({
            data: {
              period,
              periodStart: start,
              periodEnd: end,
              category: agg.category,
              operation: agg.operation,
              userId: agg.userId,
              eventCount: agg._count.id,
              totalQty: agg._sum.quantity || 0,
              totalCost: agg._sum.costCents || 0,
            },
          });
          rollupsCreated++;
        }
      }

      // Also create category totals (operation = null)
      const categoryTotals = await prisma.usageEvent.groupBy({
        by: ["category"],
        where: {
          createdAt: {
            gte: start,
            lt: end,
          },
        },
        _count: { id: true },
        _sum: { quantity: true, costCents: true },
      });

      for (const catTotal of categoryTotals) {
        // Use findFirst + update/create instead of upsert for nullable composite keys
        const existingCatRollup = await prisma.usageRollup.findFirst({
          where: {
            period,
            periodStart: start,
            category: catTotal.category,
            operation: null,
            userId: null,
          },
        });

        if (existingCatRollup) {
          await prisma.usageRollup.update({
            where: { id: existingCatRollup.id },
            data: {
              eventCount: catTotal._count.id,
              totalQty: catTotal._sum.quantity || 0,
              totalCost: catTotal._sum.costCents || 0,
            },
          });
        } else {
          await prisma.usageRollup.create({
            data: {
              period,
              periodStart: start,
              periodEnd: end,
              category: catTotal.category,
              operation: null,
              userId: null,
              eventCount: catTotal._count.id,
              totalQty: catTotal._sum.quantity || 0,
              totalCost: catTotal._sum.costCents || 0,
            },
          });
        }
      }
    } catch (error) {
      const errorMsg = `Error processing period ${start.toISOString()}: ${error}`;
      errors.push(errorMsg);
      console.error(`[rollup] ${errorMsg}`);
    }
  }

  log(`[rollup] Complete: ${periodsProcessed} periods, ${eventsAggregated} events`);
  log(`[rollup] Rollups: ${rollupsCreated} created, ${rollupsUpdated} updated`);

  return {
    success: errors.length === 0,
    period,
    periodsProcessed,
    eventsAggregated,
    rollupsCreated,
    rollupsUpdated,
    errors,
  };
}

// =========================
// CLEANUP
// =========================

/**
 * Clean up old usage events and rollups based on retention policy.
 *
 * Retention:
 * - Raw events: 30 days
 * - Hourly rollups: 90 days
 * - Daily/weekly/monthly: Forever
 */
export async function cleanupOldUsageData(options?: {
  eventRetentionDays?: number;
  hourlyRetentionDays?: number;
  verbose?: boolean;
}): Promise<CleanupResult> {
  const {
    eventRetentionDays = 30,
    hourlyRetentionDays = 90,
    verbose = false,
  } = options || {};

  const log = verbose ? console.log : () => {};

  // Delete old events
  const eventCutoff = new Date();
  eventCutoff.setDate(eventCutoff.getDate() - eventRetentionDays);

  log(`[cleanup] Deleting events older than ${eventCutoff.toISOString()}`);

  const eventDeleteResult = await prisma.usageEvent.deleteMany({
    where: {
      createdAt: { lt: eventCutoff },
    },
  });

  log(`[cleanup] Deleted ${eventDeleteResult.count} events`);

  // Delete old hourly rollups
  const hourlyCutoff = new Date();
  hourlyCutoff.setDate(hourlyCutoff.getDate() - hourlyRetentionDays);

  log(`[cleanup] Deleting hourly rollups older than ${hourlyCutoff.toISOString()}`);

  const hourlyDeleteResult = await prisma.usageRollup.deleteMany({
    where: {
      period: "HOUR",
      periodStart: { lt: hourlyCutoff },
    },
  });

  log(`[cleanup] Deleted ${hourlyDeleteResult.count} hourly rollups`);

  return {
    success: true,
    eventsDeleted: eventDeleteResult.count,
    hourlyRollupsDeleted: hourlyDeleteResult.count,
  };
}

// =========================
// QUERY HELPERS
// =========================

/**
 * Get usage summary for a date range.
 */
export async function getUsageSummary(options: {
  startDate: Date;
  endDate: Date;
  category?: UsageCategory;
  userId?: string;
  groupBy?: "category" | "operation" | "day";
}): Promise<
  Array<{
    category: UsageCategory;
    operation?: string;
    date?: Date;
    eventCount: number;
    totalQty: number;
    totalCost: number;
  }>
> {
  const { startDate, endDate, category, userId, groupBy = "category" } = options;

  const where: Prisma.UsageEventWhereInput = {
    createdAt: {
      gte: startDate,
      lt: endDate,
    },
  };

  if (category) where.category = category;
  if (userId) where.userId = userId;

  if (groupBy === "day") {
    // For day grouping, we need to use raw query or aggregate differently
    // For now, return category grouping
    const result = await prisma.usageEvent.groupBy({
      by: ["category"],
      where,
      _count: { id: true },
      _sum: { quantity: true, costCents: true },
    });

    return result.map((r) => ({
      category: r.category,
      eventCount: r._count.id,
      totalQty: r._sum.quantity || 0,
      totalCost: r._sum.costCents || 0,
    }));
  }

  const byFields: ("category" | "operation")[] =
    groupBy === "operation" ? ["category", "operation"] : ["category"];

  const result = await prisma.usageEvent.groupBy({
    by: byFields,
    where,
    _count: { id: true },
    _sum: { quantity: true, costCents: true },
  });

  return result.map((r) => ({
    category: r.category,
    operation: "operation" in r ? r.operation : undefined,
    eventCount: r._count.id,
    totalQty: r._sum.quantity || 0,
    totalCost: r._sum.costCents || 0,
  }));
}

/**
 * Get total cost for a date range.
 */
export async function getTotalCost(
  startDate: Date,
  endDate: Date,
  category?: UsageCategory
): Promise<number> {
  const where: Prisma.UsageEventWhereInput = {
    createdAt: {
      gte: startDate,
      lt: endDate,
    },
  };

  if (category) where.category = category;

  const result = await prisma.usageEvent.aggregate({
    where,
    _sum: { costCents: true },
  });

  return result._sum.costCents || 0;
}

/**
 * Get recent usage events.
 */
export async function getRecentEvents(options?: {
  limit?: number;
  category?: UsageCategory;
  userId?: string;
}): Promise<
  Array<{
    id: string;
    category: UsageCategory;
    operation: string;
    quantity: number;
    costCents: number;
    createdAt: Date;
    userId: string | null;
    callerId: string | null;
  }>
> {
  const { limit = 100, category, userId } = options || {};

  const where: Prisma.UsageEventWhereInput = {};
  if (category) where.category = category;
  if (userId) where.userId = userId;

  return prisma.usageEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      category: true,
      operation: true,
      quantity: true,
      costCents: true,
      createdAt: true,
      userId: true,
      callerId: true,
    },
  });
}
