/**
 * Student-Scoped Access Helpers
 *
 * Provides helpers for student routes to verify identity and scope.
 *
 * A student's scope is: their linked Caller (LEARNER role) →
 * cohortGroup → owner (teacher).
 */

import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

type StudentAuthSuccess = {
  session: Session;
  callerId: string; // The student's Caller.id (LEARNER role)
  cohortGroupId: string; // The student's classroom
  institutionId: string | null;
};

type StudentAuthFailure = {
  error: NextResponse;
};

export type StudentAuthResult = StudentAuthSuccess | StudentAuthFailure;

export function isStudentAuthError(
  result: StudentAuthResult
): result is StudentAuthFailure {
  return "error" in result;
}

/**
 * Require authenticated student with a linked LEARNER Caller in a classroom.
 * Returns { session, callerId, cohortGroupId, institutionId } on success.
 */
export async function requireStudent(): Promise<StudentAuthResult> {
  const authResult = await requireAuth("STUDENT");
  if (isAuthError(authResult)) return { error: authResult.error };

  const { session } = authResult;

  // Strict role check — higher roles should use their own routes
  if (session.user.role !== "STUDENT") {
    return {
      error: NextResponse.json(
        { ok: false, error: "Student access only" },
        { status: 403 }
      ),
    };
  }

  const caller = await prisma.caller.findFirst({
    where: {
      userId: session.user.id,
      role: "LEARNER",
    },
    select: {
      id: true,
      cohortGroupId: true,
      user: { select: { institutionId: true } },
    },
  });

  if (!caller || !caller.cohortGroupId) {
    return {
      error: NextResponse.json(
        { ok: false, error: "No student profile found. Please join a classroom." },
        { status: 403 }
      ),
    };
  }

  return {
    session,
    callerId: caller.id,
    cohortGroupId: caller.cohortGroupId,
    institutionId: caller.user?.institutionId ?? null,
  };
}
