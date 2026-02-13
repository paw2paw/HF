/**
 * validate-source-authority.ts
 *
 * Validates that a spec's sourceAuthority references valid ContentSource records.
 * Enriches sourceAuthority with DB-sourced metadata (validity dates, publisher, etc.).
 *
 * Called during spec creation, update, and import.
 */

import { prisma } from "@/lib/prisma";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SourceRef {
  slug: string;
  name?: string;
  trustLevel?: string;
  publisherOrg?: string;
  authors?: string[];
  edition?: string;
  publicationYear?: number;
  qualificationRef?: string;
  moduleCoverage?: string[];
  [key: string]: any;
}

interface SourceAuthority {
  primarySource?: SourceRef;
  secondarySources?: SourceRef[];
  contract?: string;
  [key: string]: any;
}

interface ValidationError {
  field: string;
  message: string;
  slug?: string;
}

interface ValidationWarning {
  field: string;
  message: string;
  slug?: string;
}

export interface SourceAuthorityValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  /** Enriched sourceAuthority with DB metadata merged in */
  enriched: SourceAuthority | null;
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate and enrich a spec's sourceAuthority against ContentSource DB records.
 *
 * - Checks that each referenced slug exists in ContentSource table
 * - Warns if sources are expired or expiring soon
 * - Enriches sourceAuthority with DB fields (validUntil, publisher, etc.)
 * - Returns validation result with errors/warnings
 */
export async function validateSourceAuthority(
  sourceAuthority: SourceAuthority | null | undefined,
): Promise<SourceAuthorityValidationResult> {
  const result: SourceAuthorityValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    enriched: null,
  };

  if (!sourceAuthority) {
    return result;
  }

  // Collect all slugs to validate
  const slugsToCheck: { slug: string; field: string }[] = [];

  if (sourceAuthority.primarySource?.slug) {
    slugsToCheck.push({
      slug: sourceAuthority.primarySource.slug,
      field: "sourceAuthority.primarySource",
    });
  }

  if (sourceAuthority.secondarySources) {
    for (let i = 0; i < sourceAuthority.secondarySources.length; i++) {
      const src = sourceAuthority.secondarySources[i];
      if (src?.slug) {
        slugsToCheck.push({
          slug: src.slug,
          field: `sourceAuthority.secondarySources[${i}]`,
        });
      }
    }
  }

  if (slugsToCheck.length === 0) {
    return result;
  }

  // Query all referenced sources in one batch
  const allSlugs = slugsToCheck.map((s) => s.slug);
  const dbSources = await prisma.contentSource.findMany({
    where: { slug: { in: allSlugs } },
  });

  const sourceMap = new Map(dbSources.map((s) => [s.slug, s]));

  // Validate each reference
  for (const { slug, field } of slugsToCheck) {
    const dbSource = sourceMap.get(slug);

    if (!dbSource) {
      result.errors.push({
        field,
        slug,
        message: `ContentSource "${slug}" not found in registry. Register it at /x/content-sources first.`,
      });
      result.valid = false;
      continue;
    }

    // Check freshness
    if (dbSource.validUntil) {
      const now = new Date();
      const daysUntilExpiry = Math.floor(
        (dbSource.validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysUntilExpiry < 0) {
        result.warnings.push({
          field,
          slug,
          message: `Source "${slug}" expired ${Math.abs(daysUntilExpiry)} days ago (${dbSource.validUntil.toISOString().split("T")[0]}).`,
        });
      } else if (daysUntilExpiry <= 60) {
        result.warnings.push({
          field,
          slug,
          message: `Source "${slug}" expires in ${daysUntilExpiry} days (${dbSource.validUntil.toISOString().split("T")[0]}).`,
        });
      }
    }

    // Check if superseded
    if (dbSource.supersededById) {
      result.warnings.push({
        field,
        slug,
        message: `Source "${slug}" has been superseded by a newer version.`,
      });
    }
  }

  // Build enriched sourceAuthority with DB metadata
  const enriched: SourceAuthority = { ...sourceAuthority };

  if (sourceAuthority.primarySource?.slug) {
    const db = sourceMap.get(sourceAuthority.primarySource.slug);
    if (db) {
      enriched.primarySource = enrichFromDb(sourceAuthority.primarySource, db);
    }
  }

  if (sourceAuthority.secondarySources) {
    enriched.secondarySources = sourceAuthority.secondarySources.map((src) => {
      const db = sourceMap.get(src.slug);
      return db ? enrichFromDb(src, db) : src;
    });
  }

  result.enriched = enriched;
  return result;
}

/**
 * Merge DB fields into a spec source reference.
 * DB values fill in blanks; spec values take precedence for overrides.
 */
function enrichFromDb(specRef: SourceRef, dbSource: any): SourceRef {
  return {
    ...specRef,
    name: specRef.name || dbSource.name,
    trustLevel: specRef.trustLevel || dbSource.trustLevel,
    publisherOrg: specRef.publisherOrg || dbSource.publisherOrg,
    authors: specRef.authors?.length ? specRef.authors : dbSource.authors || [],
    edition: specRef.edition || dbSource.edition,
    publicationYear: specRef.publicationYear || dbSource.publicationYear,
    qualificationRef: specRef.qualificationRef || dbSource.qualificationRef,
    moduleCoverage: specRef.moduleCoverage?.length
      ? specRef.moduleCoverage
      : dbSource.moduleCoverage || [],
    // DB-only fields (not typically in spec JSON)
    _dbId: dbSource.id,
    _validFrom: dbSource.validFrom?.toISOString() || null,
    _validUntil: dbSource.validUntil?.toISOString() || null,
    _accreditingBody: dbSource.accreditingBody || null,
    _accreditationRef: dbSource.accreditationRef || null,
    _isbn: dbSource.isbn || null,
  };
}

/**
 * Quick check: does this spec config have a sourceAuthority section?
 */
export function hasSourceAuthority(config: any): boolean {
  return !!(config?.sourceAuthority?.primarySource?.slug);
}

/**
 * List all ContentSource records for the source picker UI.
 */
export async function listAvailableSources(): Promise<
  Array<{
    slug: string;
    name: string;
    trustLevel: string;
    publisherOrg: string | null;
    validUntil: string | null;
    isExpired: boolean;
  }>
> {
  const sources = await prisma.contentSource.findMany({
    orderBy: [{ trustLevel: "asc" }, { name: "asc" }],
    select: {
      slug: true,
      name: true,
      trustLevel: true,
      publisherOrg: true,
      validUntil: true,
    },
  });

  const now = new Date();
  return sources.map((s) => ({
    slug: s.slug,
    name: s.name,
    trustLevel: s.trustLevel,
    publisherOrg: s.publisherOrg,
    validUntil: s.validUntil?.toISOString().split("T")[0] || null,
    isExpired: s.validUntil ? s.validUntil < now : false,
  }));
}
