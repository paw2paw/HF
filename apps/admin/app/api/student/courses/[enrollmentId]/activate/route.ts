/**
 * @api POST /api/student/courses/:enrollmentId/activate
 * @visibility public
 * @scope student:write
 * @auth STUDENT | OPERATOR+ (with callerId param)
 * @tags student, courses
 * @description Switch the student's active course. Sets this enrollment as default and triggers prompt recomposition.
 * @param enrollmentId string - CallerPlaybook ID to activate
 * @response 200 { ok: true, enrollment: { id, status, isDefault } }
 * @response 400 { ok: false, error: "..." }
 * @response 404 { ok: false, error: "Enrollment not found" }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudentOrAdmin, isStudentAuthError } from "@/lib/student-access";
import { autoComposeForCaller } from "@/lib/enrollment/auto-compose";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> },
) {
  const auth = await requireStudentOrAdmin(request);
  if (isStudentAuthError(auth)) return auth.error;

  const { callerId } = auth;
  const { enrollmentId } = await params;

  // Verify ownership
  const enrollment = await prisma.callerPlaybook.findFirst({
    where: { id: enrollmentId, callerId },
  });

  if (!enrollment) {
    return NextResponse.json(
      { ok: false, error: "Enrollment not found" },
      { status: 404 },
    );
  }

  if (enrollment.status !== "ACTIVE" && enrollment.status !== "PAUSED") {
    return NextResponse.json(
      { ok: false, error: `Cannot activate enrollment with status ${enrollment.status}. Use retake for completed courses.` },
      { status: 400 },
    );
  }

  // Clear isDefault on all other enrollments, set this one
  await prisma.$transaction([
    prisma.callerPlaybook.updateMany({
      where: { callerId, isDefault: true, id: { not: enrollmentId } },
      data: { isDefault: false },
    }),
    prisma.callerPlaybook.update({
      where: { id: enrollmentId },
      data: {
        isDefault: true,
        // Resume if paused
        ...(enrollment.status === "PAUSED" ? { status: "ACTIVE", pausedAt: null } : {}),
      },
    }),
  ]);

  // Recompose prompt for the new active course
  autoComposeForCaller(callerId).catch((err) =>
    console.error(`[student/courses/activate] Auto-compose failed for ${callerId}:`, err.message),
  );

  return NextResponse.json({
    ok: true,
    enrollment: {
      id: enrollmentId,
      playbookId: enrollment.playbookId,
      status: enrollment.status === "PAUSED" ? "ACTIVE" : enrollment.status,
      isDefault: true,
    },
  });
}
