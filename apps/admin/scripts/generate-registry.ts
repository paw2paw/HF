/**
 * Generate Registry from Database
 *
 * Reads all canonical parameters from the database and generates:
 * 1. lib/registry/index.ts - TypeScript constants
 * 2. docs-archive/bdd-specs/behavior-parameters.registry.json - Canonical JSON (for reference/audit)
 *
 * Run this at build time (npm run prebuild)
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface RegistryParam {
  parameterId: string;
  name: string;
  definition?: string;
  domainGroup: string;
  defaultTarget: number;
  interpretationHigh?: string;
  interpretationLow?: string;
  aliases?: string[];
}

async function generateRegistry() {
  console.log("📚 Generating registry from database...");

  try {
    // BASELINE: Known system parameters and traits (always available)
    const baselineParams: typeof params = [
      { parameterId: "BEH-WARMTH", name: "Warmth Level", definition: "Overall warmth and friendliness in agent tone", domainGroup: "empathy", defaultTarget: 0.6 },
      { parameterId: "BEH-EMPATHY-RATE", name: "Empathy Expression Rate", definition: "Frequency of empathetic statements", domainGroup: "empathy", defaultTarget: 0.6 },
      { parameterId: "BEH-PERSONALIZATION", name: "Personalization Level", definition: "References to caller-specific information", domainGroup: "empathy", defaultTarget: 0.7 },
      { parameterId: "BEH-FORMALITY", name: "Formality Level", definition: "Formal vs casual language", domainGroup: "communication", defaultTarget: 0.5 },
      { parameterId: "BEH-DIRECTNESS", name: "Directness Level", definition: "Direct vs indirect communication", domainGroup: "communication", defaultTarget: 0.6 },
      { parameterId: "BEH-RESPONSE-LEN", name: "Response Length", definition: "Average response length", domainGroup: "communication", defaultTarget: 0.5 },
      { parameterId: "BEH-ROLE-SWITCH", name: "Role Flexibility", definition: "Role switching frequency", domainGroup: "communication", defaultTarget: 0.4 },
      { parameterId: "BEH-CLARITY", name: "Communication Clarity", definition: "Communication clarity and precision", domainGroup: "communication", defaultTarget: 0.8 },
      { parameterId: "BEH-QUESTION-RATE", name: "Question Asking Rate", definition: "Ratio of questions to utterances", domainGroup: "engagement", defaultTarget: 0.4 },
      { parameterId: "BEH-QUESTION-FREQUENCY", name: "Question Frequency", definition: "Conversational question frequency", domainGroup: "engagement", defaultTarget: 0.5 },
      { parameterId: "BEH-INSIGHT-FREQUENCY", name: "Insight Sharing Frequency", definition: "Knowledge and insight sharing frequency", domainGroup: "engagement", defaultTarget: 0.5 },
      { parameterId: "BEH-ACTIVE-LISTEN", name: "Active Listening", definition: "Active listening indicators", domainGroup: "engagement", defaultTarget: 0.6 },
      { parameterId: "BEH-PROACTIVE", name: "Proactivity Level", definition: "Proactive help and suggestions", domainGroup: "engagement", defaultTarget: 0.5 },
      { parameterId: "BEH-PACE-MATCH", name: "Pace Matching", definition: "Pace and energy matching", domainGroup: "adaptation", defaultTarget: 0.5 },
      { parameterId: "BEH-MIRROR-STYLE", name: "Style Mirroring", definition: "Communication style mirroring", domainGroup: "adaptation", defaultTarget: 0.5 },
      { parameterId: "BEH-ENGAGEMENT", name: "Overall Engagement", definition: "Overall level of engagement with the caller", domainGroup: "engagement", defaultTarget: 0.6 },
      { parameterId: "BEH-TURN-LENGTH", name: "Turn Length", definition: "Agent response length per turn", domainGroup: "adaptation", defaultTarget: 0.5 },
      { parameterId: "BEH-PAUSE-TOLERANCE", name: "Pause Tolerance", definition: "Tolerance for pauses and silence in conversation", domainGroup: "adaptation", defaultTarget: 0.5 },
    ] as any;

    const baselineTraits: typeof traits = [
      { parameterId: "B5-O", name: "Openness", definition: "Big Five Openness", domainGroup: "personality", defaultTarget: 0.5 },
      { parameterId: "B5-C", name: "Conscientiousness", definition: "Big Five Conscientiousness", domainGroup: "personality", defaultTarget: 0.5 },
      { parameterId: "B5-E", name: "Extraversion", definition: "Big Five Extraversion", domainGroup: "personality", defaultTarget: 0.5 },
      { parameterId: "B5-A", name: "Agreeableness", definition: "Big Five Agreeableness", domainGroup: "personality", defaultTarget: 0.5 },
      { parameterId: "B5-N", name: "Neuroticism", definition: "Big Five Neuroticism", domainGroup: "personality", defaultTarget: 0.5 },
      { parameterId: "PERS-OPENNESS", name: "Openness (Caller)", definition: "Caller openness to new experiences", domainGroup: "personality", defaultTarget: 0.5 },
      { parameterId: "PERS-CONSCIENTIOUSNESS", name: "Conscientiousness (Caller)", definition: "Caller conscientiousness", domainGroup: "personality", defaultTarget: 0.5 },
      { parameterId: "PERS-EXTRAVERSION", name: "Extraversion (Caller)", definition: "Caller extraversion", domainGroup: "personality", defaultTarget: 0.5 },
      { parameterId: "PERS-AGREEABLENESS", name: "Agreeableness (Caller)", definition: "Caller agreeableness", domainGroup: "personality", defaultTarget: 0.5 },
      { parameterId: "PERS-NEUROTICISM", name: "Neuroticism (Caller)", definition: "Caller neuroticism", domainGroup: "personality", defaultTarget: 0.5 },
    ] as any;

    const baselineSpecs: Array<{ slug: string; name: string }> = [
      { slug: "INIT-001", name: "Caller Onboarding" },
      { slug: "GUARD-001", name: "Target Guardrails" },
      { slug: "GOAL-001", name: "Learner Goals" },
      { slug: "COACH-001", name: "Coach Identity" },
      { slug: "COMPANION-001", name: "Companion" },
      { slug: "TUT-001", name: "Tutor" },
      { slug: "PIPELINE-001", name: "Pipeline Configuration" },
    ];

    // 1. Fetch all canonical parameters (merge with baseline)
    let params = await prisma.parameter.findMany({
      where: {
        isCanonical: true,
        deprecatedAt: null,
      },
      orderBy: { parameterId: "asc" },
    });

    // If database is empty, use baseline
    if (params.length === 0) {
      console.warn("⚠️  No canonical parameters found in database. Using baseline system parameters.");
      params = baselineParams;
    }

    // 2. Fetch all canonical traits (B5-* and PERS-*)
    let traits = await prisma.parameter.findMany({
      where: {
        isCanonical: true,
        deprecatedAt: null,
        OR: [
          { parameterId: { startsWith: "B5-" } },
          { parameterId: { startsWith: "PERS-" } },
        ],
      },
      orderBy: { parameterId: "asc" },
    });

    // If no traits found, use baseline
    if (traits.length === 0) {
      traits = baselineTraits;
    }

    // 3. Fetch all canonical specs
    let specs = await prisma.analysisSpec.findMany({
      where: {
        isActive: true,
        isDirty: false,
      },
      select: {
        slug: true,
        name: true,
      },
      orderBy: { slug: "asc" },
    });

    // If no specs found, use baseline
    if (specs.length === 0) {
      specs = baselineSpecs;
    }

    // 4. Generate TypeScript constants
    const constName = (id: string) => id.replace(/-/g, "_");

    const tsCode = `/**
 * AUTO-GENERATED FROM DATABASE
 * DO NOT EDIT MANUALLY
 * Generated: ${new Date().toISOString()}
 *
 * This file is generated by scripts/generate-registry.ts at build time.
 * The source of truth is the Parameter table in the database.
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================================
// TYPES
// ============================================================================

export interface ParameterDefinition {
  parameterId: string;
  name: string;
  definition: string;
  domainGroup: string;
  defaultTarget: number;
  interpretationHigh?: string;
  interpretationLow?: string;
  aliases?: string[];
}

export interface ParameterRegistry {
  version: string;
  description: string;
  parameters: ParameterDefinition[];
  generatedAt: string;
}

// ============================================================================
// PARAMETER CONSTANTS
// ============================================================================

/**
 * Behavior parameter IDs - use these instead of hardcoding strings.
 * Generated from database at build time.
 */
export const PARAMS = {
${params.map((p) => `  ${constName(p.parameterId)}: "${p.parameterId}",`).join("\n")}
} as const;

/**
 * Personality trait parameter IDs
 */
export const TRAITS = {
${traits.map((p) => `  ${constName(p.parameterId)}: "${p.parameterId}",`).join("\n")}
} as const;

/**
 * Canonical spec IDs
 */
export const SPECS = {
${specs.map((s) => `  ${constName(s.slug)}: "${s.slug}",`).join("\n")}
} as const;

// ============================================================================
// PARAMETER GROUPINGS (by domain)
// ============================================================================

export const PARAM_GROUPS = {
  COMMUNICATION_STYLE: [
    ${params.filter(p => p.domainGroup === 'communication').map(p => `"${p.parameterId}"`).join(', ')}
  ] as const,
  ENGAGEMENT_APPROACH: [
    ${params.filter(p => p.domainGroup === 'engagement').map(p => `"${p.parameterId}"`).join(', ')}
  ] as const,
  ADAPTABILITY: [
    ${params.filter(p => p.domainGroup === 'adaptation').map(p => `"${p.parameterId}"`).join(', ')}
  ] as const,
  EMPATHY: [
    ${params.filter(p => p.domainGroup === 'empathy').map(p => `"${p.parameterId}"`).join(', ')}
  ] as const,
  PERSONALITY_TRAITS: [
    ${traits.map(t => `"${t.parameterId}"`).join(', ')}
  ] as const,
} as const;

// ============================================================================
// TRAIT NAME MAPPING
// ============================================================================

export const TRAIT_NAMES: Record<string, string> = {
${traits.map(t => `  "${t.parameterId}": "${t.name}",`).join("\n")}
} as const;

// ============================================================================
// RUNTIME HELPERS (load from database at runtime)
// ============================================================================

let _paramMap: Map<string, ParameterDefinition> | null = null;

export async function loadParameterRegistry(): Promise<ParameterRegistry> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const params = await prisma.parameter.findMany({
    where: {
      isCanonical: true,
      deprecatedAt: null,
    },
    orderBy: { parameterId: "asc" },
  });

  await prisma.$disconnect();

  return {
    version: "1.0",
    description: "Canonical registry of behavior parameters from database",
    parameters: params.map((p) => ({
      parameterId: p.parameterId,
      name: p.name,
      definition: p.definition || "",
      domainGroup: p.domainGroup,
      defaultTarget: p.defaultTarget,
      interpretationHigh: p.interpretationHigh || undefined,
      interpretationLow: p.interpretationLow || undefined,
      aliases: p.aliases && p.aliases.length > 0 ? p.aliases : undefined,
    })),
    generatedAt: new Date().toISOString(),
  };
}

export type ParamId = (typeof PARAMS)[keyof typeof PARAMS];
export type TraitId = (typeof TRAITS)[keyof typeof TRAITS];
export type SpecId = (typeof SPECS)[keyof typeof SPECS];
`;

    // 5. Write TypeScript file
    const tsPath = path.join(process.cwd(), "lib/registry/index.ts");
    fs.mkdirSync(path.dirname(tsPath), { recursive: true });
    fs.writeFileSync(tsPath, tsCode);
    console.log(`✅ Generated ${tsPath}`);

    // 6. Generate JSON registry (for reference/audit)
    const jsonRegistry: RegistryParam[] = params.map((p) => ({
      parameterId: p.parameterId,
      name: p.name,
      definition: p.definition || undefined,
      domainGroup: p.domainGroup,
      defaultTarget: p.defaultTarget,
      interpretationHigh: p.interpretationHigh || undefined,
      interpretationLow: p.interpretationLow || undefined,
      aliases: p.aliases && p.aliases.length > 0 ? p.aliases : undefined,
    }));

    const jsonPath = path.join(
      process.cwd(),
      "docs-archive/bdd-specs/behavior-parameters.registry.json"
    );
    fs.writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          version: "2.0",
          description: "GENERATED FROM DATABASE - DO NOT EDIT",
          generatedAt: new Date().toISOString(),
          sourceOfTruth: "Parameter table in database",
          parameters: jsonRegistry,
        },
        null,
        2
      )
    );
    console.log(`✅ Generated ${jsonPath}`);

    console.log(
      `\n📊 Registry Summary:\n  Total parameters: ${params.length}\n  Traits: ${traits.length}\n  Specs: ${specs.length}`
    );
  } catch (error) {
    console.error("❌ Error generating registry:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  generateRegistry();
}
