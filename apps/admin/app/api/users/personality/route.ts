import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const profiles = await prisma.callerPersonality.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        caller: {
          select: {
            name: true,
            email: true,
            externalId: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, profiles, count: profiles.length });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch personality profiles" },
      { status: 500 }
    );
  }
}
