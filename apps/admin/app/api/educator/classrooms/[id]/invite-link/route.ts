import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireEducator,
  isEducatorAuthError,
  requireEducatorCohortOwnership,
} from "@/lib/educator-access";
import { randomBytes } from "crypto";

/** 30-day default expiry for join tokens */
const JOIN_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * @api GET /api/educator/classrooms/[id]/invite-link
 * @visibility internal
 * @scope educator:read
 * @auth bearer
 * @tags educator, classrooms, invites
 * @description Get the magic join token for a classroom. Generates one if none exists. Requires educator ownership of the cohort.
 * @response 200 { ok: true, joinToken: string }
 * @response 403 { ok: false, error: "Not authorized" }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEducator();
  if (isEducatorAuthError(auth)) return auth.error;

  const { id } = await params;
  const ownership = await requireEducatorCohortOwnership(id, auth.callerId);
  if ("error" in ownership) return ownership.error;

  let joinToken = (ownership.cohort as any).joinToken;

  // Generate token if none exists
  if (!joinToken) {
    joinToken = randomBytes(16).toString("hex"); // 32 hex chars = 128 bits
    await prisma.cohortGroup.update({
      where: { id },
      data: { joinToken, joinTokenExp: new Date(Date.now() + JOIN_TOKEN_EXPIRY_MS) },
    });
  }

  return NextResponse.json({
    ok: true,
    joinToken,
  });
}

/**
 * @api POST /api/educator/classrooms/[id]/invite-link
 * @visibility internal
 * @scope educator:write
 * @auth bearer
 * @tags educator, classrooms, invites
 * @description Regenerate the magic join token for a classroom, invalidating the previous link. Requires educator ownership of the cohort.
 * @response 200 { ok: true, joinToken: string }
 * @response 403 { ok: false, error: "Not authorized" }
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEducator();
  if (isEducatorAuthError(auth)) return auth.error;

  const { id } = await params;
  const ownership = await requireEducatorCohortOwnership(id, auth.callerId);
  if ("error" in ownership) return ownership.error;

  const joinToken = randomBytes(16).toString("hex"); // 32 hex chars = 128 bits
  await prisma.cohortGroup.update({
    where: { id },
    data: { joinToken, joinTokenExp: new Date(Date.now() + JOIN_TOKEN_EXPIRY_MS) },
  });

  return NextResponse.json({
    ok: true,
    joinToken,
  });
}
