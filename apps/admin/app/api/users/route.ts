import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * GET /api/callers
 *
 * Query params:
 * - withPersonality: Include personality profile
 * - limit: Max callers to return (default 50)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const withPersonality = url.searchParams.get("withPersonality") === "true";
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const callers = await prisma.caller.findMany({
      take: limit,
      include: {
        personality: withPersonality,
        _count: {
          select: {
            calls: true,
            personalityObservations: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      ok: true,
      callers,
      count: callers.length,
    });
  } catch (err: any) {
    console.error("[Callers API Error]:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to fetch callers" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
