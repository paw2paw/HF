/**
 * /api/metering/events
 *
 * GET: Query usage events with filters
 * POST: Log a new usage event (internal use)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UsageCategory, Prisma } from "@prisma/client";
import { logUsageEvent } from "@/lib/metering/usage-logger";

export const runtime = "nodejs";

/**
 * GET /api/metering/events
 *
 * Query usage events with optional filters.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filters
    const category = searchParams.get("category") as UsageCategory | null;
    const operation = searchParams.get("operation");
    const userId = searchParams.get("userId");
    const callerId = searchParams.get("callerId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 1000);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Date range
    const sinceParam = searchParams.get("since");
    const untilParam = searchParams.get("until");

    // Build where clause
    const where: Prisma.UsageEventWhereInput = {};

    if (category) where.category = category;
    if (operation) where.operation = { contains: operation };
    if (userId) where.userId = userId;
    if (callerId) where.callerId = callerId;

    if (sinceParam || untilParam) {
      where.createdAt = {};
      if (sinceParam) where.createdAt.gte = new Date(sinceParam);
      if (untilParam) where.createdAt.lt = new Date(untilParam);
    }

    // Query events
    const [events, total] = await Promise.all([
      prisma.usageEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          category: true,
          operation: true,
          quantity: true,
          unitType: true,
          costCents: true,
          engine: true,
          model: true,
          sourceOp: true,
          userId: true,
          callerId: true,
          callId: true,
          createdAt: true,
        },
      }),
      prisma.usageEvent.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      events,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + events.length < total,
      },
    });
  } catch (error: unknown) {
    console.error("[metering/events] GET Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to fetch events",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/metering/events
 *
 * Log a new usage event (primarily for internal use or testing).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      category,
      operation,
      quantity,
      unitType,
      userId,
      callerId,
      callId,
      engine,
      model,
      sourceOp,
      metadata,
    } = body;

    // Validate required fields
    if (!category || !operation) {
      return NextResponse.json(
        { ok: false, error: "category and operation are required" },
        { status: 400 }
      );
    }

    // Validate category is a valid enum value
    const validCategories: UsageCategory[] = [
      "AI",
      "DATABASE",
      "COMPUTE",
      "STORAGE",
      "EXTERNAL",
    ];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { ok: false, error: `Invalid category. Must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }

    const result = await logUsageEvent({
      category,
      operation,
      quantity,
      unitType,
      userId,
      callerId,
      callId,
      engine,
      model,
      sourceOp,
      metadata,
    });

    if (result) {
      return NextResponse.json({
        ok: true,
        eventId: result.id,
        costCents: result.costCents,
      });
    } else {
      return NextResponse.json(
        { ok: false, error: "Failed to log event" },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error("[metering/events] POST Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to log event",
      },
      { status: 500 }
    );
  }
}
