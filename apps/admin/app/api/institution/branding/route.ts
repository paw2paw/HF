import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { DEFAULT_BRANDING } from "@/lib/branding";

/**
 * @api GET /api/institution/branding
 * @auth VIEWER (any authenticated user)
 * @description Get branding for the current user's institution.
 *   Returns default branding if user has no institution.
 */
export async function GET() {
  const auth = await requireAuth("VIEWER");
  if (isAuthError(auth)) return auth.error;

  const { session } = auth;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      institution: {
        select: {
          name: true,
          logoUrl: true,
          primaryColor: true,
          secondaryColor: true,
          welcomeMessage: true,
        },
      },
    },
  });

  if (!user?.institution) {
    return NextResponse.json({ ok: true, branding: DEFAULT_BRANDING });
  }

  return NextResponse.json({
    ok: true,
    branding: {
      name: user.institution.name,
      logoUrl: user.institution.logoUrl,
      primaryColor: user.institution.primaryColor,
      secondaryColor: user.institution.secondaryColor,
      welcomeMessage: user.institution.welcomeMessage,
    },
  });
}
