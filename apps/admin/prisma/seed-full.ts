/**
 * Full Seed Orchestrator
 *
 * Runs ALL 9 seed scripts in dependency order, sharing a single PrismaClient.
 * This ensures all environments get identical, fully-loaded data.
 *
 * Usage:
 *   npx tsx prisma/seed-full.ts              # Full seed (additive)
 *   npx tsx prisma/seed-full.ts --reset      # Clear DB first, then full seed
 *
 * Sequence:
 *   1. seed-clean        → 51 specs, 160 params, admin user, contracts
 *   2. seed-domains      → 4 domains (tutor, support, sales, wellness)
 *   3. seed-default-institution → "HumanFirst" institution
 *   4. seed-educator-demo → 3 schools, 10 teachers, 210 pupils, 850 calls, 5000+ scores
 *   5. seed-school-institutions → School institution records + user reassignment
 *   6. seed-demo-fixtures → "Paul" demo caller, QM domain, playbook
 *   7. seed-run-configs   → 8 analysis run config templates
 *   8. seed (dedup)       → Parameter deduplication cleanup
 *   9. seed-e2e           → E2E test fixtures
 */

import { PrismaClient } from "@prisma/client";

import { main as seedClean } from "./seed-clean";
import { main as seedDomains } from "./seed-domains";
import { main as seedDefaultInstitution } from "./seed-default-institution";
import { main as seedEducatorDemo } from "./seed-educator-demo";
import { main as seedSchoolInstitutions } from "./seed-school-institutions";
import { main as seedDemoFixtures } from "./seed-demo-fixtures";
import { main as seedRunConfigs } from "./seed-run-configs";
import { main as seedDedup } from "./seed";
import { main as seedE2E } from "./seed-e2e";

const STEPS = [
  { name: "seed-clean", fn: seedClean },
  { name: "seed-domains", fn: seedDomains },
  { name: "seed-default-institution", fn: seedDefaultInstitution },
  { name: "seed-educator-demo", fn: seedEducatorDemo },
  { name: "seed-school-institutions", fn: seedSchoolInstitutions },
  { name: "seed-demo-fixtures", fn: seedDemoFixtures },
  { name: "seed-run-configs", fn: seedRunConfigs },
  { name: "seed (dedup)", fn: seedDedup },
  { name: "seed-e2e", fn: seedE2E },
];

async function main() {
  const args = process.argv.slice(2);
  const shouldReset = args.includes("--reset") || args.includes("-r");

  const prisma = new PrismaClient();
  const t0 = Date.now();

  console.log("\n" + "═".repeat(60));
  console.log("  🌱 FULL SEED ORCHESTRATOR");
  console.log("═".repeat(60));
  console.log(`\n  Steps: ${STEPS.length}`);
  console.log(`  Reset: ${shouldReset ? "YES" : "no (additive)"}\n`);

  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    console.log(`\n${"─".repeat(60)}`);
    console.log(`  [${i + 1}/${STEPS.length}] ${step.name}`);
    console.log("─".repeat(60));

    const stepStart = Date.now();

    // seed-clean accepts opts for reset
    if (step.name === "seed-clean") {
      await step.fn(prisma, { reset: shouldReset });
    } else {
      await step.fn(prisma);
    }

    const stepElapsed = ((Date.now() - stepStart) / 1000).toFixed(1);
    console.log(`  ✓ ${step.name} (${stepElapsed}s)`);
  }

  // Verification table
  const [specs, params, domains, institutions, users, callers, calls, scores, memories, goals, profiles] =
    await Promise.all([
      prisma.analysisSpec.count(),
      prisma.parameter.count(),
      prisma.domain.count(),
      prisma.institution.count(),
      prisma.user.count(),
      prisma.caller.count(),
      prisma.call.count(),
      prisma.callScore.count(),
      prisma.callerMemory.count(),
      prisma.goal.count(),
      prisma.analysisProfile.count(),
    ]);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log("\n" + "═".repeat(60));
  console.log("  ✅ FULL SEED COMPLETE");
  console.log("═".repeat(60));
  console.log(`
  Specs:          ${specs}
  Parameters:     ${params}
  Domains:        ${domains}
  Institutions:   ${institutions}
  Users:          ${users}
  Callers:        ${callers}
  Calls:          ${calls}
  CallScores:     ${scores}
  Memories:       ${memories}
  Goals:          ${goals}
  Profiles:       ${profiles}
  Time:           ${elapsed}s
`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("\n❌ Full seed failed:", e);
  process.exit(1);
});
