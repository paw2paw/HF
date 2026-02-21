import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEntityAccess, isEntityAuthError } from "@/lib/access-control";
import {
  requireCohortOwnership,
  isCohortOwnershipError,
} from "@/lib/cohort-access";

/**
 * @api GET /api/cohorts/:cohortId
 * @visibility public
 * @scope cohorts:read
 * @auth session
 * @tags cohorts
 * @description Get cohort detail with member list.
 * @pathParam cohortId string - Cohort group ID
 * @response 200 { ok: true, cohort: CohortGroup, members: Caller[] }
 * @response 404 { ok: false, error: "Cohort not found" }
 * @response 500 { ok: false, error: "Failed to fetch cohort" }
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
    const { cohort } = ownershipResult;

    // Fetch members via join table with summary stats
    const memberships = await prisma.callerCohortMembership.findMany({
      where: { cohortGroupId: cohortId },
      include: {
        caller: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            archivedAt: true,
            createdAt: true,
            _count: {
              select: {
                calls: true,
                goals: true,
                memories: true,
              },
            },
          },
        },
      },
    });
    const members = memberships
      .map((m) => m.caller)
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

    return NextResponse.json({ ok: true, cohort, members });
  } catch (error: any) {
    console.error("Error fetching cohort:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch cohort" },
      { status: 500 }
    );
  }
}

/**
 * @api PATCH /api/cohorts/:cohortId
 * @visibility public
 * @scope cohorts:update
 * @auth session
 * @tags cohorts
 * @description Update cohort name, description, maxMembers, or isActive.
 * @pathParam cohortId string - Cohort group ID
 * @body name string - New name (optional)
 * @body description string - New description (optional)
 * @body maxMembers number - New max member count (optional)
 * @body isActive boolean - Active status (optional)
 * @response 200 { ok: true, cohort: CohortGroup }
 * @response 404 { ok: false, error: "Cohort not found" }
 * @response 500 { ok: false, error: "Failed to update cohort" }
 */
export async function PATCH(
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
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.maxMembers !== undefined) updateData.maxMembers = body.maxMembers;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const cohort = await prisma.cohortGroup.update({
      where: { id: cohortId },
      data: updateData,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        domain: { select: { id: true, slug: true, name: true } },
        _count: { select: { members: true } },
      },
    });

    return NextResponse.json({ ok: true, cohort });
  } catch (error: any) {
    console.error("Error updating cohort:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update cohort" },
      { status: 500 }
    );
  }
}

/**
 * @api DELETE /api/cohorts/:cohortId
 * @visibility public
 * @scope cohorts:delete
 * @auth session
 * @tags cohorts
 * @description Delete a cohort group. Removes member assignments first, then deletes the group.
 * @pathParam cohortId string - Cohort group ID
 * @response 200 { ok: true, message: "Cohort deleted" }
 * @response 404 { ok: false, error: "Cohort not found" }
 * @response 500 { ok: false, error: "Failed to delete cohort" }
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ cohortId: string }> }
) {
  try {
    const authResult = await requireEntityAccess("cohorts", "D");
    if (isEntityAuthError(authResult)) return authResult.error;
    const { scope, session } = authResult;

    const { cohortId } = await params;

    const ownershipResult = await requireCohortOwnership(
      cohortId,
      session,
      scope
    );
    if (isCohortOwnershipError(ownershipResult)) return ownershipResult.error;

    // Remove member assignments, then delete group
    await prisma.$transaction(async (tx) => {
      await tx.caller.updateMany({
        where: { cohortGroupId: cohortId },
        data: { cohortGroupId: null },
      });
      await tx.cohortGroup.delete({ where: { id: cohortId } });
    });

    return NextResponse.json({ ok: true, message: "Cohort deleted" });
  } catch (error: any) {
    console.error("Error deleting cohort:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete cohort" },
      { status: 500 }
    );
  }
}
