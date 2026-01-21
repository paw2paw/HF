import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const controlSets = await prisma.controlSet.findMany({
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      take: 100,
      include: {
        promptTemplate: {
          select: { name: true },
        },
        _count: {
          select: {
            parameters: true,
            calls: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, controlSets, count: controlSets.length });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch control sets" },
      { status: 500 }
    );
  }
}
