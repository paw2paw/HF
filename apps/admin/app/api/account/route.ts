import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/account
 * @visibility public
 * @scope account:read
 * @auth session
 * @tags account
 * @description Get the authenticated user's own profile
 * @response 200 { ok: true, user: object }
 */
export async function GET() {
  const authResult = await requireAuth("VIEWER", { skipMasquerade: true });
  if (isAuthError(authResult)) return authResult.error;

  const user = await prisma.user.findUnique({
    where: { id: authResult.session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      displayName: true,
      image: true,
      role: true,
      isActive: true,
      createdAt: true,
      assignedDomainId: true,
      assignedDomain: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, user });
}

/**
 * @api PATCH /api/account
 * @visibility public
 * @scope account:write
 * @auth session
 * @tags account
 * @description Update the authenticated user's own display name and name
 * @body { displayName?: string, name?: string }
 * @response 200 { ok: true, user: object }
 */
export async function PATCH(req: Request) {
  const authResult = await requireAuth("VIEWER", { skipMasquerade: true });
  if (isAuthError(authResult)) return authResult.error;

  const body = await req.json();
  const { displayName, name } = body;

  const user = await prisma.user.update({
    where: { id: authResult.session.user.id },
    data: {
      ...(displayName !== undefined ? { displayName } : {}),
      ...(name !== undefined ? { name } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      displayName: true,
      image: true,
      role: true,
    },
  });

  return NextResponse.json({ ok: true, user });
}
