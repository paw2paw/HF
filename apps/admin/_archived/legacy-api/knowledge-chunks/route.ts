import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const docId = url.searchParams.get("docId");
    const search = url.searchParams.get("search");
    const hasEmbedding = url.searchParams.get("hasEmbedding");
    const limit = Math.min(500, parseInt(url.searchParams.get("limit") || "100"));
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const where: any = {};
    if (docId) {
      where.docId = docId;
    }
    if (search) {
      where.content = { contains: search, mode: "insensitive" };
    }
    if (hasEmbedding === "true") {
      where.embedding = { isNot: null };
    } else if (hasEmbedding === "false") {
      where.embedding = null;
    }

    const [chunks, total] = await Promise.all([
      prisma.knowledgeChunk.findMany({
        where,
        orderBy: [{ docId: "asc" }, { chunkIndex: "asc" }],
        take: limit,
        skip: offset,
        include: {
          doc: {
            select: { title: true, sourcePath: true },
          },
          embedding: {
            select: { id: true },
          },
        },
      }),
      prisma.knowledgeChunk.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      chunks,
      total,
      limit,
      offset,
      docId: docId || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch knowledge chunks" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
