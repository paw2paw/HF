/**
 * Migration script for cleaning up spec type enums
 *
 * Pipeline Stages (outputType):
 *   LEARN   - Extract data about the caller (memories, scores)
 *   MEASURE - Score agent behavior
 *   ADAPT   - Compute personalized targets
 *   COMPOSE - Build prompt sections
 *
 * Spec Types (specType):
 *   SYSTEM - Always runs for every call
 *   DOMAIN - Only runs when domain's playbook is active
 *
 * Spec Roles (specRole - for COMPOSE specs only):
 *   IDENTITY - WHO: Agent persona
 *   CONTENT  - WHAT: Domain knowledge
 *   CONTEXT  - Caller-specific context
 *   META     - Legacy (deprecated)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface MigrationSummary {
  outputTypeMigrations: Record<string, number>;
  specTypeMigrations: Record<string, number>;
  specRoleMigrations: Record<string, number>;
  totalSpecs: number;
  errors: string[];
}

async function migrateSpecEnums(): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    outputTypeMigrations: {},
    specTypeMigrations: {},
    specRoleMigrations: {},
    totalSpecs: 0,
    errors: [],
  };

  console.log("=".repeat(60));
  console.log("SPEC ENUM MIGRATION");
  console.log("=".repeat(60));

  // OutputType migrations
  const outputTypeMappings: Record<string, string> = {
    "MEASURE_AGENT": "MEASURE",  // Agent behavior scoring
    "MEASURE_CALLER": "LEARN",   // Caller trait scoring (old name)
    "AGGREGATE": "LEARN",        // Aggregation now part of LEARN stage
    "REWARD": "MEASURE",         // Reward computation now part of MEASURE stage
  };

  // SpecType migrations (old specType values that overlap with pipeline stages)
  const specTypeMappings: Record<string, string> = {
    "ADAPT": "SYSTEM",     // ADAPT specType -> SYSTEM (stage controlled by outputType)
    "SUPERVISE": "SYSTEM", // SUPERVISE specType -> SYSTEM (validation is hardcoded)
  };

  // SpecRole migrations
  const specRoleMappings: Record<string, string> = {
    "VOICE": "IDENTITY",    // Voice is part of identity
    "MEASURE": "META",      // Old measurement role -> deprecated
    "ADAPT": "META",        // Old adapt role -> deprecated
    "CONSTRAIN": "META",    // Old constraint role -> deprecated
    "REWARD": "META",       // Old reward role -> deprecated
  };

  // Migrate outputType values using direct SQL
  console.log("\n--- OutputType Migrations ---");
  for (const [oldValue, newValue] of Object.entries(outputTypeMappings)) {
    try {
      // First check how many records have this value
      const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) as count FROM "BddFeature" WHERE "outputType"::text = $1`,
        oldValue
      );
      const count = Number(countResult[0]?.count || 0);

      if (count > 0) {
        // Update the records
        await prisma.$executeRawUnsafe(
          `UPDATE "BddFeature" SET "outputType" = $1::"AnalysisOutputType" WHERE "outputType"::text = $2`,
          newValue,
          oldValue
        );
        summary.outputTypeMigrations[`${oldValue} -> ${newValue}`] = count;
        console.log(`  ${oldValue} -> ${newValue}: ${count} specs`);
      }
    } catch (e: any) {
      const errorMsg = `outputType ${oldValue}: ${e.message}`;
      summary.errors.push(errorMsg);
      console.log(`  ERROR: ${errorMsg}`);
    }
  }

  // Migrate specType values
  console.log("\n--- SpecType Migrations ---");
  for (const [oldValue, newValue] of Object.entries(specTypeMappings)) {
    try {
      const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) as count FROM "BddFeature" WHERE "specType"::text = $1`,
        oldValue
      );
      const count = Number(countResult[0]?.count || 0);

      if (count > 0) {
        await prisma.$executeRawUnsafe(
          `UPDATE "BddFeature" SET "specType" = $1::"SpecType" WHERE "specType"::text = $2`,
          newValue,
          oldValue
        );
        summary.specTypeMigrations[`${oldValue} -> ${newValue}`] = count;
        console.log(`  ${oldValue} -> ${newValue}: ${count} specs`);
      }
    } catch (e: any) {
      const errorMsg = `specType ${oldValue}: ${e.message}`;
      summary.errors.push(errorMsg);
      console.log(`  ERROR: ${errorMsg}`);
    }
  }

  // Migrate specRole values
  console.log("\n--- SpecRole Migrations ---");
  for (const [oldValue, newValue] of Object.entries(specRoleMappings)) {
    try {
      const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) as count FROM "BddFeature" WHERE "specRole"::text = $1`,
        oldValue
      );
      const count = Number(countResult[0]?.count || 0);

      if (count > 0) {
        await prisma.$executeRawUnsafe(
          `UPDATE "BddFeature" SET "specRole" = $1::"SpecRole" WHERE "specRole"::text = $2`,
          newValue,
          oldValue
        );
        summary.specRoleMigrations[`${oldValue} -> ${newValue}`] = count;
        console.log(`  ${oldValue} -> ${newValue}: ${count} specs`);
      }
    } catch (e: any) {
      const errorMsg = `specRole ${oldValue}: ${e.message}`;
      summary.errors.push(errorMsg);
      console.log(`  ERROR: ${errorMsg}`);
    }
  }

  // Get total count
  const totalResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM "BddFeature"`
  );
  summary.totalSpecs = Number(totalResult[0]?.count || 0);

  return summary;
}

async function main() {
  try {
    const summary = await migrateSpecEnums();

    console.log("\n" + "=".repeat(60));
    console.log("MIGRATION SUMMARY");
    console.log("=".repeat(60));

    console.log(`\nTotal specs in database: ${summary.totalSpecs}`);

    const totalMigrations =
      Object.values(summary.outputTypeMigrations).reduce((a, b) => a + b, 0) +
      Object.values(summary.specTypeMigrations).reduce((a, b) => a + b, 0) +
      Object.values(summary.specRoleMigrations).reduce((a, b) => a + b, 0);

    if (totalMigrations === 0 && summary.errors.length === 0) {
      console.log("\nNo migrations needed - all specs already use current enum values!");
    } else {
      console.log(`\nTotal: ${totalMigrations} records migrated, ${summary.errors.length} errors`);
    }

    if (summary.errors.length > 0) {
      console.log("\nErrors encountered:");
      for (const error of summary.errors) {
        console.log(`  - ${error}`);
      }
    }

    console.log("=".repeat(60));

  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
