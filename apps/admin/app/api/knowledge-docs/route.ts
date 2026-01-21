import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const status = url.searchParams.get("status");

    const where: any = {};
    if (id) {
      where.id = id;
    }
    if (status) {
      where.status = status;
    }

    const docs = await prisma.knowledgeDoc.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });

    return NextResponse.json({ ok: true, docs, count: docs.length });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch knowledge docs" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
