/**
 * Full Seed Orchestrator
 *
 * Runs seed scripts in dependency order, filtered by SEED_PROFILE.
 * Shares a single PrismaClient across all steps.
 *
 * Usage:
 *   npx tsx prisma/seed-full.ts              # Full seed (additive, all steps)
 *   npx tsx prisma/seed-full.ts --reset      # Clear DB first, then full seed
 *   SEED_PROFILE=core npx tsx prisma/seed-full.ts   # PROD — specs + demo domains only
 *   SEED_PROFILE=test npx tsx prisma/seed-full.ts   # TEST — core + e2e fixtures
 *   SEED_PROFILE=full npx tsx prisma/seed-full.ts   # DEV/VM — everything (default)
 *
 * Profiles:
 *   core  — Specs, domains, institution, demo domains, run configs, dedup (PROD)
 *   test  — Everything in core + e2e fixtures (TEST)
 *   full  — Everything in test + educator demo, school data, legacy fixtures (DEV/VM)
 *
 * Steps (full profile):
 *   1.  seed-clean              → 51 specs, 160 params, admin user, contracts
 *   2.  seed-institution-types  → 5 institution types (school, corporate, community, coaching, healthcare)
 *   3.  seed-domains            → 4 professional domains
 *   4.  seed-default-institution → "HumanFirst" institution
 *   5.  seed-demo-domains       → 12 demo callers + 4 playbooks (3 per domain)
 *   6.  seed-run-configs        → 8 analysis run config templates
 *   7.  seed (dedup)            → Parameter deduplication cleanup
 *   8.  seed-e2e                → E2E test fixtures                    [test, full]
 *   9.  seed-educator-demo      → 3 schools, 10 teachers, 210 pupils   [full only]
 *   10. seed-school-institutions → School institution records           [full only]
 *   11. seed-demo-fixtures      → "Paul" demo caller, QM overlay       [full only]
 */

import { PrismaClient } from "@prisma/client";

import { main as seedClean } from "./seed-clean";
import { main as seedDomains } from "./seed-domains";
import { main as seedDefaultInstitution } from "./seed-default-institution";
import { main as seedDemoDomains } from "./seed-demo-domains";
import { main as seedRunConfigs } from "./seed-run-configs";
import { main as seedDedup } from "./seed";
import { main as seedE2E } from "./seed-e2e";
import { main as seedEducatorDemo } from "./seed-educator-demo";
import { main as seedSchoolInstitutions } from "./seed-school-institutions";
import { main as seedDemoFixtures } from "./seed-demo-fixtures";
import { main as seedInstitutionTypes } from "./seed-institution-types";

type Profile = "core" | "test" | "full";

interface Step {
  name: string;
  fn: (prisma: PrismaClient, opts?: any) => Promise<void>;
  /** Which profiles include this step. Omit = all profiles. */
  profiles?: Profile[];
}

const ALL_STEPS: Step[] = [
  // ── Core (runs in every profile) ──────────────────────
  { name: "seed-clean", fn: seedClean },
  { name: "seed-institution-types", fn: seedInstitutionTypes },
  { name: "seed-domains", fn: seedDomains },
  { name: "seed-default-institution", fn: seedDefaultInstitution },
  { name: "seed-demo-domains", fn: seedDemoDomains },
  { name: "seed-run-configs", fn: seedRunConfigs },
  { name: "seed (dedup)", fn: seedDedup },

  // ── Test (core + e2e fixtures) ────────────────────────
  { name: "seed-e2e", fn: seedE2E, profiles: ["test", "full"] },

  // ── Full (test + educator/school/legacy data) ─────────
  { name: "seed-educator-demo", fn: seedEducatorDemo, profiles: ["full"] },
  { name: "seed-school-institutions", fn: seedSchoolInstitutions, profiles: ["full"] },
  { name: "seed-demo-fixtures", fn: seedDemoFixtures, profiles: ["full"] },
];

function getProfile(): Profile {
  const val = process.env.SEED_PROFILE || "full";
  if (val === "core" || val === "test" || val === "full") return val;
  console.warn(`Invalid SEED_PROFILE "${val}", defaulting to "full"`);
  return "full";
}

function filterSteps(profile: Profile): Step[] {
  return ALL_STEPS.filter((step) => {
    if (!step.profiles) return true; // no restriction = all profiles
    return step.profiles.includes(profile);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const shouldReset = args.includes("--reset") || args.includes("-r");
  const profile = getProfile();
  const steps = filterSteps(profile);

  const prisma = new PrismaClient();
  const t0 = Date.now();

  console.log("\n" + "=".repeat(60));
  console.log("  FULL SEED ORCHESTRATOR");
  console.log("=".repeat(60));
  console.log(`\n  Profile: ${profile.toUpperCase()}`);
  console.log(`  Steps:   ${steps.length} / ${ALL_STEPS.length}`);
  console.log(`  Reset:   ${shouldReset ? "YES" : "no (additive)"}\n`);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n${"─".repeat(60)}`);
    console.log(`  [${i + 1}/${steps.length}] ${step.name}`);
    console.log("─".repeat(60));

    const stepStart = Date.now();

    // seed-clean accepts opts for reset
    if (step.name === "seed-clean") {
      await step.fn(prisma, { reset: shouldReset });
    } else {
      await step.fn(prisma);
    }

    const stepElapsed = ((Date.now() - stepStart) / 1000).toFixed(1);
    console.log(`  done ${step.name} (${stepElapsed}s)`);
  }

  // Verification table
  const [specs, params, domains, institutions, users, callers, calls, scores, memories, goals, profiles_count] =
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

  console.log("\n" + "=".repeat(60));
  console.log("  SEED COMPLETE");
  console.log("=".repeat(60));
  console.log(`
  Profile:        ${profile.toUpperCase()}
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
  Profiles:       ${profiles_count}
  Time:           ${elapsed}s
`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("\nFull seed failed:", e);
  process.exit(1);
});
