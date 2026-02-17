import { NextResponse } from "next/server";
import { requireEntityAccess, isEntityAuthError } from "@/lib/access-control";
import {
  requireCohortOwnership,
  isCohortOwnershipError,
} from "@/lib/cohort-access";
import { removePlaybookFromCohort } from "@/lib/enrollment";

/**
 * @api DELETE /api/cohorts/:cohortId/playbooks/:playbookId
 * @visibility public
 * @scope cohorts:update
 * @auth session
 * @tags cohorts, playbooks
 * @description Remove a playbook from a cohort. Optionally drop member enrollments.
 * @pathParam cohortId string - Cohort group ID
 * @pathParam playbookId string - Playbook ID to remove
 * @query dropEnrollments boolean - Whether to drop member enrollments (default: false)
 * @response 200 { ok: true, removed: true, dropped: number }
 * @response 404 { ok: false, error: "Cohort not found" }
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ cohortId: string; playbookId: string }> }
) {
  try {
    const authResult = await requireEntityAccess("cohorts", "U");
    if (isEntityAuthError(authResult)) return authResult.error;
    const { scope, session } = authResult;

    const { cohortId, playbookId } = await params;

    const ownershipResult = await requireCohortOwnership(cohortId, session, scope);
    if (isCohortOwnershipError(ownershipResult)) return ownershipResult.error;

    const url = new URL(req.url);
    const dropEnrollments = url.searchParams.get("dropEnrollments") === "true";

    const result = await removePlaybookFromCohort(
      cohortId,
      playbookId,
      dropEnrollments
    );

    return NextResponse.json({
      ok: true,
      removed: result.removed,
      dropped: result.dropped,
    });
  } catch (error: any) {
    console.error("Error removing cohort playbook:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to remove playbook" },
      { status: 500 }
    );
  }
}
