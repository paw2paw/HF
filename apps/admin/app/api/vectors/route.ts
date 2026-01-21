import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Get total count
    const totalEmbeddings = await prisma.vectorEmbedding.count();

    // Get counts by model
    const modelCounts = await prisma.vectorEmbedding.groupBy({
      by: ["model"],
      _count: { _all: true },
    });
    const byModel: Record<string, number> = {};
    for (const m of modelCounts) {
      byModel[m.model] = m._count._all;
    }

    // Get counts by dimensions
    const dimCounts = await prisma.vectorEmbedding.groupBy({
      by: ["dimensions"],
      _count: { _all: true },
    });
    const byDimensions: Record<string, number> = {};
    for (const d of dimCounts) {
      byDimensions[String(d.dimensions)] = d._count._all;
    }

    // Get recent embeddings with chunk info
    const recentEmbeddings = await prisma.vectorEmbedding.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        chunk: {
          select: {
            content: true,
            doc: {
              select: { title: true, sourcePath: true },
            },
          },
        },
      },
    });

    const stats = {
      totalEmbeddings,
      byModel,
      byDimensions,
      recentEmbeddings,
    };

    return NextResponse.json({ ok: true, stats });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch vector stats" },
      { status: 500 }
    );
  }
}
