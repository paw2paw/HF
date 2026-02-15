import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEntityAccess, isEntityAuthError } from "@/lib/access-control";

/**
 * @api GET /api/callers/:callerId/cohorts
 * @visibility public
 * @scope cohorts:read
 * @auth session
 * @tags cohorts, callers
 * @description List cohort groups owned by a caller (teacher/tutor).
 * @pathParam callerId string - Caller ID (the teacher/tutor)
 * @response 200 { ok: true, cohorts: CohortGroup[] }
 * @response 404 { ok: false, error: "Caller not found" }
 * @response 500 { ok: false, error: "Failed to fetch cohorts" }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ callerId: string }> }
) {
  try {
    const authResult = await requireEntityAccess("cohorts", "R");
    if (isEntityAuthError(authResult)) return authResult.error;

    const { callerId } = await params;

    // Verify caller exists
    const caller = await prisma.caller.findUnique({
      where: { id: callerId },
      select: { id: true, role: true },
    });

    if (!caller) {
      return NextResponse.json(
        { ok: false, error: "Caller not found" },
        { status: 404 }
      );
    }

    const cohorts = await prisma.cohortGroup.findMany({
      where: { ownerId: callerId },
      include: {
        domain: { select: { id: true, slug: true, name: true } },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, cohorts });
  } catch (error: any) {
    console.error("Error fetching caller cohorts:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch cohorts" },
      { status: 500 }
    );
  }
}
