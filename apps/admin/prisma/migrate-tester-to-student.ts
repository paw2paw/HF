/**
 * One-time data migration: TESTER → STUDENT
 *
 * Finds Users with role=TESTER that have a linked Caller with
 * role=LEARNER and a cohortGroupId (i.e., they're in a classroom).
 * Updates their User.role to STUDENT.
 *
 * Usage: npx tsx prisma/migrate-tester-to-student.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find TESTER users who are actually students (linked to LEARNER callers in a cohort)
  const testerStudents = await prisma.user.findMany({
    where: {
      role: "TESTER",
      callers: {
        some: {
          role: "LEARNER",
          cohortGroupId: { not: null },
        },
      },
    },
    select: { id: true, email: true, name: true },
  });

  if (testerStudents.length === 0) {
    console.log("No TESTER users with LEARNER callers in cohorts found. Nothing to migrate.");
    return;
  }

  console.log(`Found ${testerStudents.length} TESTER user(s) to migrate to STUDENT:`);
  for (const u of testerStudents) {
    console.log(`  - ${u.email} (${u.name || "unnamed"}) [${u.id}]`);
  }

  const result = await prisma.user.updateMany({
    where: {
      id: { in: testerStudents.map((u) => u.id) },
    },
    data: {
      role: "STUDENT",
    },
  });

  console.log(`Migrated ${result.count} user(s) from TESTER to STUDENT.`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
