/**
 * Cohort Ownership Access Control
 *
 * After requireEntityAccess("cohorts", op) succeeds, this helper
 * verifies that the authenticated user's linked Caller is the
 * cohort owner (for OWN scope) or in the same domain (for DOMAIN scope).
 */

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { AccessScope } from "@/lib/access-control";
import type { Session } from "next-auth";
import type { CohortGroup } from "@prisma/client";

export type CohortOwnershipSuccess = {
  cohort: CohortGroup & {
    owner: { id: string; name: string | null };
    domain: { id: string; slug: string; name: string };
    _count: { members: number };
  };
};

export type CohortOwnershipFailure = {
  error: NextResponse;
};

export type CohortOwnershipResult =
  | CohortOwnershipSuccess
  | CohortOwnershipFailure;

export function isCohortOwnershipError(
  result: CohortOwnershipResult
): result is CohortOwnershipFailure {
  return "error" in result;
}

/**
 * Verify that the authenticated user has access to a specific cohort.
 *
 * - ALL scope: any cohort is accessible
 * - DOMAIN scope: cohort must be in the user's assigned domain
 * - OWN scope: the user's linked Caller must be the cohort owner
 */
export async function requireCohortOwnership(
  cohortId: string,
  session: Session,
  scope: AccessScope
): Promise<CohortOwnershipResult> {
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
        { ok: false, error: "Cohort not found" },
        { status: 404 }
      ),
    };
  }

  // ALL scope — admin can access any cohort
  if (scope === "ALL") {
    return { cohort };
  }

  // DOMAIN scope — cohort must be in user's assigned domain
  if (scope === "DOMAIN") {
    const userDomainId = (session.user as any).assignedDomainId;
    if (userDomainId && cohort.domainId === userDomainId) {
      return { cohort };
    }
    return {
      error: NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  // OWN scope — user's linked Caller must be the cohort owner
  if (scope === "OWN") {
    const caller = await prisma.caller.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (caller && cohort.ownerId === caller.id) {
      return { cohort };
    }
    return {
      error: NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  // NONE or unknown scope
  return {
    error: NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 }
    ),
  };
}
