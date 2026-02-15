/**
 * Seed a default "HumanFirst" institution.
 *
 * Usage: npx tsx prisma/seed-default-institution.ts
 *
 * Upserts the default institution and optionally assigns all
 * existing users and cohorts that have no institution.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const institution = await prisma.institution.upsert({
    where: { slug: "humanfirst" },
    update: {},
    create: {
      name: "HumanFirst",
      slug: "humanfirst",
      primaryColor: "#4f46e5",
      secondaryColor: "#3b82f6",
      welcomeMessage: "Welcome to HumanFirst",
    },
  });

  console.log(`Institution: ${institution.name} (${institution.id})`);

  // Assign orphaned users
  const userResult = await prisma.user.updateMany({
    where: { institutionId: null },
    data: { institutionId: institution.id },
  });
  console.log(`  Assigned ${userResult.count} users`);

  // Assign orphaned cohorts
  const cohortResult = await prisma.cohortGroup.updateMany({
    where: { institutionId: null },
    data: { institutionId: institution.id },
  });
  console.log(`  Assigned ${cohortResult.count} cohorts`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
