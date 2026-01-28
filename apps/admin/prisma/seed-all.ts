/**
 * Master Seed Script
 *
 * Runs all seed scripts in the correct order to set up a fresh database
 * with all necessary configuration data.
 *
 * Usage:
 *   npm run db:seed:all
 *   npx tsx prisma/seed-all.ts
 *   npx tsx prisma/seed-all.ts --skip-dedupe     # Skip parameter de-duplication
 *   npx tsx prisma/seed-all.ts --verbose         # Show detailed output
 *
 * Seeds are run in order:
 * 1. Parameters de-dupe - clean up existing parameters
 * 2. Parameter Types - type definitions
 * 3. Big Five traits - personality model
 * 4. BDD/Analysis Specs - scoring rubrics
 * 5. Memory extraction specs - memory patterns
 * 6. Prompt templates - LLM prompts
 * 7. Prompt slugs - prompt identifiers
 * 8. Run configs - agent configurations
 */

import { execSync } from "child_process";
import path from "path";

interface SeedConfig {
  name: string;
  script: string;
  description: string;
  skipFlag?: string;
}

const SEEDS: SeedConfig[] = [
  {
    name: "Parameters De-dupe",
    script: "seed.ts",
    description: "De-duplicate existing parameters and ensure tags",
    skipFlag: "--skip-dedupe",
  },
  {
    name: "Parameter Types",
    script: "seed-parameter-types.ts",
    description: "Set up parameter type definitions",
  },
  {
    name: "Big Five",
    script: "seed-big-five.ts",
    description: "Big Five personality model with scoring anchors",
  },
  {
    name: "BDD/Analysis Specs",
    script: "seed-bdd.ts",
    description: "MEASURE and LEARN analysis specifications",
  },
  {
    name: "Memory Specs",
    script: "seed-memory-specs.ts",
    description: "Memory extraction specifications",
  },
  {
    name: "Memory Slugs",
    script: "seed-memory-slugs.ts",
    description: "Memory category slugs",
  },
  {
    name: "Prompt Templates",
    script: "seed-prompt-templates.ts",
    description: "LLM prompt templates",
  },
  {
    name: "Prompt Slugs",
    script: "seed-prompt-slugs.ts",
    description: "Prompt slug taxonomy",
  },
  {
    name: "Run Configs",
    script: "seed-run-configs.ts",
    description: "Agent run configurations",
  },
  {
    name: "Adapt System",
    script: "seed-adapt-system.ts",
    description: "Adaptive prompting system",
  },
];

async function runSeed(seed: SeedConfig, verbose: boolean): Promise<boolean> {
  const scriptPath = path.resolve(__dirname, seed.script);

  try {
    console.log(`\n📦 ${seed.name}`);
    console.log(`   ${seed.description}`);

    const output = execSync(`npx tsx "${scriptPath}"`, {
      encoding: "utf-8",
      stdio: verbose ? "inherit" : "pipe",
      cwd: path.resolve(__dirname, ".."),
    });

    if (!verbose && output) {
      // Show just the summary line(s)
      const lines = output.trim().split("\n");
      const summaryLines = lines.filter(
        (l) =>
          l.includes("Seeded") ||
          l.includes("Created") ||
          l.includes("Upserted") ||
          l.includes("✅")
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
  const skipFlags = args.filter((a) => a.startsWith("--skip"));

  console.log("\n🌱 MASTER SEED SCRIPT\n");
  console.log("This will populate the database with all configuration data.");
  console.log(`Seeds to run: ${SEEDS.length}`);

  const startTime = Date.now();
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const seed of SEEDS) {
    // Check if this seed should be skipped
    if (seed.skipFlag && skipFlags.includes(seed.skipFlag)) {
      console.log(`\n⏭️  ${seed.name} (skipped)`);
      skipCount++;
      continue;
    }

    const success = await runSeed(seed, verbose);
    if (success) {
      successCount++;
    } else {
      failCount++;
      // Don't stop on failure - continue with other seeds
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n" + "=".repeat(50));
  console.log("🌱 SEEDING COMPLETE\n");
  console.log(`  ✅ Succeeded: ${successCount}`);
  if (skipCount > 0) {
    console.log(`  ⏭️  Skipped:   ${skipCount}`);
  }
  if (failCount > 0) {
    console.log(`  ❌ Failed:    ${failCount}`);
  }
  console.log(`  ⏱️  Duration:  ${duration}s`);
  console.log("\nNext steps:");
  console.log("  1. Process transcripts: POST /api/ops { opid: 'transcripts:process' }");
  console.log("  2. Ingest knowledge: POST /api/ops { opid: 'knowledge:ingest' }");
  console.log("  3. Run personality analysis: POST /api/ops { opid: 'personality:analyze' }");
  console.log("");

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Seed-all failed:", err);
  process.exit(1);
});
