import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireEducator,
  isEducatorAuthError,
  requireEducatorCohortOwnership,
} from "@/lib/educator-access";

/**
 * @api DELETE /api/educator/classrooms/[id]/members/[callerId]
 * @visibility internal
 * @scope educator:write
 * @auth bearer
 * @tags educator, classrooms, students
 * @description Remove a student from a classroom by unlinking them from the cohort. Does not delete the caller record. Requires educator ownership of the cohort.
 * @response 200 { ok: true }
 * @response 404 { ok: false, error: "Student not found in this classroom" }
 * @response 403 { ok: false, error: "Not authorized" }
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; callerId: string }> }
) {
  const auth = await requireEducator();
  if (isEducatorAuthError(auth)) return auth.error;

  const { id, callerId } = await params;
  const ownership = await requireEducatorCohortOwnership(id, auth.callerId);
  if ("error" in ownership) return ownership.error;

  // Verify the caller is actually in this cohort
  const caller = await prisma.caller.findUnique({
    where: { id: callerId },
    select: { id: true, cohortGroupId: true },
  });

  if (!caller || caller.cohortGroupId !== id) {
    return NextResponse.json(
      { ok: false, error: "Student not found in this classroom" },
      { status: 404 }
    );
  }

  // Unlink from cohort (don't delete the caller)
  await prisma.caller.update({
    where: { id: callerId },
    data: { cohortGroupId: null },
  });

  return NextResponse.json({ ok: true });
}
