import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * GET /api/failed-calls
 * List failed call extractions for review
 * Query params:
 * - limit: max records (default 100)
 * - errorType: filter by error type
 * - resolved: "true" | "false" | "all" (default "false" - unresolved only)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const errorType = url.searchParams.get("errorType");
    const resolved = url.searchParams.get("resolved") || "false";

    const where: any = {};

    if (errorType) {
      where.errorType = errorType;
    }

    if (resolved === "false") {
      where.resolvedAt = null;
    } else if (resolved === "true") {
      where.resolvedAt = { not: null };
    }
    // "all" = no filter

    const failedCalls = await prisma.failedCall.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        processedFile: {
          select: {
            filename: true,
            filepath: true,
          },
        },
      },
    });

    // Get counts by error type
    const countsByType = await prisma.failedCall.groupBy({
      by: ["errorType"],
      where: { resolvedAt: null },
      _count: true,
    });

    const stats = {
      total: failedCalls.length,
      unresolved: await prisma.failedCall.count({ where: { resolvedAt: null } }),
      byType: countsByType.reduce((acc, c) => {
        acc[c.errorType] = c._count;
        return acc;
      }, {} as Record<string, number>),
    };

    return NextResponse.json({
      ok: true,
      failedCalls,
      stats,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch failed calls" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/failed-calls
 * Mark failed calls as resolved
 * Body: { ids: string[], action: "resolve" | "unresolve" }
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { ids, action } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { ok: false, error: "ids array required" },
        { status: 400 }
      );
    }

    if (action === "resolve") {
      await prisma.failedCall.updateMany({
        where: { id: { in: ids } },
        data: { resolvedAt: new Date() },
      });
    } else if (action === "unresolve") {
      await prisma.failedCall.updateMany({
        where: { id: { in: ids } },
        data: { resolvedAt: null },
      });
    } else {
      return NextResponse.json(
        { ok: false, error: "action must be 'resolve' or 'unresolve'" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      updated: ids.length,
      action,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update" },
      { status: 500 }
    );
  }
}
