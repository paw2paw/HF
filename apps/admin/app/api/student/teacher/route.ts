/**
 * @api GET /api/student/teacher
 * @auth STUDENT | OPERATOR+ (with callerId param)
 * @desc Returns the student's teacher info, classroom name, and institution branding
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudentOrAdmin, isStudentAuthError } from "@/lib/student-access";

export async function GET(request: NextRequest) {
  const auth = await requireStudentOrAdmin(request);
  if (isStudentAuthError(auth)) return auth.error;

  const cohort = await prisma.cohortGroup.findUnique({
    where: { id: auth.cohortGroupId },
    select: {
      name: true,
      owner: { select: { name: true, email: true } },
      domain: { select: { name: true } },
      institution: { select: { name: true, logoUrl: true } },
    },
  });

  if (!cohort) {
    return NextResponse.json(
      { ok: false, error: "Classroom not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    teacher: {
      name: cohort.owner.name ?? "Your teacher",
      email: cohort.owner.email,
    },
    classroom: cohort.name,
    domain: cohort.domain.name,
    institution: cohort.institution
      ? {
          name: cohort.institution.name,
          logo: cohort.institution.logoUrl,
        }
      : null,
  });
}
