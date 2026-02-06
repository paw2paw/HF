/**
 * Seed script for Behavior Targets system:
 * 1. Mark all BEHAVIOR type parameters as isAdjustable = true
 * 2. Create SYSTEM-level BehaviorTargets for any BEHAVIOR params missing one
 *
 * Run with: npx tsx prisma/seed-behavior-targets.ts
 */

import { PrismaClient, BehaviorTargetScope, BehaviorTargetSource } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// Load default targets from the canonical registry (single source of truth)
function loadDefaultTargets(): Record<string, { value: number; description: string }> {
  const registryPath = path.join(process.cwd(), "bdd-specs", "behavior-parameters.registry.json");
  if (!fs.existsSync(registryPath)) {
    console.warn("⚠️ Registry not found, using fallback defaults");
    return {};
  }
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  const targets: Record<string, { value: number; description: string }> = {};
  for (const param of registry.parameters) {
    targets[param.parameterId] = {
      value: param.defaultTarget ?? 0.5,
      description: param.name,
    };
  }
  return targets;
}

const DEFAULT_BEHAVIOR_TARGETS = loadDefaultTargets();

async function main() {
  console.log("Seeding Behavior Targets system...\n");

  // ============================================================
  // 1. Mark all BEHAVIOR parameters as isAdjustable = true
  // ============================================================
  console.log("1. Marking BEHAVIOR parameters as adjustable...");

  const behaviorParams = await prisma.parameter.updateMany({
    where: { parameterType: "BEHAVIOR" },
    data: { isAdjustable: true },
  });
  console.log(`   Updated ${behaviorParams.count} BEHAVIOR parameters to isAdjustable = true`);

  // Also ensure non-BEHAVIOR params are NOT adjustable (for clarity)
  const nonBehaviorParams = await prisma.parameter.updateMany({
    where: { parameterType: { not: "BEHAVIOR" } },
    data: { isAdjustable: false },
  });
  console.log(`   Set ${nonBehaviorParams.count} non-BEHAVIOR parameters to isAdjustable = false`);

  // ============================================================
  // 2. Get all BEHAVIOR parameters
  // ============================================================
  console.log("\n2. Fetching all BEHAVIOR parameters...");

  const allBehaviorParams = await prisma.parameter.findMany({
    where: { parameterType: "BEHAVIOR" },
    select: { parameterId: true, name: true },
  });
  console.log(`   Found ${allBehaviorParams.length} BEHAVIOR parameters`);

  // ============================================================
  // 3. Get existing SYSTEM-level BehaviorTargets
  // ============================================================
  console.log("\n3. Checking existing SYSTEM-level BehaviorTargets...");

  const existingTargets = await prisma.behaviorTarget.findMany({
    where: { scope: "SYSTEM" },
    select: { parameterId: true },
  });
  const existingParamIds = new Set(existingTargets.map(t => t.parameterId));
  console.log(`   Found ${existingTargets.length} existing SYSTEM-level targets`);

  // ============================================================
  // 4. Create missing SYSTEM-level BehaviorTargets
  // ============================================================
  console.log("\n4. Creating missing SYSTEM-level BehaviorTargets...");

  let created = 0;
  for (const param of allBehaviorParams) {
    if (!existingParamIds.has(param.parameterId)) {
      const defaultTarget = DEFAULT_BEHAVIOR_TARGETS[param.parameterId];
      const targetValue = defaultTarget?.value ?? 0.5; // Default to 0.5 if not specified

      await prisma.behaviorTarget.create({
        data: {
          parameterId: param.parameterId,
          scope: BehaviorTargetScope.SYSTEM,
          targetValue,
          confidence: 0.5,
          source: BehaviorTargetSource.SEED,
        },
      });
      console.log(`   Created: ${param.parameterId} = ${targetValue}`);
      created++;
    }
  }

  if (created === 0) {
    console.log("   All BEHAVIOR parameters already have SYSTEM-level targets");
  } else {
    console.log(`   Created ${created} new SYSTEM-level targets`);
  }

  // ============================================================
  // 5. Summary
  // ============================================================
  console.log("\n5. Summary:");

  const totalTargets = await prisma.behaviorTarget.count({ where: { scope: "SYSTEM" } });
  const totalAdjustable = await prisma.parameter.count({ where: { isAdjustable: true } });

  console.log(`   Total adjustable parameters: ${totalAdjustable}`);
  console.log(`   Total SYSTEM-level BehaviorTargets: ${totalTargets}`);

  // List all targets with their values
  console.log("\n   Current SYSTEM-level targets:");
  const allTargets = await prisma.behaviorTarget.findMany({
    where: { scope: "SYSTEM" },
    include: { parameter: { select: { parameterId: true, name: true } } },
    orderBy: { parameter: { parameterId: "asc" } },
  });

  for (const target of allTargets) {
    console.log(`   - ${target.parameter.parameterId}: ${target.targetValue.toFixed(2)} (${target.source})`);
  }

  console.log("\nDone!");
}

main()
  .catch((e) => {
    console.error("Error seeding behavior targets:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
