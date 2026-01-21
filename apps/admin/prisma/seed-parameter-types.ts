/**
 * Seed script to categorize parameters with the correct ParameterType
 *
 * Based on analysis of parameters-export-2026-01-20.csv:
 * - TRAIT: Stable personality (Big Five, MBTI continuous)
 * - STATE: Per-call dynamics (CONV_*, engagement, tone)
 * - CONFIG: System settings (SYS-*, HF-*)
 * - EXTERNAL: From assessments/imports (Gallup, MBTI categorical, VARK)
 *
 * Run with: npx tsx prisma/seed-parameter-types.ts
 */

import { PrismaClient, ParameterType } from "@prisma/client";

const prisma = new PrismaClient();

// Parameter categorization based on CSV analysis
const PARAMETER_CATEGORIES: Record<string, ParameterType> = {
  // === TRAIT: Stable personality traits (measured over multiple calls) ===
  // Big Five (both naming conventions)
  "B5-O": "TRAIT",
  "B5-C": "TRAIT",
  "B5-E": "TRAIT",
  "B5-A": "TRAIT",
  "B5-N": "TRAIT",
  "BF_O": "TRAIT",
  "BF_C": "TRAIT",
  "BF_E": "TRAIT",
  "BF_A": "TRAIT",
  "BF_N": "TRAIT",
  // MBTI continuous dimensions
  "MBTI-IE": "TRAIT",
  "MBTI-JP": "TRAIT",
  // Memory cognition (stable over time)
  "MEM_DECAY": "TRAIT",
  "MEM_LONG": "TRAIT",
  "MEM_SHORT": "TRAIT",
  // Motivation style
  "MOT_GOAL": "TRAIT",
  "MOT_REWARD": "TRAIT",

  // === STATE: Per-call dynamics (measured each call) ===
  // Conversation dynamics
  "CONV_DEPTH": "STATE",
  "CONV_DOM": "STATE",
  "CONV_EMO": "STATE",
  "CONV_PACE": "STATE",
  // Conversation analysis
  "CA-REPAIR-001": "STATE",
  // Conversational purpose
  "CP-001": "STATE",
  "CP-002": "STATE",
  "CP-003": "STATE",
  "CP-004": "STATE",
  // Tone (can vary per call)
  "TONE_ASSERT": "STATE",
  "TONE_FORM": "STATE",
  "TONE_WARM": "STATE",

  // === CONFIG: System/admin settings (not measured) ===
  "SYS-001": "CONFIG",  // prompt_swap_latency_ms
  "SYS-002": "CONFIG",  // stub_mode
  "HF-GRD-001": "CONFIG",  // guardrail_strictness
  "HF-MEM-001": "CONFIG",  // memory_recall_strength
  "HF-OPT-001": "CONFIG",  // subscription_nudge_intensity
  "SAFE_BOUND": "CONFIG",  // Boundary strictness
  "SAFE_CHALL": "CONFIG",  // Challenge sensitivity
  "SUB_NUDGE": "CONFIG",   // Subscription nudge frequency
  "SUB_URGENCY": "CONFIG", // Subscription urgency

  // === EXTERNAL: From external sources (assessments, imports) ===
  "GALLUP-001": "EXTERNAL",  // CliftonStrengths (external assessment)
  "LS-001": "EXTERNAL",      // VARK learning style (external assessment)
  // MBTI categorical (typically from external assessment, not measured)
  "MBTI_EI": "EXTERNAL",
  "MBTI_JP": "EXTERNAL",
  "MBTI_SN": "EXTERNAL",
  "MBTI_TF": "EXTERNAL",
};

async function main() {
  console.log("Categorizing parameters with ParameterType...\n");

  let updated = 0;
  let notFound = 0;
  let unchanged = 0;

  for (const [parameterId, parameterType] of Object.entries(PARAMETER_CATEGORIES)) {
    const existing = await prisma.parameter.findUnique({
      where: { parameterId },
    });

    if (!existing) {
      console.log(`  [NOT FOUND] ${parameterId}`);
      notFound++;
      continue;
    }

    if (existing.parameterType === parameterType) {
      console.log(`  [UNCHANGED] ${parameterId} -> ${parameterType}`);
      unchanged++;
      continue;
    }

    await prisma.parameter.update({
      where: { parameterId },
      data: { parameterType },
    });

    console.log(`  [UPDATED] ${parameterId}: ${existing.parameterType} -> ${parameterType}`);
    updated++;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Updated:   ${updated}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Not found: ${notFound}`);

  // Report any parameters NOT in our categorization
  const allParams = await prisma.parameter.findMany({
    select: { parameterId: true, parameterType: true },
  });

  const uncategorized = allParams.filter(
    (p) => !PARAMETER_CATEGORIES[p.parameterId]
  );

  if (uncategorized.length > 0) {
    console.log(`\n=== Uncategorized Parameters (defaulting to TRAIT) ===`);
    for (const p of uncategorized) {
      console.log(`  ${p.parameterId} -> ${p.parameterType}`);
    }
  }

  console.log("\nDone!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
