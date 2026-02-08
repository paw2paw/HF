import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const type = url.searchParams.get("type");

    const artifacts = await prisma.knowledgeArtifact.findMany({
      where: type ? { type: type as any } : undefined,
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: {
        parameter: {
          select: { name: true, parameterId: true },
        },
      },
    });

    return NextResponse.json({ ok: true, artifacts, count: artifacts.length });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch knowledge artifacts" },
      { status: 500 }
    );
  }
}
