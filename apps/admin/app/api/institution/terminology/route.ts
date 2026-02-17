import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  resolveTerminology,
  DEFAULT_TERMINOLOGY,
  DEFAULT_PRESET,
  type TerminologyConfig,
  type TerminologyPresetId,
  type TermKey,
  type TerminologyOverrides,
} from "@/lib/terminology/types";

/**
 * @api GET /api/institution/terminology
 * @auth VIEWER (any authenticated user)
 * @description Get resolved terminology for the current user's institution.
 *   Returns default terminology if user has no institution or no config.
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
      preset: DEFAULT_PRESET,
      overrides: null,
    });
  }

  const config = user.institution.terminology as TerminologyConfig | null;
  const resolved = resolveTerminology(config);

  return NextResponse.json({
    ok: true,
    terminology: resolved,
    preset: config?.preset ?? DEFAULT_PRESET,
    overrides: config?.overrides ?? null,
  });
}

const VALID_PRESETS: TerminologyPresetId[] = [
  "school",
  "corporate",
  "coaching",
  "healthcare",
];
const VALID_TERM_KEYS: TermKey[] = [
  "institution",
  "cohort",
  "learner",
  "instructor",
  "supervisor",
];

/**
 * @api PATCH /api/institution/terminology
 * @auth ADMIN (institution admin)
 * @description Update terminology config for the current user's institution.
 *   Validates preset is one of 4 valid presets. Overrides are optional per-term customizations.
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth("ADMIN");
  if (isAuthError(auth)) return auth.error;

  const { session } = auth;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { institutionId: true },
  });

  if (!user?.institutionId) {
    return NextResponse.json(
      { ok: false, error: "No institution associated with your account" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { preset, overrides } = body;

  if (!preset || !VALID_PRESETS.includes(preset)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Invalid preset. Must be one of: school, corporate, coaching, healthcare",
      },
      { status: 400 }
    );
  }

  const terminologyConfig: TerminologyConfig = { preset };

  if (overrides && typeof overrides === "object") {
    const cleanOverrides: TerminologyOverrides = {};
    for (const key of VALID_TERM_KEYS) {
      if (typeof overrides[key] === "string" && overrides[key].trim()) {
        cleanOverrides[key] = overrides[key].trim();
      }
    }
    if (Object.keys(cleanOverrides).length > 0) {
      terminologyConfig.overrides = cleanOverrides;
    }
  }

  await prisma.institution.update({
    where: { id: user.institutionId },
    data: { terminology: terminologyConfig },
  });

  const resolved = resolveTerminology(terminologyConfig);

  return NextResponse.json({
    ok: true,
    terminology: resolved,
    preset: terminologyConfig.preset,
    overrides: terminologyConfig.overrides ?? null,
  });
}
