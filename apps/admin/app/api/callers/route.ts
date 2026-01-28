import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/callers
 *
 * List all callers with optional personality and counts
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const withPersonality = url.searchParams.get("withPersonality") === "true";
    const withCounts = url.searchParams.get("withCounts") === "true";
    const limit = Math.min(500, parseInt(url.searchParams.get("limit") || "100"));
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Fetch callers with basic counts, plus their linked CallerIdentity (which has nextPrompt)
    const callers = await prisma.caller.findMany({
      take: limit,
      skip: offset,
      include: {
        personality: withPersonality,
        domain: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
        callerIdentities: {
          take: 1, // Get the first CallerIdentity linked to this caller
          select: {
            id: true,
            nextPrompt: true,
            nextPromptComposedAt: true,
          },
        },
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

    // Flatten the callerIdentity data onto the caller object for easier consumption
    const callersWithPrompt = callers.map((caller) => {
      const identity = caller.callerIdentities[0];
      return {
        ...caller,
        callerIdentities: undefined, // Remove the nested array
        nextPrompt: identity?.nextPrompt || null,
        nextPromptComposedAt: identity?.nextPromptComposedAt || null,
      };
    });

    // If counts requested, add memory counts separately
    // (workaround for Prisma client caching issues)
    if (withCounts && callersWithPrompt.length > 0) {
      const callerIds = callersWithPrompt.map((c) => c.id);
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

      // Augment callers with memory count
      for (const caller of callersWithPrompt) {
        (caller as any)._count = {
          ...(caller as any)._count,
          memories: memoryCountMap.get(caller.id) || 0,
        };
      }
    }

    const total = await prisma.caller.count();

    return NextResponse.json({
      ok: true,
      callers: callersWithPrompt,
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
