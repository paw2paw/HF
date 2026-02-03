/**
 * Master Seed Script
 *
 * Runs seed scripts to set up a fresh database.
 *
 * Usage:
 *   npx tsx prisma/seed-all.ts              # Clean seed (from spec files only)
 *   npx tsx prisma/seed-all.ts --legacy     # Old seed with sample/mock data
 *   npx tsx prisma/seed-all.ts --verbose    # Show detailed output
 *   npx tsx prisma/seed-all.ts --reset      # Clear DB first (passed to clean seed)
 *
 * DEFAULT: seed-clean.ts (single source of truth - specs + transcripts only)
 * LEGACY:  seed-mabel.ts + seed-wnf.ts (includes sample/mock data)
 */

import { execSync } from "child_process";
import path from "path";

interface SeedConfig {
  name: string;
  script: string;
  description: string;
  args?: string[];
}

// Clean seed - single source of truth (NO hardcoded data)
const CLEAN_SEEDS: SeedConfig[] = [
  {
    name: "Clean Seed (Spec-First)",
    script: "seed-clean.ts",
    description: "Load from bdd-specs/ and transcripts/ only - no hardcoded data",
    args: ["--reset"],
  },
];

// Legacy seeds - includes sample/mock data (for development/testing)
const LEGACY_SEEDS: SeedConfig[] = [
  {
    name: "Mabel (Full Reset)",
    script: "seed-mabel.ts",
    description: "Full database reset with base data, parameters, and BDD specs",
  },
  {
    name: "WNF Domain",
    script: "seed-wnf.ts",
    description: "Why Nations Fail domain, playbook, and system spec links",
  },
];

async function runSeed(seed: SeedConfig, verbose: boolean, extraArgs: string[] = []): Promise<boolean> {
  const scriptPath = path.resolve(__dirname, seed.script);
  const allArgs = [...(seed.args || []), ...extraArgs].join(" ");

  try {
    console.log(`\n📦 ${seed.name}`);
    console.log(`   ${seed.description}`);

    const output = execSync(`npx tsx "${scriptPath}" ${allArgs}`, {
      encoding: "utf-8",
      stdio: verbose ? "inherit" : "pipe",
      cwd: path.resolve(__dirname, ".."),
    });

    if (!verbose && output) {
      const lines = output.trim().split("\n");
      const summaryLines = lines.filter(
        (l) =>
          l.includes("Seeded") ||
          l.includes("Created") ||
          l.includes("Upserted") ||
          l.includes("✅") ||
          l.includes("Specs:") ||
          l.includes("Parameters:") ||
          l.includes("Callers:") ||
          l.includes("Calls:")
      );
      if (summaryLines.length > 0) {
        console.log(`   ${summaryLines.join("\n   ")}`);
      }
    }

    console.log(`   ✅ Done`);
    return true;
  } catch (err: any) {
    console.error(`   ❌ Failed: ${err.message}`);
    if (verbose && err.stderr) {
      console.error(err.stderr);
    }
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose") || args.includes("-v");
  const useLegacy = args.includes("--legacy") || args.includes("-l");
  const reset = args.includes("--reset") || args.includes("-r");

  const seeds = useLegacy ? LEGACY_SEEDS : CLEAN_SEEDS;
  const mode = useLegacy ? "LEGACY (with sample data)" : "CLEAN (spec-first)";

  console.log("\n🌱 MASTER SEED SCRIPT\n");
  console.log(`Mode: ${mode}`);
  console.log(`Seeds to run: ${seeds.length}`);

  if (!useLegacy) {
    console.log("\n💡 Using clean seed (single source of truth):");
    console.log("   • All specs from bdd-specs/*.spec.json");
    console.log("   • All callers/calls from transcripts/");
    console.log("   • NO hardcoded/mock data");
    console.log("\n   Use --legacy for old seed with sample data.");
  }

  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;

  const extraArgs: string[] = [];
  if (reset && !useLegacy) {
    // Reset is already in CLEAN_SEEDS args
  }

  for (const seed of seeds) {
    const success = await runSeed(seed, verbose, extraArgs);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n" + "=".repeat(50));
  console.log("🌱 SEEDING COMPLETE\n");
  console.log(`  ✅ Succeeded: ${successCount}`);
  if (failCount > 0) {
    console.log(`  ❌ Failed:    ${failCount}`);
  }
  console.log(`  ⏱️  Duration:  ${duration}s`);
  console.log("\nNext steps:");
  console.log("  1. Go to /x/studio to configure playbooks");
  console.log("  2. Select a caller and generate a prompt");
  console.log("  3. Test with VAPI or your voice AI");
  console.log("");

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Seed-all failed:", err);
  process.exit(1);
});
