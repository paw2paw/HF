import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEntityAccess, isEntityAuthError } from "@/lib/access-control";
import {
  requireCohortOwnership,
  isCohortOwnershipError,
} from "@/lib/cohort-access";
import { assignPlaybookToCohort } from "@/lib/enrollment";

/**
 * @api GET /api/cohorts/:cohortId/playbooks
 * @visibility public
 * @scope cohorts:read
 * @auth session
 * @tags cohorts, playbooks
 * @description List playbooks assigned to a cohort and available domain playbooks not yet assigned.
 * @pathParam cohortId string - Cohort group ID
 * @response 200 { ok: true, playbooks: CohortPlaybook[], available: Playbook[] }
 * @response 404 { ok: false, error: "Cohort not found" }
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

    const ownershipResult = await requireCohortOwnership(cohortId, session, scope);
    if (isCohortOwnershipError(ownershipResult)) return ownershipResult.error;
    const { cohort } = ownershipResult;

    // Get assigned playbooks with enrollment counts
    const assignments = await prisma.cohortPlaybook.findMany({
      where: { cohortGroupId: cohortId },
      include: {
        playbook: {
          select: {
            id: true,
            name: true,
            status: true,
            version: true,
            _count: { select: { enrollments: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const playbooks = assignments.map((a) => ({
      id: a.playbook.id,
      name: a.playbook.name,
      status: a.playbook.status,
      version: a.playbook.version,
      assignedAt: a.createdAt,
      assignedBy: a.assignedBy,
      enrolledCount: a.playbook._count.enrollments,
    }));

    // Get available domain playbooks not yet assigned
    const assignedIds = assignments.map((a) => a.playbookId);
    const available = await prisma.playbook.findMany({
      where: {
        domainId: cohort.domainId,
        status: "PUBLISHED",
        ...(assignedIds.length > 0 ? { id: { notIn: assignedIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
        version: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ ok: true, playbooks, available });
  } catch (error: any) {
    console.error("Error listing cohort playbooks:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to list cohort playbooks" },
      { status: 500 }
    );
  }
}

/**
 * @api POST /api/cohorts/:cohortId/playbooks
 * @visibility public
 * @scope cohorts:update
 * @auth session
 * @tags cohorts, playbooks
 * @description Assign one or more playbooks to a cohort. Optionally auto-enroll existing cohort members.
 * @pathParam cohortId string - Cohort group ID
 * @body playbookIds string[] - Array of playbook IDs to assign
 * @body autoEnrollMembers boolean - Whether to auto-enroll existing members (default: false)
 * @response 200 { ok: true, assigned: number, enrolled: number }
 * @response 400 { ok: false, error: "..." }
 * @response 404 { ok: false, error: "Cohort not found" }
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

    const ownershipResult = await requireCohortOwnership(cohortId, session, scope);
    if (isCohortOwnershipError(ownershipResult)) return ownershipResult.error;

    const body = await req.json();
    const { playbookIds, autoEnrollMembers = false } = body;

    if (!Array.isArray(playbookIds) || playbookIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "playbookIds array is required" },
        { status: 400 }
      );
    }

    let totalEnrolled = 0;
    for (const pbId of playbookIds) {
      const result = await assignPlaybookToCohort(
        cohortId,
        pbId,
        session.user.id || "manual",
        autoEnrollMembers
      );
      totalEnrolled += result.enrolled;
    }

    return NextResponse.json({
      ok: true,
      assigned: playbookIds.length,
      enrolled: totalEnrolled,
    });
  } catch (error: any) {
    console.error("Error assigning cohort playbooks:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to assign playbooks" },
      { status: 500 }
    );
  }
}
