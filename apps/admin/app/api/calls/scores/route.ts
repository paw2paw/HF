import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");

    const scores = await prisma.callScore.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        call: {
          select: { source: true, transcript: true },
        },
        parameter: {
          select: { name: true, parameterId: true },
        },
        run: {
          select: { status: true },
        },
      },
    });

    return NextResponse.json({ ok: true, scores, count: scores.length });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch call scores" },
      { status: 500 }
    );
  }
}
