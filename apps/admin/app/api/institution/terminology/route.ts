import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { resolveTerminology, type TermMap } from "@/lib/terminology";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  type TerminologyConfig,
  type TerminologyPresetId,
  type TerminologyOverrides,
} from "@/lib/terminology/types";

const VALID_PRESETS: TerminologyPresetId[] = [
  "school",
  "corporate",
  "coaching",
  "healthcare",
];
const VALID_LEGACY_TERM_KEYS = [
  "institution",
  "cohort",
  "learner",
  "instructor",
  "supervisor",
  "session",
] as const;

/**
 * @api GET /api/institution/terminology
 * @auth VIEWER (any authenticated user)
 * @description Get resolved terminology for the current user.
 *   Delegates to the unified two-tier resolver (role + institution type from DB).
 *   Returns both the unified TermMap and a backwards-compatible legacy format.
 */
export async function GET() {
  const auth = await requireAuth("VIEWER");
  if (isAuthError(auth)) return auth.error;

  const { session } = auth;
  const terms = await resolveTerminology(
    session.user.role,
    session.user.institutionId
  );

  // Backwards-compatible: map unified keys to legacy keys for existing consumers
  const legacyTerms = {
    institution: terms.domain,
    cohort: terms.cohort,
    learner: terms.caller,
    instructor: terms.instructor,
    supervisor: terms.instructor, // supervisor maps to instructor in unified system
    session: terms.session,
  };

  return NextResponse.json({
    ok: true,
    terminology: legacyTerms,
    terms, // unified 7-key TermMap
    preset: null, // presets are now DB-driven via InstitutionType
    overrides: null,
  });
}

/**
 * @api PATCH /api/institution/terminology
 * @auth ADMIN (institution admin)
 * @description Update legacy terminology config for the current user's institution.
 *   @deprecated Use /api/admin/institution-types to manage terminology instead.
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
    for (const key of VALID_LEGACY_TERM_KEYS) {
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
    data: { terminology: terminologyConfig as unknown as Prisma.InputJsonValue },
  });

  // Return unified terms from the new system
  const terms = await resolveTerminology(
    session.user.role,
    user.institutionId
  );

  return NextResponse.json({
    ok: true,
    terminology: {
      institution: terms.domain,
      cohort: terms.cohort,
      learner: terms.caller,
      instructor: terms.instructor,
      supervisor: terms.instructor,
      session: terms.session,
    },
    terms,
    preset: terminologyConfig.preset,
    overrides: terminologyConfig.overrides ?? null,
  });
}
