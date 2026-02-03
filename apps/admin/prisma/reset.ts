/**
 * Database Reset Script
 *
 * Clears all data from the database while preserving the schema.
 * Use this to start fresh without losing migrations.
 *
 * Usage:
 *   npm run db:reset
 *   npx tsx prisma/reset.ts
 *   npx tsx prisma/reset.ts --confirm    # Skip confirmation prompt
 *
 * WARNING: This will delete ALL data in all tables!
 */

import { PrismaClient } from "@prisma/client";
import * as readline from "readline";

const prisma = new PrismaClient();

// Tables to clear in order (respects foreign key constraints)
// Order: children first, then parents
const TABLES_IN_ORDER = [
  // BDD specs
  "BDDFeatureSet",
  "BDDUpload",

  // Composed prompts
  "ComposedPrompt",

  // Caller identity
  "CallerIdentity",

  // Prompt stack
  "PromptStackItem",
  "PromptStack",
  "PromptCompositionConfig",

  // Prompt slug related
  "PromptSlugRange",
  "PromptSlugStats",
  "PromptSlugReward",
  "PromptSlugSelection",
  "PromptSlugParameter",
  "PromptSlug",
  "PromptBlock",
  "PromptTemplate",

  // Reward scores
  "RewardScore",

  // Call scores and measurements
  "CallScore",
  "BehaviorMeasurement",

  // Caller-related child tables
  "PersonalityObservation",
  "CallerPersonality",
  "CallerPersonalityProfile",
  "CallerMemory",
  "CallerMemorySummary",
  "CallerAttribute",

  // Targets (reference Parameter AND Caller/Call)
  "CallerTarget",
  "CallTarget",
  "BehaviorTarget",

  // Playbook items (reference Playbook and AnalysisSpec)
  "PlaybookItem",

  // Analysis actions and triggers
  "AnalysisAction",
  "AnalysisTrigger",

  // Call-related
  "FailedCall",
  "Call",

  // Caller
  "Caller",

  // Playbooks
  "Playbook",

  // Segments and Domains
  "Segment",
  "Domain",

  // Processing
  "ProcessedFile",

  // Knowledge
  "VectorEmbedding",
  "KnowledgeChunk",
  "KnowledgeArtifact",
  "KnowledgeDoc",
  "ParameterKnowledgeLink",

  // Analysis
  "AnalysisSpec",
  "CompiledAnalysisSet",
  "AnalysisRun",

  // Analysis profiles
  "AnalysisProfileParameter",
  "AnalysisProfile",

  // Agent runs
  "AgentRun",
  "AgentInstance",

  // Parameters
  "ParameterScoringAnchor",
  "ParameterTag",
  "ParameterMapping",
  "Parameter",

  // Tags
  "Tag",
];

async function clearTable(tableName: string): Promise<number> {
  try {
    // Use raw SQL for reliable clearing across all tables
    const result = await prisma.$executeRawUnsafe(
      `DELETE FROM "${tableName}"`
    );
    return result;
  } catch (err: any) {
    // Table might not exist or be empty
    if (err.code === "P2021") {
      return 0; // Table doesn't exist
    }
    throw err;
  }
}

async function getTableCount(tableName: string): Promise<number> {
  try {
    const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM "${tableName}"`
    );
    return Number(result[0]?.count || 0);
  } catch {
    return 0;
  }
}

async function promptConfirmation(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      "\n⚠️  WARNING: This will DELETE ALL DATA in the database!\n" +
        "Type 'yes' to confirm: ",
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === "yes");
      }
    );
  });
}

async function main() {
  const args = process.argv.slice(2);
  const skipConfirm = args.includes("--confirm") || args.includes("-y");

  console.log("\n🗑️  DATABASE RESET SCRIPT\n");
  console.log("This will clear all data from the following tables:");
  console.log(TABLES_IN_ORDER.map((t) => `  - ${t}`).join("\n"));

  if (!skipConfirm) {
    const confirmed = await promptConfirmation();
    if (!confirmed) {
      console.log("\n❌ Reset cancelled.\n");
      process.exit(0);
    }
  }

  console.log("\n🔄 Clearing tables...\n");

  let totalCleared = 0;

  for (const tableName of TABLES_IN_ORDER) {
    const beforeCount = await getTableCount(tableName);
    if (beforeCount > 0) {
      const cleared = await clearTable(tableName);
      console.log(`  ✓ ${tableName}: ${beforeCount} rows deleted`);
      totalCleared += beforeCount;
    } else {
      console.log(`  - ${tableName}: (empty)`);
    }
  }

  console.log("\n✅ DATABASE RESET COMPLETE\n");
  console.log(`Total rows deleted: ${totalCleared}`);
  console.log("\nNext steps:");
  console.log("  1. Run seeds: npm run db:seed:all");
  console.log("  2. Or import fresh data via the ops pipeline\n");
}

main()
  .catch((err) => {
    console.error("❌ Reset failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
