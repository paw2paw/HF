import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * GET /api/users
 *
 * Query params:
 * - withPersonality: Include personality profile
 * - limit: Max users to return (default 50)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const withPersonality = url.searchParams.get("withPersonality") === "true";
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const users = await prisma.user.findMany({
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
      users,
      count: users.length,
    });
  } catch (err: any) {
    console.error("[Users API Error]:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to fetch users" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
