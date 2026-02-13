import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/specs
 * @visibility public
 * @scope specs:read
 * @auth session
 * @tags specs
 * @description List analysis specs with optional filtering by spec role
 * @query role string - Filter by specRole (e.g. EXTRACT, SYNTHESISE, CONSTRAIN)
 * @response 200 { ok: true, specs: AnalysisSpec[], count: number }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role");

    const where: any = { isActive: true };

    if (role) {
      where.specRole = role;
    }

    const specs = await prisma.analysisSpec.findMany({
      where,
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        specRole: true,
        isActive: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      ok: true,
      specs,
      count: specs.length,
    });
  } catch (error: any) {
    console.error("Error fetching specs:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch specs" },
      { status: 500 }
    );
  }
}
