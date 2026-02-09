#!/usr/bin/env tsx

/**
 * Schema Health Check
 *
 * Validates database schema consistency and identifies potential issues:
 * - Orphaned relations (foreign keys pointing to non-existent records)
 * - Missing required relationships
 * - Data integrity issues
 */

import { prisma } from "../lib/prisma";

async function main() {
  console.log("🏥 Running Schema Health Check\n");
  console.log("=".repeat(60));

  const issues: string[] = [];
  const warnings: string[] = [];

  // 1. Check PromptSlug → Parameter linkages
  console.log("\n📊 Checking PromptSlug → Parameter linkages...");

  const slugsWithoutParams = await prisma.promptSlug.findMany({
    where: {
      sourceType: "PARAMETER",
      parameters: {
        none: {},
      },
    },
    select: {
      slug: true,
      name: true,
      sourceType: true,
    },
  });

  if (slugsWithoutParams.length > 0) {
    issues.push(
      `Found ${slugsWithoutParams.length} PARAMETER-type PromptSlugs with no parameter links`
    );
    console.log(`   ❌ ${slugsWithoutParams.length} PARAMETER slugs without parameters`);
    slugsWithoutParams.slice(0, 5).forEach((s) => {
      console.log(`      - ${s.slug}`);
    });
    if (slugsWithoutParams.length > 5) {
      console.log(`      ... and ${slugsWithoutParams.length - 5} more`);
    }
  } else {
    console.log("   ✅ All PARAMETER slugs have parameter links");
  }

  // 2. Check PromptSlugParameter → Parameter validity
  console.log("\n📊 Checking PromptSlugParameter foreign keys...");

  const invalidParamLinks = await prisma.$queryRaw<
    Array<{ id: string; parameterId: string; slugId: string }>
  >`
    SELECT psp.id, psp."parameterId", psp."slugId"
    FROM "PromptSlugParameter" psp
    LEFT JOIN "Parameter" p ON psp."parameterId" = p."parameterId"
    WHERE p."parameterId" IS NULL
  `;

  if (invalidParamLinks.length > 0) {
    issues.push(
      `Found ${invalidParamLinks.length} PromptSlugParameter records pointing to non-existent parameters`
    );
    console.log(`   ❌ ${invalidParamLinks.length} invalid parameter references`);
    invalidParamLinks.slice(0, 5).forEach((link) => {
      console.log(`      - ${link.parameterId} (missing)`);
    });
  } else {
    console.log("   ✅ All PromptSlugParameter records have valid parameter references");
  }

  // 3. Check for duplicate PromptSlugs
  console.log("\n📊 Checking for duplicate PromptSlug slugs...");

  const slugDuplicates = await prisma.$queryRaw<
    Array<{ slug: string; count: number }>
  >`
    SELECT slug, COUNT(*) as count
    FROM "PromptSlug"
    GROUP BY slug
    HAVING COUNT(*) > 1
  `;

  if (slugDuplicates.length > 0) {
    issues.push(`Found ${slugDuplicates.length} duplicate PromptSlug slugs`);
    console.log(`   ❌ ${slugDuplicates.length} duplicate slugs`);
    slugDuplicates.forEach((d) => {
      console.log(`      - ${d.slug} (${d.count} copies)`);
    });
  } else {
    console.log("   ✅ No duplicate PromptSlug slugs");
  }

  // 4. Check Parameter → PromptSlugParameter consistency
  console.log("\n📊 Checking parameter types vs slug linkages...");

  const paramsWithPromptGuidance = await prisma.parameter.findMany({
    where: {
      parameterType: "BEHAVIOR",
    },
    select: {
      parameterId: true,
      name: true,
      promptSlugLinks: {
        select: {
          slug: {
            select: {
              slug: true,
            },
          },
        },
      },
    },
  });

  const behaviorParamsWithoutSlugs = paramsWithPromptGuidance.filter(
    (p) => p.promptSlugLinks.length === 0
  );

  if (behaviorParamsWithoutSlugs.length > 0) {
    warnings.push(
      `Found ${behaviorParamsWithoutSlugs.length} BEHAVIOR parameters without guidance slugs (may be expected)`
    );
    console.log(
      `   ⚠️  ${behaviorParamsWithoutSlugs.length} BEHAVIOR params without guidance slugs (may be expected)`
    );
  } else {
    console.log("   ✅ All BEHAVIOR parameters have guidance slugs");
  }

  // 5. Check PromptSlugRange integrity
  console.log("\n📊 Checking PromptSlugRange coverage...");

  const slugsWithoutRanges = await prisma.promptSlug.findMany({
    where: {
      sourceType: "PARAMETER",
      ranges: {
        none: {},
      },
    },
    select: {
      slug: true,
      name: true,
    },
  });

  if (slugsWithoutRanges.length > 0) {
    warnings.push(
      `Found ${slugsWithoutRanges.length} PARAMETER slugs without ranges (need fallbackPrompt)`
    );
    console.log(
      `   ⚠️  ${slugsWithoutRanges.length} PARAMETER slugs without ranges`
    );
  } else {
    console.log("   ✅ All PARAMETER slugs have ranges");
  }

  // 6. Check BDDFeatureSet provenance
  console.log("\n📊 Checking spec provenance...");

  const specsWithoutProvenance = await prisma.analysisSpec.count({
    where: {
      sourceFeatureSetId: null,
    },
  });

  if (specsWithoutProvenance > 0) {
    warnings.push(
      `Found ${specsWithoutProvenance} specs without source provenance (may be legacy)`
    );
    console.log(
      `   ⚠️  ${specsWithoutProvenance} specs without sourceFeatureSetId (may be legacy)`
    );
  } else {
    console.log("   ✅ All specs have source provenance");
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📋 HEALTH CHECK SUMMARY\n");

  if (issues.length === 0 && warnings.length === 0) {
    console.log("✅ Schema is healthy! No issues or warnings found.");
  } else {
    if (issues.length > 0) {
      console.log(`❌ CRITICAL ISSUES (${issues.length}):`);
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
      console.log();
    }

    if (warnings.length > 0) {
      console.log(`⚠️  WARNINGS (${warnings.length}):`);
      warnings.forEach((warning, i) => {
        console.log(`   ${i + 1}. ${warning}`);
      });
      console.log();
    }

    if (issues.length > 0) {
      console.log("❌ Schema has critical issues that should be addressed.");
      process.exit(1);
    } else {
      console.log("⚠️  Schema has warnings but no critical issues.");
    }
  }
}

main()
  .catch((error) => {
    console.error("❌ Error running health check:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
