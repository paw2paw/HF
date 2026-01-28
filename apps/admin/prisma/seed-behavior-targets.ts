/**
 * Seed script for Behavior Targets system:
 * 1. Mark all BEHAVIOR type parameters as isAdjustable = true
 * 2. Create SYSTEM-level BehaviorTargets for any BEHAVIOR params missing one
 *
 * Run with: npx tsx prisma/seed-behavior-targets.ts
 */

import { PrismaClient, BehaviorTargetScope, BehaviorTargetSource } from "@prisma/client";

const prisma = new PrismaClient();

// Default target values for BEHAVIOR parameters
// These are sensible starting points that can be overridden at PLAYBOOK/SEGMENT/CALLER levels
const DEFAULT_BEHAVIOR_TARGETS: Record<string, { value: number; description: string }> = {
  // Communication Style
  "BEH-FORMALITY": { value: 0.5, description: "Moderate formality - adapt to caller" },
  "BEH-RESPONSE-LEN": { value: 0.5, description: "Balanced response length" },
  "BEH-ROLE-SWITCH": { value: 0.4, description: "Some flexibility in role" },

  // Efficiency
  "BEH-CLARITY": { value: 0.8, description: "High clarity in communication" },
  "BEH-DIRECTNESS": { value: 0.6, description: "Moderately direct" },

  // Empathy
  "BEH-EMPATHY-RATE": { value: 0.6, description: "Empathetic but not overwhelming" },
  "BEH-PERSONALIZATION": { value: 0.7, description: "High personalization" },
  "BEH-WARMTH": { value: 0.6, description: "Warm and friendly" },

  // Engagement
  "BEH-ACTIVE-LISTEN": { value: 0.6, description: "Active listening behaviors" },
  "BEH-PROACTIVE": { value: 0.5, description: "Balanced proactivity" },
  "BEH-QUESTION-RATE": { value: 0.4, description: "Ask questions when needed" },

  // Adaptability
  "BEH-PACE-MATCH": { value: 0.5, description: "Match caller pace moderately" },
  "BEH-MIRROR-STYLE": { value: 0.5, description: "Mirror style moderately" },

  // MVP Behaviors
  "MVP-BEH-WARMTH": { value: 0.7, description: "Warm tone in MVP" },
  "MVP-BEH-DIRECTNESS": { value: 0.6, description: "Moderately direct in MVP" },
  "MVP-BEH-EMPATHY": { value: 0.75, description: "High empathy in MVP" },

  // EXP Behaviors (experimental)
  "EXP-BEH-WARMTH": { value: 0.65, description: "Experimental warmth target" },
  "EXP-BEH-EMPATHY": { value: 0.7, description: "Experimental empathy target" },
  "EXP-BEH-FORMAL": { value: 0.5, description: "Experimental formality target" },
  "EXP-BEH-PACE": { value: 0.5, description: "Experimental pace target" },
  "EXP-BEH-DETAIL": { value: 0.6, description: "Experimental detail level target" },
  "EXP-BEH-PROACTIVE": { value: 0.5, description: "Experimental proactivity target" },
};

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
