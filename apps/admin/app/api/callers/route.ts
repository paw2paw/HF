import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/callers
 *
 * List all callers (users) with optional personality and counts
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const withPersonality = url.searchParams.get("withPersonality") === "true";
    const withCounts = url.searchParams.get("withCounts") === "true";
    const limit = Math.min(500, parseInt(url.searchParams.get("limit") || "100"));
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Fetch callers with basic counts (calls and observations are always available)
    const callers = await prisma.user.findMany({
      take: limit,
      skip: offset,
      include: {
        personality: withPersonality,
        _count: withCounts
          ? {
              select: {
                calls: true,
                personalityObservations: true,
              },
            }
          : undefined,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // If counts requested, add memory counts separately
    // (workaround for Prisma client caching issues)
    if (withCounts && callers.length > 0) {
      const userIds = callers.map((c) => c.id);
      const memoryCounts = await prisma.userMemory.groupBy({
        by: ["userId"],
        where: {
          userId: { in: userIds },
          supersededById: null,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        _count: { id: true },
      });

      const memoryCountMap = new Map(
        memoryCounts.map((mc) => [mc.userId, mc._count.id])
      );

      // Augment callers with memory count
      for (const caller of callers) {
        (caller as any)._count = {
          ...(caller as any)._count,
          memories: memoryCountMap.get(caller.id) || 0,
        };
      }
    }

    const total = await prisma.user.count();

    return NextResponse.json({
      ok: true,
      callers,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("Error fetching callers:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch callers" },
      { status: 500 }
    );
  }
}
