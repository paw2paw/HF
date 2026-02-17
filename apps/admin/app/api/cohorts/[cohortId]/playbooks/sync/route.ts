import { NextResponse } from "next/server";
import { requireEntityAccess, isEntityAuthError } from "@/lib/access-control";
import {
  requireCohortOwnership,
  isCohortOwnershipError,
} from "@/lib/cohort-access";
import {
  getCohortPlaybookIds,
  enrollCohortMembersInPlaybook,
} from "@/lib/enrollment";

/**
 * @api POST /api/cohorts/:cohortId/playbooks/sync
 * @visibility public
 * @scope cohorts:update
 * @auth session
 * @tags cohorts, playbooks
 * @description Sync all cohort members to the cohort's assigned playbooks. Enrolls any members missing enrollments.
 * @pathParam cohortId string - Cohort group ID
 * @response 200 { ok: true, synced: number, errors: string[] }
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

    const playbookIds = await getCohortPlaybookIds(cohortId);

    if (playbookIds.length === 0) {
      return NextResponse.json({
        ok: true,
        synced: 0,
        errors: [],
        message: "No playbooks assigned to this cohort",
      });
    }

    let totalSynced = 0;
    const allErrors: string[] = [];

    for (const pbId of playbookIds) {
      const result = await enrollCohortMembersInPlaybook(cohortId, pbId, "sync");
      totalSynced += result.enrolled;
      allErrors.push(...result.errors);
    }

    return NextResponse.json({
      ok: true,
      synced: totalSynced,
      errors: allErrors,
    });
  } catch (error: any) {
    console.error("Error syncing cohort playbooks:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to sync playbooks" },
      { status: 500 }
    );
  }
}
