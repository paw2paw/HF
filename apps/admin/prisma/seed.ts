/**
 * Parameter De-duplication Seed
 *
 * Reads existing parameters from the database, de-duplicates them by parameterId,
 * and ensures consistent tagging.
 *
 * Run with: npx tsx prisma/seed.ts
 */

import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

async function main() {
  console.log("De-duplicating existing parameters...\n");

  // Get all parameters
  const allParams = await prisma.parameter.findMany({
    include: {
      tags: {
        include: { tag: true },
      },
    },
    orderBy: { createdAt: "asc" }, // Keep oldest as canonical
  });

  if (allParams.length === 0) {
    console.log("No parameters found in database. Nothing to de-duplicate.");
    console.log("\nTo seed parameters, run the other seed scripts:");
    console.log("  npm run db:seed:all");
    return;
  }

  console.log(`Found ${allParams.length} total parameter records`);

  // Group by parameterId
  const byId = new Map<string, typeof allParams>();
  for (const param of allParams) {
    const existing = byId.get(param.parameterId) || [];
    existing.push(param);
    byId.set(param.parameterId, existing);
  }

  const uniqueCount = byId.size;
  const duplicateCount = allParams.length - uniqueCount;

  console.log(`Unique parameterIds: ${uniqueCount}`);
  console.log(`Duplicates to remove: ${duplicateCount}`);

  if (duplicateCount === 0) {
    console.log("\nNo duplicates found. Parameters are clean.");
    return;
  }

  // Process each group
  let removed = 0;
  let kept = 0;

  for (const [parameterId, params] of byId) {
    if (params.length === 1) {
      kept++;
      continue;
    }

    // Keep the first (oldest) one, delete the rest
    const [canonical, ...duplicates] = params;
    kept++;

    console.log(`\n  ${parameterId}: keeping 1, removing ${duplicates.length}`);

    for (const dup of duplicates) {
      // Delete the duplicate's tags first (FK constraint)
      await prisma.parameterTag.deleteMany({
        where: { parameterId: dup.parameterId },
      });

      // Delete the duplicate parameter
      await prisma.parameter.delete({
        where: { parameterId: dup.parameterId },
      });

      removed++;
    }
  }

  // Ensure all parameters have Active tag
  console.log("\nEnsuring Active tags on all parameters...");

  const activeTag = await prisma.tag.upsert({
    where: { slug: "active" },
    create: { id: randomUUID(), slug: "active", name: "Active" },
    update: {},
  });

  const paramsWithoutActive = await prisma.parameter.findMany({
    where: {
      tags: {
        none: {
          tag: { slug: "active" },
        },
      },
    },
  });

  let taggedActive = 0;
  for (const param of paramsWithoutActive) {
    await prisma.parameterTag.create({
      data: {
        id: randomUUID(),
        parameterId: param.parameterId,
        tagId: activeTag.id,
      },
    });
    taggedActive++;
  }

  console.log(`\n✅ De-duplication complete`);
  console.log(`   Parameters kept: ${kept}`);
  console.log(`   Duplicates removed: ${removed}`);
  console.log(`   Tagged as Active: ${taggedActive}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
