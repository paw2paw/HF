import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireAuth, isAuthError } from "@/lib/permissions";

const prisma = new PrismaClient();

/**
 * @api GET /api/users/personality
 * @visibility internal
 * @scope users:personality
 * @auth session
 * @tags users
 * @description Returns the most recent 100 caller personality profiles with associated caller details (name, email, externalId).
 * @response 200 { ok: true, profiles: [...], count: number }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET() {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

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
