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

  // Query all cohort memberships (prefer join table, fallback to legacy FK)
  const cohortIds = auth.cohortGroupIds.length > 0
    ? auth.cohortGroupIds
    : auth.cohortGroupId ? [auth.cohortGroupId] : [];

  if (cohortIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No classroom found" },
      { status: 404 }
    );
  }

  const cohorts = await prisma.cohortGroup.findMany({
    where: { id: { in: cohortIds } },
    select: {
      id: true,
      name: true,
      owner: { select: { name: true, email: true } },
      domain: { select: { name: true } },
      institution: { select: { name: true, logoUrl: true } },
    },
  });

  if (cohorts.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Classroom not found" },
      { status: 404 }
    );
  }

  // Primary cohort (first membership) for backwards compat
  const primary = cohorts[0];

  return NextResponse.json({
    ok: true,
    teacher: {
      name: primary.owner.name ?? "Your teacher",
      email: primary.owner.email,
    },
    classroom: primary.name,
    classrooms: cohorts.map(c => ({
      id: c.id,
      name: c.name,
      teacher: c.owner.name ?? "Your teacher",
    })),
    domain: primary.domain.name,
    institution: primary.institution
      ? {
          name: primary.institution.name,
          logo: primary.institution.logoUrl,
        }
      : null,
  });
}
