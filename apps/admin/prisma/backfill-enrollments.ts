/**
 * Backfill CallerPlaybook enrollments for existing callers.
 *
 * For each caller with a domainId, creates ACTIVE enrollment records
 * for all PUBLISHED playbooks in that domain. Uses upsert to be idempotent.
 *
 * Run: npx tsx prisma/backfill-enrollments.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Backfilling CallerPlaybook enrollments...\n");

  // Find all callers with a domain assignment
  const callers = await prisma.caller.findMany({
    where: { domainId: { not: null }, archivedAt: null },
    select: { id: true, name: true, domainId: true },
  });

  console.log(`Found ${callers.length} active callers with domain assignments`);

  let created = 0;
  let skipped = 0;

  for (const caller of callers) {
    // Find all PUBLISHED playbooks in this caller's domain
    const playbooks = await prisma.playbook.findMany({
      where: { domainId: caller.domainId!, status: "PUBLISHED" },
      select: { id: true, name: true },
    });

    for (const playbook of playbooks) {
      try {
        await prisma.callerPlaybook.upsert({
          where: {
            callerId_playbookId: {
              callerId: caller.id,
              playbookId: playbook.id,
            },
          },
          create: {
            callerId: caller.id,
            playbookId: playbook.id,
            status: "ACTIVE",
            enrolledBy: "migration",
          },
          update: {}, // No-op if already exists
        });
        created++;
      } catch {
        skipped++;
      }
    }
  }

  console.log(`\nDone: ${created} enrollments created, ${skipped} skipped`);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
