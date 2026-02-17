/**
 * validate-dependencies.ts
 *
 * Validates that spec dependencies (context.dependsOn) are satisfied
 * before pipeline execution. Reads dependsOn from spec config or rawSpec.
 *
 * Does NOT hard-fail — logs warnings and returns validation results
 * so the pipeline can decide how to handle missing dependencies.
 */

import { prisma } from "@/lib/prisma";

export interface DependencyValidation {
  valid: boolean;
  warnings: string[];
  /** Specs that were skipped due to missing dependencies */
  skipped: Array<{ specSlug: string; missingDeps: string[] }>;
}

/**
 * Validate that all specs in the pipeline have their dependencies satisfied.
 * Dependencies are spec IDs listed in context.dependsOn from the spec JSON.
 *
 * @param specSlugs - slugs of specs about to run
 * @returns validation result with warnings for missing deps
 */
export async function validateSpecDependencies(
  specSlugs: string[],
): Promise<DependencyValidation> {
  if (specSlugs.length === 0) {
    return { valid: true, warnings: [], skipped: [] };
  }

  // Load specs with their source feature sets to get rawSpec
  const specs = await prisma.analysisSpec.findMany({
    where: { slug: { in: specSlugs } },
    select: {
      id: true,
      slug: true,
      config: true,
      sourceFeatureSet: {
        select: { rawSpec: true },
      },
    },
  });

  // Build a set of all active spec IDs (by featureId like "PERS-001")
  const allActiveSpecs = await prisma.analysisSpec.findMany({
    where: { isActive: true },
    select: { slug: true },
  });

  // Map slugs to featureIds: "spec-pers-001" -> "PERS-001"
  // Convention: slug is "spec-{id-lowercased}" or just the lowercased ID
  const activeFeatureIds = new Set<string>();
  for (const s of allActiveSpecs) {
    // Extract feature ID from slug: "spec-pers-001" -> "PERS-001"
    const featureId = s.slug
      .replace(/^spec-/, "")
      .toUpperCase();
    activeFeatureIds.add(featureId);
    // Also add the raw slug for flexible matching
    activeFeatureIds.add(s.slug);
  }

  const warnings: string[] = [];
  const skipped: Array<{ specSlug: string; missingDeps: string[] }> = [];

  for (const spec of specs) {
    // Try to get dependsOn from multiple sources
    let dependsOn: string[] = [];

    // Source 1: spec.config.dependsOn (if seeded there)
    const specConfig = spec.config as Record<string, any> | null;
    if (specConfig?.dependsOn && Array.isArray(specConfig.dependsOn)) {
      dependsOn = specConfig.dependsOn;
    }

    // Source 2: rawSpec.context.dependsOn (original spec JSON)
    if (dependsOn.length === 0 && spec.sourceFeatureSet?.rawSpec) {
      const rawSpec = spec.sourceFeatureSet.rawSpec as Record<string, any>;
      if (rawSpec?.context?.dependsOn && Array.isArray(rawSpec.context.dependsOn)) {
        dependsOn = rawSpec.context.dependsOn;
      }
    }

    if (dependsOn.length === 0) continue;

    // Check each dependency
    const missingDeps: string[] = [];
    for (const dep of dependsOn) {
      if (!activeFeatureIds.has(dep) && !activeFeatureIds.has(dep.toUpperCase())) {
        missingDeps.push(dep);
      }
    }

    if (missingDeps.length > 0) {
      const msg = `Spec "${spec.slug}" depends on [${missingDeps.join(", ")}] which are not active`;
      warnings.push(msg);
      skipped.push({ specSlug: spec.slug, missingDeps });
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
    skipped,
  };
}
