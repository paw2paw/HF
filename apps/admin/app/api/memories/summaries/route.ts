import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/memories/summaries
 *
 * List user memory summaries with filtering and pagination
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const callerId = url.searchParams.get("callerId");
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50"));
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const where: any = {};

    if (callerId) {
      where.callerId = callerId;
    }

    const [summaries, total] = await Promise.all([
      prisma.callerMemorySummary.findMany({
        where,
        orderBy: [{ lastMemoryAt: "desc" }],
        take: limit,
        skip: offset,
        include: {
          caller: {
            select: { id: true, name: true, email: true, externalId: true },
          },
        },
      }),
      prisma.callerMemorySummary.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      summaries,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("Error fetching memory summaries:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch memory summaries" },
      { status: 500 }
    );
  }
}
