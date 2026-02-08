/**
 * Seed WNF (Why Nations Fail) - Enhancement Script
 *
 * NOTE: This file is disabled due to schema mismatches.
 * CurriculumModule and PlaybookSpec models do not exist in current schema.
 *
 * Original purpose:
 * - Creates curriculum modules for the WNF curriculum
 * - Links TUT-001 and VOICE-001 system specs to the playbook
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n⚠️  seed-wnf.ts is disabled - schema update needed");
  console.log("   CurriculumModule and PlaybookSpec models not in current schema\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
