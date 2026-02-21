/**
 * @api GET /api/educator/students/:id/enrollments
 * @visibility internal
 * @scope educator:read
 * @auth bearer
 * @tags educator, students, enrollments
 * @description List all course enrollments for a student. Requires educator access to the student's cohort.
 * @response 200 { ok: true, enrollments: CallerPlaybook[] }
 * @response 403 { ok: false, error: "Forbidden" }
 *
 * @api POST /api/educator/students/:id/enrollments
 * @visibility internal
 * @scope educator:write
 * @auth bearer
 * @tags educator, students, enrollments
 * @description Enroll a student in a course (playbook). The playbook must be PUBLISHED and belong to the student's domain. Requires educator access to the student's cohort.
 * @body playbookId string - The playbook to enroll in
 * @response 200 { ok: true, enrollment: CallerPlaybook }
 * @response 400 { ok: false, error: string }
 * @response 403 { ok: false, error: "Forbidden" }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireEducator,
  isEducatorAuthError,
  requireEducatorStudentAccess,
} from "@/lib/educator-access";
import { getAllEnrollments, enrollCaller } from "@/lib/enrollment";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEducator();
  if (isEducatorAuthError(auth)) return auth.error;

  const { id } = await params;
  const access = await requireEducatorStudentAccess(id, auth.callerId);
  if ("error" in access) return access.error;

  const enrollments = await getAllEnrollments(id);

  return NextResponse.json({ ok: true, enrollments });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEducator();
  if (isEducatorAuthError(auth)) return auth.error;

  const { id } = await params;
  const access = await requireEducatorStudentAccess(id, auth.callerId);
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body?.playbookId) {
    return NextResponse.json(
      { ok: false, error: "playbookId is required" },
      { status: 400 }
    );
  }

  // Validate playbook belongs to student's domain and is PUBLISHED
  const { student } = access;
  const playbook = await prisma.playbook.findFirst({
    where: {
      id: body.playbookId,
      domainId: student.domain?.id,
      status: "PUBLISHED",
    },
    select: { id: true, name: true },
  });

  if (!playbook) {
    return NextResponse.json(
      { ok: false, error: "Course not found or not available in this institution" },
      { status: 400 }
    );
  }

  const enrollment = await enrollCaller(id, playbook.id, "educator");

  return NextResponse.json({ ok: true, enrollment });
}
