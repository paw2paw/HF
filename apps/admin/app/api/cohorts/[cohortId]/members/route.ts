import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEntityAccess, isEntityAuthError } from "@/lib/access-control";
import {
  requireCohortOwnership,
  isCohortOwnershipError,
} from "@/lib/cohort-access";
import { enrollCallerInCohortPlaybooks } from "@/lib/enrollment";

/**
 * @api POST /api/cohorts/:cohortId/members
 * @visibility public
 * @scope cohorts:update
 * @auth session
 * @tags cohorts
 * @description Add callers to a cohort group. Validates all callers exist and belong to the same domain.
 * @pathParam cohortId string - Cohort group ID
 * @body callerIds string[] - Array of caller IDs to add
 * @response 200 { ok: true, added: number }
 * @response 400 { ok: false, error: "..." }
 * @response 404 { ok: false, error: "Cohort not found" }
 * @response 500 { ok: false, error: "Failed to add members" }
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
    const { cohort } = ownershipResult;

    const body = await req.json();
    const { callerIds } = body;

    if (!Array.isArray(callerIds) || callerIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "callerIds array is required" },
        { status: 400 }
      );
    }

    // Check max members limit
    const currentCount = cohort._count.members;
    if (currentCount + callerIds.length > cohort.maxMembers) {
      return NextResponse.json(
        {
          ok: false,
          error: `Would exceed max members (${cohort.maxMembers}). Current: ${currentCount}, adding: ${callerIds.length}`,
        },
        { status: 400 }
      );
    }

    // Validate all callers exist and belong to the same domain
    const callers = await prisma.caller.findMany({
      where: { id: { in: callerIds } },
      select: { id: true, domainId: true, role: true, cohortGroupId: true },
    });

    if (callers.length !== callerIds.length) {
      const foundIds = new Set(callers.map((c) => c.id));
      const missing = callerIds.filter((id: string) => !foundIds.has(id));
      return NextResponse.json(
        { ok: false, error: `Callers not found: ${missing.join(", ")}` },
        { status: 404 }
      );
    }

    // Check domain match
    const wrongDomain = callers.filter((c) => c.domainId !== cohort.domainId);
    if (wrongDomain.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Callers must belong to domain ${cohort.domain.slug}: ${wrongDomain.map((c) => c.id).join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Create cohort memberships via join table (multi-cohort — no "already in another cohort" block)
    // Also write legacy FK for backwards compat during migration
    let added = 0;
    for (const cid of callerIds) {
      await prisma.callerCohortMembership.upsert({
        where: { callerId_cohortGroupId: { callerId: cid, cohortGroupId: cohortId } },
        create: { callerId: cid, cohortGroupId: cohortId },
        update: {},
      });
      // Legacy FK — keep in sync until migration complete
      await prisma.caller.update({
        where: { id: cid },
        data: { cohortGroupId: cohortId },
      });
      added++;
    }

    // Auto-enroll added callers in cohort's assigned playbooks
    for (const cid of callerIds) {
      await enrollCallerInCohortPlaybooks(cid, cohortId, cohort.domainId, "cohort-add");
    }

    return NextResponse.json({ ok: true, added });
  } catch (error: any) {
    console.error("Error adding cohort members:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to add members" },
      { status: 500 }
    );
  }
}

/**
 * @api DELETE /api/cohorts/:cohortId/members
 * @visibility public
 * @scope cohorts:update
 * @auth session
 * @tags cohorts
 * @description Remove callers from a cohort group. Deletes their CallerCohortMembership record.
 * @pathParam cohortId string - Cohort group ID
 * @body callerIds string[] - Array of caller IDs to remove
 * @response 200 { ok: true, removed: number }
 * @response 400 { ok: false, error: "callerIds array is required" }
 * @response 404 { ok: false, error: "Cohort not found" }
 * @response 500 { ok: false, error: "Failed to remove members" }
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

    const body = await req.json();
    const { callerIds } = body;

    if (!Array.isArray(callerIds) || callerIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "callerIds array is required" },
        { status: 400 }
      );
    }

    // Remove memberships from join table
    const result = await prisma.callerCohortMembership.deleteMany({
      where: {
        callerId: { in: callerIds },
        cohortGroupId: cohortId,
      },
    });

    // Legacy FK cleanup — null out cohortGroupId if it points to this cohort
    await prisma.caller.updateMany({
      where: {
        id: { in: callerIds },
        cohortGroupId: cohortId,
      },
      data: { cohortGroupId: null },
    });

    return NextResponse.json({ ok: true, removed: result.count });
  } catch (error: any) {
    console.error("Error removing cohort members:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to remove members" },
      { status: 500 }
    );
  }
}
