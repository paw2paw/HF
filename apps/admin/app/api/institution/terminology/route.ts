import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  resolveTerminology,
  DEFAULT_TERMINOLOGY,
  type TerminologyConfig,
} from "@/lib/terminology/types";

/**
 * @api GET /api/institution/terminology
 * @auth VIEWER (any authenticated user)
 * @description Get resolved terminology for the current user's institution.
 *   Returns default (school) terminology if user has no institution or no config.
 */
export async function GET() {
  const auth = await requireAuth("VIEWER");
  if (isAuthError(auth)) return auth.error;

  const { session } = auth;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      institution: {
        select: { terminology: true },
      },
    },
  });

  if (!user?.institution) {
    return NextResponse.json({
      ok: true,
      terminology: DEFAULT_TERMINOLOGY,
      preset: "school",
      overrides: null,
    });
  }

  const config = user.institution.terminology as TerminologyConfig | null;
  const resolved = resolveTerminology(config);

  return NextResponse.json({
    ok: true,
    terminology: resolved,
    preset: config?.preset ?? "school",
    overrides: config?.overrides ?? null,
  });
}
