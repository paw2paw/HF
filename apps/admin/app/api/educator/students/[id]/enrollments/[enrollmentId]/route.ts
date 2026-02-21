/**
 * @api PATCH /api/educator/students/:id/enrollments/:enrollmentId
 * @visibility internal
 * @scope educator:write
 * @auth bearer
 * @tags educator, students, enrollments
 * @description Update a student's enrollment status (pause, resume, or drop). Requires educator access to the student's cohort.
 * @body status string - New status: "ACTIVE" | "PAUSED" | "DROPPED"
 * @response 200 { ok: true, enrollment: CallerPlaybook }
 * @response 400 { ok: false, error: string }
 * @response 403 { ok: false, error: "Forbidden" }
 * @response 404 { ok: false, error: "Enrollment not found" }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireEducator,
  isEducatorAuthError,
  requireEducatorStudentAccess,
} from "@/lib/educator-access";
import {
  unenrollCaller,
  pauseEnrollment,
  resumeEnrollment,
} from "@/lib/enrollment";

const ALLOWED_STATUSES = ["ACTIVE", "PAUSED", "DROPPED"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> }
) {
  const auth = await requireEducator();
  if (isEducatorAuthError(auth)) return auth.error;

  const { id, enrollmentId } = await params;
  const access = await requireEducatorStudentAccess(id, auth.callerId);
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body?.status || !ALLOWED_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { ok: false, error: `status must be one of: ${ALLOWED_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  // Verify enrollment belongs to this student
  const existing = await prisma.callerPlaybook.findUnique({
    where: { id: enrollmentId },
    select: { callerId: true, playbookId: true },
  });

  if (!existing || existing.callerId !== id) {
    return NextResponse.json(
      { ok: false, error: "Enrollment not found" },
      { status: 404 }
    );
  }

  let enrollment;
  switch (body.status) {
    case "ACTIVE":
      enrollment = await resumeEnrollment(id, existing.playbookId);
      break;
    case "PAUSED":
      enrollment = await pauseEnrollment(id, existing.playbookId);
      break;
    case "DROPPED":
      enrollment = await unenrollCaller(id, existing.playbookId);
      break;
  }

  return NextResponse.json({ ok: true, enrollment });
}
