import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/user/institutions
 * @visibility internal
 * @scope user:read
 * @auth bearer
 * @tags user, institutions
 * @description Get institutions the current user can access
 * - SUPERADMIN: all active institutions
 * - ADMIN/OPERATOR: their assigned institution only
 * - EDUCATOR/TESTER: their assigned institution
 * - Others: their assigned institution
 * @response { institutions: Array<{ id, name, slug, logoUrl, primaryColor }> }
 */
export async function GET() {
  const authResult = await requireAuth("VIEWER");
  if (isAuthError(authResult)) return authResult.error;
  const { session } = authResult;

  const roleLevel: Record<string, number> = {
    SUPERADMIN: 5,
    ADMIN: 4,
    OPERATOR: 3,
  };

  const isSuperAdmin = (roleLevel[session.user.role] ?? 0) >= 5;

  let institutions;

  if (isSuperAdmin) {
    // SUPERADMIN sees all active institutions
    institutions = await prisma.institution.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        primaryColor: true,
      },
      orderBy: { name: "asc" },
    });
  } else {
    // Other users see only their assigned institution
    if (!session.user.institutionId) {
      // No institution assigned — return empty list
      return NextResponse.json({ institutions: [] });
    }

    institutions = await prisma.institution.findMany({
      where: { id: session.user.institutionId, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        primaryColor: true,
      },
    });
  }

  return NextResponse.json({ institutions });
}
