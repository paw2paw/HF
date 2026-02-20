/**
 * Unified Terminology System — Two-Tier DB-Driven Resolution
 *
 * Tier 1 (role gate): ADMIN/SUPERADMIN/SUPER_TESTER → technical terms (Prisma model names)
 * Tier 2 (institution type): All other roles → institution type's terminology from DB
 *
 * InstitutionType rows in the DB carry terminology JSON presets.
 * Admins can create new types and edit labels via /x/system/institution-types.
 *
 * Usage:
 *   const terms = await resolveTerminology("EDUCATOR", institutionId);
 *   console.log(terms.domain); // → "School" (if institution type is school)
 *
 *   const label = await resolveTermLabel("domain", "EDUCATOR", institutionId);
 *   console.log(label); // → "School"
 */

import { prisma } from "@/lib/prisma";
import { pluralize, lc } from "@/lib/terminology/types";
import type { UserRole } from "@prisma/client";

// ============================================================================
// Types
// ============================================================================

/** The 7 canonical term keys used across the app */
export type TermKey =
  | "domain"
  | "playbook"
  | "spec"
  | "caller"
  | "cohort"
  | "instructor"
  | "session";

/** A complete terminology map — all 7 keys present, all strings */
export type TermMap = Record<TermKey, string>;

// Re-export helpers from types module
export { pluralize, lc } from "@/lib/terminology/types";

// ============================================================================
// Technical Terms (fallback only — Prisma model names)
// ============================================================================

/**
 * Technical terms shown to ADMIN/SUPERADMIN/SUPER_TESTER.
 * These are the Prisma model names — the only hardcoded fallback.
 * All user-facing labels come from InstitutionType.terminology in the DB.
 */
export const TECHNICAL_TERMS: TermMap = {
  domain: "Domain",
  playbook: "Playbook",
  spec: "Spec",
  caller: "Caller",
  cohort: "Cohort",
  instructor: "Instructor",
  session: "Session",
};

/** All 7 term keys in canonical order */
export const TERM_KEYS: TermKey[] = [
  "domain",
  "playbook",
  "spec",
  "caller",
  "cohort",
  "instructor",
  "session",
];

/** Roles that always see technical terms */
const TECHNICAL_ROLES: UserRole[] = ["ADMIN", "SUPERADMIN", "SUPER_TESTER"];

// ============================================================================
// Cache
// ============================================================================

const cache = new Map<string, { terms: TermMap; loadedAt: number }>();
const CACHE_TTL_MS = 30_000;

/** Clear the terminology cache (call after admin updates) */
export function invalidateTerminologyCache(): void {
  cache.clear();
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Resolve terminology for a user based on their role and institution.
 *
 * - ADMIN/SUPERADMIN/SUPER_TESTER → always get technical terms (Domain, Playbook, etc.)
 * - All other roles → look up institution → institution type → terminology preset from DB
 * - Fallback → technical terms (if no institution or no type configured)
 *
 * @param role - User's RBAC role
 * @param institutionId - User's institution ID (optional)
 * @returns Complete 7-key TermMap
 */
export async function resolveTerminology(
  role: UserRole,
  institutionId?: string | null
): Promise<TermMap> {
  // Tier 1: technical roles always see model names
  if (TECHNICAL_ROLES.includes(role)) {
    return TECHNICAL_TERMS;
  }

  // No institution → fallback to technical terms
  if (!institutionId) {
    return TECHNICAL_TERMS;
  }

  // Check cache
  const cacheKey = institutionId;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.terms;
  }

  // Tier 2: look up institution type's terminology from DB
  try {
    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: {
        type: {
          select: { terminology: true },
        },
      },
    });

    if (institution?.type?.terminology) {
      const dbTerms = institution.type.terminology as Record<string, string>;

      // Merge with technical terms (DB overrides, missing keys fall back to technical)
      const resolved: TermMap = { ...TECHNICAL_TERMS };
      for (const key of TERM_KEYS) {
        if (dbTerms[key] && typeof dbTerms[key] === "string") {
          resolved[key] = dbTerms[key];
        }
      }

      cache.set(cacheKey, { terms: resolved, loadedAt: Date.now() });
      return resolved;
    }
  } catch (error) {
    console.error("[terminology] Failed to resolve from DB:", error);
  }

  // Fallback: technical terms
  return TECHNICAL_TERMS;
}

/**
 * Resolve a single term label.
 *
 * @param key - Term key (domain, playbook, spec, caller, cohort, instructor, session)
 * @param role - User's RBAC role
 * @param institutionId - User's institution ID (optional)
 * @param plural - If true, pluralize the label
 * @returns The resolved label string
 */
export async function resolveTermLabel(
  key: TermKey,
  role: UserRole,
  institutionId?: string | null,
  plural = false
): Promise<string> {
  const terms = await resolveTerminology(role, institutionId);
  const label = terms[key];
  return plural ? pluralize(label) : label;
}

// ============================================================================
// Backwards-compatible exports (for existing consumers)
// ============================================================================

/**
 * @deprecated Use resolveTerminology() instead. Kept for backwards compatibility.
 */
export async function getTerminologyForRole(role: UserRole): Promise<TermMap> {
  return resolveTerminology(role);
}

/**
 * @deprecated Use resolveTermLabel() instead. Kept for backwards compatibility.
 */
export async function getTermLabel(
  key: TermKey,
  role: UserRole,
  plural = false
): Promise<string> {
  return resolveTermLabel(key, role, null, plural);
}
