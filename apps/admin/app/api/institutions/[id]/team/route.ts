import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * @api GET /api/institutions/[id]/team
 * @auth ADMIN
 * @description List all users (team members) belonging to an institution.
 * @response 200 { ok: true, team: TeamMember[] }
 * @response 404 { ok: false, error: "Institution not found" }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("ADMIN");
  if (isAuthError(auth)) return auth.error;

  const { id } = await params;

  const institution = await prisma.institution.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!institution) {
    return NextResponse.json({ ok: false, error: "Institution not found" }, { status: 404 });
  }

  const users = await prisma.user.findMany({
    where: { institutionId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  const team = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  }));

  return NextResponse.json({ ok: true, team });
}
