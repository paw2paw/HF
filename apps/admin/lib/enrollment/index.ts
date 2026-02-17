/**
 * Enrollment — Manages CallerPlaybook relationships (class roster model).
 *
 * All functions accept an optional Prisma transaction client (`tx`) so they
 * can be composed inside existing transactions (e.g. invite accept, domain switch).
 */

import { prisma } from "@/lib/prisma";
import type { PrismaClient, Prisma, CallerPlaybook, CohortPlaybook } from "@prisma/client";

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

function db(tx?: TxClient): TxClient {
  return tx ?? prisma;
}

/**
 * Enroll a caller in a specific playbook. Upserts — safe to call multiple times.
 * If the caller was previously DROPPED/PAUSED, re-activates the enrollment.
 */
export async function enrollCaller(
  callerId: string,
  playbookId: string,
  source: string,
  tx?: TxClient
): Promise<CallerPlaybook> {
  return db(tx).callerPlaybook.upsert({
    where: { callerId_playbookId: { callerId, playbookId } },
    create: {
      callerId,
      playbookId,
      status: "ACTIVE",
      enrolledBy: source,
    },
    update: {
      status: "ACTIVE",
      enrolledBy: source,
      pausedAt: null,
      droppedAt: null,
    },
  });
}

/**
 * Auto-enroll a caller in all PUBLISHED playbooks for a domain.
 * Used for backwards-compat on caller creation paths that don't yet
 * specify individual playbooks.
 */
export async function enrollCallerInDomainPlaybooks(
  callerId: string,
  domainId: string,
  source: string,
  tx?: TxClient
): Promise<CallerPlaybook[]> {
  const playbooks = await db(tx).playbook.findMany({
    where: { domainId, status: "PUBLISHED" },
    select: { id: true },
  });

  const results: CallerPlaybook[] = [];
  for (const pb of playbooks) {
    const enrollment = await enrollCaller(callerId, pb.id, source, tx);
    results.push(enrollment);
  }
  return results;
}

/**
 * Drop a caller's enrollment in a playbook (explicit withdrawal).
 */
export async function unenrollCaller(
  callerId: string,
  playbookId: string,
  tx?: TxClient
): Promise<CallerPlaybook> {
  return db(tx).callerPlaybook.update({
    where: { callerId_playbookId: { callerId, playbookId } },
    data: { status: "DROPPED", droppedAt: new Date() },
  });
}

/**
 * Get all ACTIVE enrollments for a caller (with playbook data).
 */
export async function getActiveEnrollments(
  callerId: string,
  tx?: TxClient
): Promise<CallerPlaybook[]> {
  return db(tx).callerPlaybook.findMany({
    where: { callerId, status: "ACTIVE" },
    orderBy: { enrolledAt: "asc" },
  });
}

/**
 * Get all enrollments for a caller (any status), with playbook details.
 */
export async function getAllEnrollments(
  callerId: string,
  tx?: TxClient
) {
  return db(tx).callerPlaybook.findMany({
    where: { callerId },
    include: {
      playbook: { select: { id: true, name: true, status: true, domainId: true } },
    },
    orderBy: { enrolledAt: "asc" },
  });
}

/**
 * Mark an enrollment as completed.
 */
export async function completeEnrollment(
  callerId: string,
  playbookId: string,
  tx?: TxClient
): Promise<CallerPlaybook> {
  return db(tx).callerPlaybook.update({
    where: { callerId_playbookId: { callerId, playbookId } },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
}

/**
 * Pause an enrollment.
 */
export async function pauseEnrollment(
  callerId: string,
  playbookId: string,
  tx?: TxClient
): Promise<CallerPlaybook> {
  return db(tx).callerPlaybook.update({
    where: { callerId_playbookId: { callerId, playbookId } },
    data: { status: "PAUSED", pausedAt: new Date() },
  });
}

/**
 * Resume a paused enrollment.
 */
export async function resumeEnrollment(
  callerId: string,
  playbookId: string,
  tx?: TxClient
): Promise<CallerPlaybook> {
  return db(tx).callerPlaybook.update({
    where: { callerId_playbookId: { callerId, playbookId } },
    data: { status: "ACTIVE", pausedAt: null },
  });
}

/**
 * Drop all ACTIVE enrollments for a caller (used during domain switch).
 */
export async function dropAllActiveEnrollments(
  callerId: string,
  tx?: TxClient
): Promise<Prisma.BatchPayload> {
  return db(tx).callerPlaybook.updateMany({
    where: { callerId, status: "ACTIVE" },
    data: { status: "DROPPED", droppedAt: new Date() },
  });
}

/**
 * Get enrolled caller IDs for a playbook (roster view).
 */
export async function getPlaybookRoster(
  playbookId: string,
  status?: "ACTIVE" | "COMPLETED" | "PAUSED" | "DROPPED",
  tx?: TxClient
) {
  return db(tx).callerPlaybook.findMany({
    where: {
      playbookId,
      ...(status ? { status } : {}),
    },
    include: {
      caller: { select: { id: true, name: true, email: true, phone: true } },
    },
    orderBy: { enrolledAt: "asc" },
  });
}

// ─── Cohort-Level Enrollment ─────────────────────────────────────────────────

/**
 * Get playbook IDs assigned to a cohort.
 */
export async function getCohortPlaybookIds(
  cohortGroupId: string,
  tx?: TxClient
): Promise<string[]> {
  const assignments = await db(tx).cohortPlaybook.findMany({
    where: { cohortGroupId },
    select: { playbookId: true },
  });
  return assignments.map((a) => a.playbookId);
}

/**
 * Enroll a caller in playbooks assigned to their cohort.
 * Falls back to domain-wide enrollment if cohort has no assigned playbooks.
 */
export async function enrollCallerInCohortPlaybooks(
  callerId: string,
  cohortGroupId: string,
  domainId: string,
  source: string,
  tx?: TxClient
): Promise<CallerPlaybook[]> {
  const cohortPlaybookIds = await getCohortPlaybookIds(cohortGroupId, tx);

  if (cohortPlaybookIds.length > 0) {
    // Enroll only in cohort's assigned playbooks
    const results: CallerPlaybook[] = [];
    for (const playbookId of cohortPlaybookIds) {
      const enrollment = await enrollCaller(callerId, playbookId, source, tx);
      results.push(enrollment);
    }
    return results;
  }

  // Fallback: no cohort playbooks assigned → enroll in all domain playbooks
  return enrollCallerInDomainPlaybooks(callerId, domainId, source, tx);
}

/**
 * Assign a playbook to a cohort. Optionally auto-enroll all existing members.
 */
export async function assignPlaybookToCohort(
  cohortGroupId: string,
  playbookId: string,
  assignedBy: string,
  autoEnrollMembers: boolean,
  tx?: TxClient
): Promise<{ assignment: CohortPlaybook; enrolled: number }> {
  const assignment = await db(tx).cohortPlaybook.upsert({
    where: { cohortGroupId_playbookId: { cohortGroupId, playbookId } },
    create: { cohortGroupId, playbookId, assignedBy },
    update: { assignedBy },
  });

  let enrolled = 0;
  if (autoEnrollMembers) {
    const result = await enrollCohortMembersInPlaybook(cohortGroupId, playbookId, "cohort-assign", tx);
    enrolled = result.enrolled;
  }

  return { assignment, enrolled };
}

/**
 * Remove a playbook from a cohort. Optionally drop member enrollments.
 */
export async function removePlaybookFromCohort(
  cohortGroupId: string,
  playbookId: string,
  dropMemberEnrollments: boolean,
  tx?: TxClient
): Promise<{ removed: boolean; dropped: number }> {
  await db(tx).cohortPlaybook.delete({
    where: { cohortGroupId_playbookId: { cohortGroupId, playbookId } },
  });

  let dropped = 0;
  if (dropMemberEnrollments) {
    const members = await db(tx).caller.findMany({
      where: { cohortGroupId },
      select: { id: true },
    });

    if (members.length > 0) {
      const result = await db(tx).callerPlaybook.updateMany({
        where: {
          playbookId,
          callerId: { in: members.map((m) => m.id) },
          status: "ACTIVE",
        },
        data: { status: "DROPPED", droppedAt: new Date() },
      });
      dropped = result.count;
    }
  }

  return { removed: true, dropped };
}

/**
 * Enroll all current cohort members in a specific playbook (sync operation).
 */
export async function enrollCohortMembersInPlaybook(
  cohortGroupId: string,
  playbookId: string,
  source: string,
  tx?: TxClient
): Promise<{ enrolled: number; errors: string[] }> {
  const members = await db(tx).caller.findMany({
    where: { cohortGroupId },
    select: { id: true },
  });

  let enrolled = 0;
  const errors: string[] = [];

  for (const member of members) {
    try {
      await enrollCaller(member.id, playbookId, source, tx);
      enrolled++;
    } catch (err: any) {
      errors.push(`${member.id}: ${err?.message || "Failed"}`);
    }
  }

  return { enrolled, errors };
}
