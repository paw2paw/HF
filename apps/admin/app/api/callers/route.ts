import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/callers
 *
 * List all callers with optional counts
 * Note: The Caller model is minimal - most data lives on related User model
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const withCounts = url.searchParams.get("withCounts") === "true";
    const limit = Math.min(500, parseInt(url.searchParams.get("limit") || "100"));
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Fetch callers with available relations
    const callers = await prisma.caller.findMany({
      take: limit,
      skip: offset,
      include: {
        domain: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
        personality: {
          select: {
            openness: true,
            conscientiousness: true,
            extraversion: true,
            agreeableness: true,
            neuroticism: true,
            preferredTone: true,
            preferredLength: true,
            technicalLevel: true,
            confidenceScore: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform to flatten nested data
    const callersFlattened = callers.map((caller) => ({
      id: caller.id,
      name: caller.name || null,
      email: caller.email || null,
      phone: caller.phone || null,
      externalId: caller.externalId,
      domainId: caller.domainId || null,
      domain: caller.domain || null,
      personality: caller.personality || null,
      createdAt: caller.createdAt,
    }));

    // If counts requested, fetch related counts
    if (withCounts && callersFlattened.length > 0) {
      const callerIds = callersFlattened.map((c) => c.id);

      // Get memory counts
      const memoryCounts = await prisma.callerMemory.groupBy({
        by: ["callerId"],
        where: {
          callerId: { in: callerIds },
          supersededById: null,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        _count: { id: true },
      });

      const memoryCountMap = new Map(
        memoryCounts.map((mc) => [mc.callerId, mc._count.id])
      );

      // Get call counts
      const callCounts = await prisma.call.groupBy({
        by: ["callerId"],
        where: {
          callerId: { in: callerIds },
        },
        _count: { id: true },
      });

      const callCountMap = new Map(
        callCounts.map((cc) => [cc.callerId, cc._count.id])
      );

      // Augment callers with counts
      for (let i = 0; i < callersFlattened.length; i++) {
        const caller = callers[i];
        (callersFlattened[i] as any)._count = {
          memories: memoryCountMap.get(caller.id) || 0,
          calls: callCountMap.get(caller.id) || 0,
        };
      }
    } else {
      // Default counts when withCounts is false
      for (const caller of callersFlattened) {
        (caller as any)._count = {
          memories: 0,
          calls: 0,
        };
      }
    }

    const total = await prisma.caller.count();

    return NextResponse.json({
      ok: true,
      callers: callersFlattened,
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
