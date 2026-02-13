import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireAuth, isAuthError } from "@/lib/permissions";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * @api GET /api/users
 * @visibility internal
 * @scope users:list
 * @auth session
 * @tags users
 * @description Lists callers with optional personality profile inclusion. Supports pagination via limit.
 * @query withPersonality boolean - Include personality profile data
 * @query limit number - Max callers to return (default 50)
 * @response 200 { ok: true, callers: [...], count: number }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

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
