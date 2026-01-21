import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");

    const calls = await prisma.call.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        controlSet: {
          select: { name: true },
        },
        _count: {
          select: { scores: true },
        },
      },
    });

    return NextResponse.json({ ok: true, calls, count: calls.length });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch calls" },
      { status: 500 }
    );
  }
}
