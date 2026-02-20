import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { resolveTerminology } from "@/lib/terminology";

/**
 * @api GET /api/terminology
 * @auth VIEWER (any authenticated user)
 * @description Returns resolved terminology for the current user.
 *   ADMIN/SUPERADMIN/SUPER_TESTER → technical terms (Domain, Playbook, etc.)
 *   All other roles → institution type's terminology from DB.
 */
export async function GET() {
  const auth = await requireAuth("VIEWER");
  if (isAuthError(auth)) return auth.error;

  const { session } = auth;
  const terms = await resolveTerminology(
    session.user.role,
    session.user.institutionId
  );

  return NextResponse.json({ ok: true, terms });
}
