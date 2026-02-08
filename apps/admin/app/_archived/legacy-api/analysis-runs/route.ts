import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const status = url.searchParams.get("status");

    const runs = await prisma.analysisRun.findMany({
      where: status ? { status } : undefined,
      orderBy: { startedAt: "desc" },
      take: limit,
      include: {
        analysisProfile: {
          select: {
            name: true,
            _count: { select: { parameters: true } },
          },
        },
        _count: {
          select: { scores: true },
        },
      },
    });

    return NextResponse.json({ ok: true, runs, count: runs.length });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch analysis runs" },
      { status: 500 }
    );
  }
}
