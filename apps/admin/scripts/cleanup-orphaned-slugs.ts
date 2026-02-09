#!/usr/bin/env tsx

/**
 * Cleanup orphaned PromptSlugs (no parameter links)
 *
 * Finds and deletes PromptSlugs that have no PromptSlugParameter links,
 * which makes them orphaned in the taxonomy graph.
 */

import { prisma } from "../lib/prisma";

async function main() {
  console.log("🔍 Finding orphaned PromptSlugs...\n");

  // Find orphaned PromptSlugs (no parameter links)
  // EXCLUDE: Template slugs (init.*, persona-specific) that are intentionally orphaned
  const orphanedSlugs = await prisma.promptSlug.findMany({
    where: {
      parameters: {
        none: {}, // No PromptSlugParameter links
      },
      AND: [
        {
          slug: {
            notIn: ["init.welcome.tutor", "init.welcome.companion", "init.welcome.coach"],
          },
        },
        {
          slug: {
            not: {
              startsWith: "init.phase.", // Exclude all init phase slugs
            },
          },
        },
      ],
    },
    select: {
      id: true,
      slug: true,
      name: true,
      sourceType: true,
      createdAt: true,
    },
    orderBy: {
      slug: "asc",
    },
  });

  if (orphanedSlugs.length === 0) {
    console.log("✅ No orphaned PromptSlugs found!");
    return;
  }

  console.log(`Found ${orphanedSlugs.length} orphaned PromptSlugs:\n`);
  console.table(
    orphanedSlugs.map((s) => ({
      slug: s.slug,
      name: s.name,
      sourceType: s.sourceType,
      created: s.createdAt.toISOString().split("T")[0],
    }))
  );

  console.log("\n🗑️  Deleting orphaned PromptSlugs...\n");

  // Delete orphaned PromptSlugs
  const deleteResult = await prisma.promptSlug.deleteMany({
    where: {
      id: {
        in: orphanedSlugs.map((s) => s.id),
      },
    },
  });

  console.log(`✅ Deleted ${deleteResult.count} orphaned PromptSlugs`);

  // Also clean up orphaned ranges for these slugs (cascade should handle this, but be explicit)
  const rangeDeleteResult = await prisma.promptSlugRange.deleteMany({
    where: {
      slugId: {
        in: orphanedSlugs.map((s) => s.id),
      },
    },
  });

  if (rangeDeleteResult.count > 0) {
    console.log(`   └─ Also deleted ${rangeDeleteResult.count} associated ranges`);
  }

  console.log("\n✨ Cleanup complete!");
}

main()
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
