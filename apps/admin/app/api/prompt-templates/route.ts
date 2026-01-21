import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const templates = await prisma.promptTemplate.findMany({
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      take: 100,
      include: {
        _count: {
          select: { controlSets: true },
        },
      },
    });

    return NextResponse.json({ ok: true, templates, count: templates.length });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch prompt templates" },
      { status: 500 }
    );
  }
}
