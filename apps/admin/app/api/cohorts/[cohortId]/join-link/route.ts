import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEntityAccess, isEntityAuthError } from "@/lib/access-control";
import {
  requireCohortOwnership,
  isCohortOwnershipError,
} from "@/lib/cohort-access";
import { randomUUID } from "crypto";

/**
 * @api GET /api/cohorts/:cohortId/join-link
 * @visibility public
 * @scope cohorts:read
 * @auth session
 * @tags cohorts
 * @description Get the magic join link for a cohort. Generates one if none exists.
 * @pathParam cohortId string - Cohort group ID
 * @response 200 { ok: true, joinToken }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ cohortId: string }> }
) {
  try {
    const authResult = await requireEntityAccess("cohorts", "R");
    if (isEntityAuthError(authResult)) return authResult.error;
    const { scope, session } = authResult;

    const { cohortId } = await params;

    const ownershipResult = await requireCohortOwnership(
      cohortId,
      session,
      scope
    );
    if (isCohortOwnershipError(ownershipResult)) return ownershipResult.error;

    // Get current token from DB
    const cohort = await prisma.cohortGroup.findUnique({
      where: { id: cohortId },
      select: { joinToken: true },
    });

    let joinToken = cohort?.joinToken;

    // Generate if none exists
    if (!joinToken) {
      joinToken = randomUUID().replace(/-/g, "").slice(0, 12);
      await prisma.cohortGroup.update({
        where: { id: cohortId },
        data: { joinToken },
      });
    }

    return NextResponse.json({ ok: true, joinToken });
  } catch (error: any) {
    console.error("Error getting join link:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to get join link" },
      { status: 500 }
    );
  }
}

/**
 * @api POST /api/cohorts/:cohortId/join-link
 * @visibility public
 * @scope cohorts:update
 * @auth session
 * @tags cohorts
 * @description Regenerate the magic join link for a cohort.
 * @pathParam cohortId string - Cohort group ID
 * @response 200 { ok: true, joinToken }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ cohortId: string }> }
) {
  try {
    const authResult = await requireEntityAccess("cohorts", "U");
    if (isEntityAuthError(authResult)) return authResult.error;
    const { scope, session } = authResult;

    const { cohortId } = await params;

    const ownershipResult = await requireCohortOwnership(
      cohortId,
      session,
      scope
    );
    if (isCohortOwnershipError(ownershipResult)) return ownershipResult.error;

    const joinToken = randomUUID().replace(/-/g, "").slice(0, 12);
    await prisma.cohortGroup.update({
      where: { id: cohortId },
      data: { joinToken },
    });

    return NextResponse.json({ ok: true, joinToken });
  } catch (error: any) {
    console.error("Error regenerating join link:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to regenerate join link" },
      { status: 500 }
    );
  }
}

/**
 * @api DELETE /api/cohorts/:cohortId/join-link
 * @visibility public
 * @scope cohorts:update
 * @auth session
 * @tags cohorts
 * @description Revoke the magic join link for a cohort.
 * @pathParam cohortId string - Cohort group ID
 * @response 200 { ok: true, message: "Join link revoked" }
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ cohortId: string }> }
) {
  try {
    const authResult = await requireEntityAccess("cohorts", "U");
    if (isEntityAuthError(authResult)) return authResult.error;
    const { scope, session } = authResult;

    const { cohortId } = await params;

    const ownershipResult = await requireCohortOwnership(
      cohortId,
      session,
      scope
    );
    if (isCohortOwnershipError(ownershipResult)) return ownershipResult.error;

    await prisma.cohortGroup.update({
      where: { id: cohortId },
      data: { joinToken: null, joinTokenExp: null },
    });

    return NextResponse.json({ ok: true, message: "Join link revoked" });
  } catch (error: any) {
    console.error("Error revoking join link:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to revoke join link" },
      { status: 500 }
    );
  }
}
