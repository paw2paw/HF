/**
 * Educator-Scoped Access Helpers
 *
 * Provides helpers for educator routes to verify ownership of cohorts
 * and access to students within their owned cohorts.
 *
 * An educator's "scope" is: their linked Caller (TEACHER role) →
 * ownedCohorts → members of those cohorts.
 */

import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

type EducatorAuthSuccess = {
  session: Session;
  callerId: string; // The educator's Caller.id (TEACHER role)
  institutionId: string | null; // The educator's institution (for branding/scoping)
};

type EducatorAuthFailure = {
  error: NextResponse;
};

export type EducatorAuthResult = EducatorAuthSuccess | EducatorAuthFailure;

export function isEducatorAuthError(
  result: EducatorAuthResult
): result is EducatorAuthFailure {
  return "error" in result;
}

/**
 * Require authenticated educator with a linked TEACHER Caller.
 * Returns { session, callerId } on success.
 */
export async function requireEducator(): Promise<EducatorAuthResult> {
  const authResult = await requireAuth("EDUCATOR");
  if (isAuthError(authResult)) return { error: authResult.error };

  const { session } = authResult;

  // Find the educator's linked Caller record (TEACHER role) + institution
  const caller = await prisma.caller.findFirst({
    where: {
      userId: session.user.id,
      role: "TEACHER",
    },
    select: {
      id: true,
      user: { select: { institutionId: true } },
    },
  });

  if (!caller) {
    return {
      error: NextResponse.json(
        { ok: false, error: "No educator profile found. Please complete setup." },
        { status: 403 }
      ),
    };
  }

  return {
    session,
    callerId: caller.id,
    institutionId: caller.user?.institutionId ?? null,
  };
}

/**
 * Verify that a cohort is owned by the educator's Caller.
 */
export async function requireEducatorCohortOwnership(
  cohortId: string,
  educatorCallerId: string
) {
  const cohort = await prisma.cohortGroup.findUnique({
    where: { id: cohortId },
    include: {
      owner: { select: { id: true, name: true } },
      domain: { select: { id: true, slug: true, name: true } },
      _count: { select: { members: true } },
    },
  });

  if (!cohort) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Classroom not found" },
        { status: 404 }
      ),
    };
  }

  if (cohort.ownerId !== educatorCallerId) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  return { cohort };
}

/**
 * Verify that a student (Caller) is a member of one of the educator's cohorts.
 */
export async function requireEducatorStudentAccess(
  studentCallerId: string,
  educatorCallerId: string
) {
  const student = await prisma.caller.findUnique({
    where: { id: studentCallerId },
    include: {
      cohortGroup: {
        select: { id: true, name: true, ownerId: true },
      },
      domain: { select: { id: true, slug: true, name: true } },
    },
  });

  if (!student) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Student not found" },
        { status: 404 }
      ),
    };
  }

  // Student must be in a cohort owned by this educator
  if (!student.cohortGroup || student.cohortGroup.ownerId !== educatorCallerId) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  return { student };
}
