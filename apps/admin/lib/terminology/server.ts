/**
 * Terminology — Server-side helpers (Prisma-dependent).
 */

import { prisma } from "@/lib/prisma";
import {
  resolveTerminology,
  DEFAULT_TERMINOLOGY,
  type TerminologyProfile,
  type TerminologyConfig,
} from "./types";

/**
 * Get resolved terminology for an institution (server-side).
 * Falls back to school defaults when institutionId is null or institution has no config.
 */
export async function getTerminology(
  institutionId: string | null
): Promise<TerminologyProfile> {
  if (!institutionId) return DEFAULT_TERMINOLOGY;

  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: { terminology: true },
  });

  return resolveTerminology(
    institution?.terminology as TerminologyConfig | null
  );
}

/**
 * Get resolved terminology for the current user (server-side).
 * Reads user.institutionId, then resolves.
 */
export async function getTerminologyForUser(
  userId: string
): Promise<TerminologyProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { institutionId: true },
  });

  return getTerminology(user?.institutionId ?? null);
}
