import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { auditLog, AuditAction } from "@/lib/audit";

/**
 * @api PATCH /api/user/active-institution
 * @visibility internal
 * @scope user:write
 * @auth bearer
 * @tags user, institutions
 * @body { institutionId: string }
 * @description Set the active institution for this user (persisted preference)
 * Only allows setting to an institution the user can access
 * @response { institution: { id, name, slug, logoUrl, primaryColor } }
 */
export async function PATCH(request: Request) {
  const authResult = await requireAuth("VIEWER");
  if (isAuthError(authResult)) return authResult.error;
  const { session } = authResult;

  const body = await request.json();
  const { institutionId } = body as { institutionId?: string };

  if (!institutionId) {
    return NextResponse.json(
      { error: "institutionId is required" },
      { status: 400 }
    );
  }

  // Validate user can access this institution
  const roleLevel: Record<string, number> = {
    SUPERADMIN: 5,
    ADMIN: 4,
    OPERATOR: 3,
  };
  const isSuperAdmin = (roleLevel[session.user.role] ?? 0) >= 5;

  if (!isSuperAdmin && session.user.institutionId !== institutionId) {
    return NextResponse.json(
      { error: "You cannot switch to an institution you are not a member of" },
      { status: 403 }
    );
  }

  // Verify institution exists and is active
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      primaryColor: true,
      isActive: true,
    },
  });

  if (!institution || !institution.isActive) {
    return NextResponse.json(
      { error: "Institution not found or inactive" },
      { status: 404 }
    );
  }

  // Update user's active institution
  await prisma.user.update({
    where: { id: session.user.id },
    data: { activeInstitutionId: institutionId },
  });

  // Audit log
  await auditLog({
    userId: session.user.id,
    userEmail: session.user.email,
    action: "switched_institution",
    entityType: "Institution",
    entityId: institutionId,
    metadata: {
      institutionName: institution.name,
    },
  });

  return NextResponse.json({ institution });
}
