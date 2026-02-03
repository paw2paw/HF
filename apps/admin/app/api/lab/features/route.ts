import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/lab/features
 *
 * List compiled BDD feature sets
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const active = url.searchParams.get("active");

    const where: any = {};
    if (active === "true") {
      where.isActive = true;
    } else if (active === "false") {
      where.isActive = false;
    }

    const features = await prisma.bDDFeatureSet.findMany({
      where,
      orderBy: { compiledAt: "desc" },
      take: limit,
      select: {
        id: true,
        featureId: true,
        name: true,
        description: true,
        version: true,
        parameterCount: true,
        constraintCount: true,
        definitionCount: true,
        isActive: true,
        activatedAt: true,
        compiledAt: true,
        lastTestAt: true,
        lastTestResult: true,
        _count: {
          select: { uploads: true },
        },
      },
    });

    return NextResponse.json({ ok: true, features });
  } catch (error: any) {
    console.error("Error fetching BDD features:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch features" },
      { status: 500 }
    );
  }
}
