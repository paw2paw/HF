/**
 * Student-Scoped Access Helpers
 *
 * Provides helpers for student routes to verify identity and scope.
 *
 * A student's scope is: their linked Caller (LEARNER role) →
 * cohortGroup → owner (teacher).
 */

import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError, ROLE_LEVEL } from "@/lib/permissions";
import { NextResponse, type NextRequest } from "next/server";
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
      select: {
        id: true,
        cohortGroupId: true,
        user: { select: { institutionId: true } },
      },
    });

    if (!caller) {
      return {
        error: NextResponse.json(
          { ok: false, error: "Learner not found" },
          { status: 404 }
        ),
      };
    }

    return {
      session,
      callerId: caller.id,
      cohortGroupId: caller.cohortGroupId ?? "",
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
