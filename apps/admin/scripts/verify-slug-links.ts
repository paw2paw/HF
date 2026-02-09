#!/usr/bin/env tsx

/**
 * Verify that spec-*-guidance PromptSlugs have proper parameter links
 */

import { prisma } from "../lib/prisma";

async function main() {
  console.log("🔍 Checking spec-*-guidance PromptSlugs...\n");

  const guidanceSlugs = await prisma.promptSlug.findMany({
    where: {
      slug: {
        startsWith: "spec-",
        endsWith: "-guidance",
      },
    },
    include: {
      parameters: {
        include: {
          parameter: {
            select: {
              parameterId: true,
              name: true,
            },
          },
        },
      },
      ranges: {
        select: {
          id: true,
          label: true,
          minValue: true,
          maxValue: true,
        },
      },
    },
  });

  console.log(`Found ${guidanceSlugs.length} spec-*-guidance PromptSlugs:\n`);

  for (const slug of guidanceSlugs) {
    const hasParams = slug.parameters.length > 0;
    const hasRanges = slug.ranges.length > 0;
    const status = hasParams ? "✅" : "❌";

    console.log(`${status} ${slug.slug}`);
    console.log(`   Name: ${slug.name}`);
    console.log(`   Parameters: ${slug.parameters.length}`);
    if (slug.parameters.length > 0) {
      slug.parameters.forEach((p) => {
        console.log(`      → ${p.parameter.parameterId} (${p.parameter.name})`);
      });
    }
    console.log(`   Ranges: ${slug.ranges.length}`);
    if (slug.ranges.length > 0) {
      slug.ranges.forEach((r) => {
        console.log(`      → ${r.label}: ${r.minValue} - ${r.maxValue}`);
      });
    }
    console.log();
  }

  const orphanedCount = guidanceSlugs.filter((s) => s.parameters.length === 0).length;

  if (orphanedCount === 0) {
    console.log("✅ All spec-*-guidance PromptSlugs have parameter links!");
  } else {
    console.log(`❌ ${orphanedCount} spec-*-guidance PromptSlugs are still orphaned`);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
