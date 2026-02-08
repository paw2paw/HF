import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");

    const scores = await prisma.rewardScore.findMany({
      orderBy: { scoredAt: "desc" },
      take: limit,
      include: {
        call: {
          select: { source: true, transcript: true },
        },
      },
    });

    return NextResponse.json({ ok: true, scores, count: scores.length });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch reward scores" },
      { status: 500 }
    );
  }
}
