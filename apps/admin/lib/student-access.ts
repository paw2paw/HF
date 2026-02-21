/**
 * Student-Scoped Access Helpers
 *
 * Provides helpers for student routes to verify identity and scope.
 *
 * A student's scope is: their linked Caller (LEARNER role) →
 * cohortMemberships → cohortGroup → owner (teacher).
 */

import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError, ROLE_LEVEL } from "@/lib/permissions";
import { NextResponse, type NextRequest } from "next/server";
import type { Session } from "next-auth";

type StudentAuthSuccess = {
  session: Session;
  callerId: string; // The student's Caller.id (LEARNER role)
  cohortGroupId: string; // Primary cohort (first membership) — kept for backwards compat
  cohortGroupIds: string[]; // All cohort memberships
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

/** Select shape for caller with cohort memberships */
const callerWithMembershipsSelect = {
  id: true,
  cohortGroupId: true, // legacy FK — still populated during migration period
  cohortMemberships: {
    select: { cohortGroupId: true },
    orderBy: { joinedAt: "asc" as const },
  },
  user: { select: { institutionId: true } },
};

/** Extract cohort IDs from a caller query result */
function extractCohortIds(caller: {
  cohortGroupId: string | null;
  cohortMemberships: { cohortGroupId: string }[];
}): string[] {
  // Prefer join table memberships, fall back to legacy FK
  if (caller.cohortMemberships.length > 0) {
    return caller.cohortMemberships.map((m) => m.cohortGroupId);
  }
  return caller.cohortGroupId ? [caller.cohortGroupId] : [];
}

/**
 * Require authenticated student with a linked LEARNER Caller in a classroom.
 * Returns { session, callerId, cohortGroupId, cohortGroupIds, institutionId } on success.
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
    select: callerWithMembershipsSelect,
  });

  const cohortIds = caller ? extractCohortIds(caller) : [];

  if (!caller || cohortIds.length === 0) {
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
    cohortGroupId: cohortIds[0], // primary for backwards compat
    cohortGroupIds: cohortIds,
    institutionId: caller.user?.institutionId ?? null,
  };
}

/**
 * Like requireStudent() but also allows OPERATOR+ users with an explicit callerId param.
 * - STUDENT: resolves own linked LEARNER caller (same as requireStudent)
 * - OPERATOR+: reads callerId from query param, verifies it's a LEARNER
 */
export async function requireStudentOrAdmin(
  request: NextRequest
): Promise<StudentAuthResult> {
  const authResult = await requireAuth("STUDENT");
  if (isAuthError(authResult)) return { error: authResult.error };

  const { session } = authResult;
  const role = session.user.role;

  // Path A: Actual STUDENT — resolve their own caller
  if (role === "STUDENT") {
    const caller = await prisma.caller.findFirst({
      where: { userId: session.user.id, role: "LEARNER" },
      select: callerWithMembershipsSelect,
    });

    const cohortIds = caller ? extractCohortIds(caller) : [];

    if (!caller || cohortIds.length === 0) {
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
      cohortGroupId: cohortIds[0],
      cohortGroupIds: cohortIds,
      institutionId: caller.user?.institutionId ?? null,
    };
  }

  // Path B: OPERATOR+ — require explicit callerId query param
  if (ROLE_LEVEL[role] >= ROLE_LEVEL.OPERATOR) {
    const callerId = request.nextUrl.searchParams.get("callerId");

    if (!callerId) {
      return {
        error: NextResponse.json(
          { ok: false, error: "callerId query parameter required for admin access" },
          { status: 400 }
        ),
      };
    }

    const caller = await prisma.caller.findFirst({
      where: { id: callerId, role: "LEARNER" },
      select: callerWithMembershipsSelect,
    });

    if (!caller) {
      return {
        error: NextResponse.json(
          { ok: false, error: "Learner not found" },
          { status: 404 }
        ),
      };
    }

    const cohortIds = extractCohortIds(caller);

    return {
      session,
      callerId: caller.id,
      cohortGroupId: cohortIds[0] || "",
      cohortGroupIds: cohortIds,
      institutionId: caller.user?.institutionId ?? null,
    };
  }

  return {
    error: NextResponse.json(
      { ok: false, error: "Student or admin access required" },
      { status: 403 }
    ),
  };
}
