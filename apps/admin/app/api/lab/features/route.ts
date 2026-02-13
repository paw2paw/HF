import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/lab/features
 * @visibility internal
 * @scope lab:read
 * @auth session
 * @tags lab
 * @description List compiled BDD feature sets with optional active filter and limit
 * @query limit number - Max results (default: 50)
 * @query active string - Filter by active status ("true" or "false")
 * @response 200 { ok: true, features: BDDFeatureSet[] }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

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
      orderBy: { featureId: "asc" },
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
