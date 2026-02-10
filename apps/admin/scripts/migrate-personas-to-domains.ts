#!/usr/bin/env tsx
/**
 * Migrate INIT-001 persona configurations to Domain records
 *
 * This script reads persona data from INIT-001-caller-onboarding.spec.json
 * and populates the Domain onboarding fields (onboardingWelcome, onboardingIdentitySpecId, etc.)
 *
 * Run with: npx tsx scripts/migrate-personas-to-domains.ts
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

interface PersonaConfig {
  identitySpec: string; // "TUT-001", "COMPANION-001", "COACH-001"
  name: string;
  description: string;
  welcomeTemplate: string;
  firstCallFlow: {
    phases: Array<{
      phase: string;
      duration: string;
      priority: string;
      goals: string[];
      avoid: string[];
    }>;
  };
}

interface INIT001Spec {
  personas: {
    tutor: PersonaConfig;
    companion: PersonaConfig;
    coach: PersonaConfig;
  };
  parameters: Array<{
    id: string;
    config: {
      defaultTargets?: Record<string, {
        value: number;
        confidence: number;
        rationale: string;
      }>;
    };
  }>;
}

async function main() {
  console.log("🚀 Starting persona-to-domain migration...\n");

  // 1. Load INIT-001 spec
  const specPath = join(process.cwd(), "bdd-specs/INIT-001-caller-onboarding.spec.json");
  console.log(`📖 Reading INIT-001 spec from: ${specPath}`);

  const spec = JSON.parse(readFileSync(specPath, "utf-8")) as INIT001Spec;
  console.log(`✅ Loaded INIT-001 spec with ${Object.keys(spec.personas).length} personas\n`);

  // 2. Extract default behavior targets (from parameters[0] - "default_targets_quality")
  const defaultTargetsParam = spec.parameters.find(p => p.id === "default_targets_quality");
  const defaultTargets = defaultTargetsParam?.config?.defaultTargets || {};
  console.log(`📊 Found ${Object.keys(defaultTargets).length} default behavior targets\n`);

  // 3. Migrate each persona to matching Domain(s)
  // Note: "tutor" persona applies to multiple domains (wnf, qm)
  const personaMapping: Record<string, string[]> = {
    tutor: ["wnf", "qm"], // Tutor persona applies to curriculum domains
    companion: ["companion"],
    coach: ["coach"],
  };

  for (const [personaSlug, domainSlugs] of Object.entries(personaMapping)) {
    const personaConfig = spec.personas[personaSlug as keyof typeof spec.personas];
    if (!personaConfig) {
      console.warn(`⚠️  Persona "${personaSlug}" not found in INIT-001, skipping...`);
      continue;
    }

    console.log(`\n🔧 Migrating persona: ${personaSlug}`);
    console.log(`   Identity Spec: ${personaConfig.identitySpec}`);
    console.log(`   Target domains: ${domainSlugs.join(", ")}`);

    // Find identity spec
    const specSlug = personaConfig.identitySpec.toLowerCase().replace(/^([a-z]+)-/, 'spec-$1-');
    const identitySpec = await prisma.analysisSpec.findUnique({
      where: { slug: specSlug },
    });

    if (!identitySpec) {
      console.warn(`⚠️  Identity spec "${specSlug}" not found, skipping...`);
      continue;
    }

    // Apply to all target domains
    for (const domainSlug of domainSlugs) {
      const domain = await prisma.domain.findUnique({
        where: { slug: domainSlug },
      });

      if (!domain) {
        console.warn(`⚠️  Domain "${domainSlug}" not found, skipping...`);
        continue;
      }

      // Update Domain with onboarding configuration
      const updated = await prisma.domain.update({
        where: { id: domain.id },
        data: {
          onboardingWelcome: personaConfig.welcomeTemplate,
          onboardingIdentitySpecId: identitySpec.id,
          onboardingFlowPhases: personaConfig.firstCallFlow,
          onboardingDefaultTargets: defaultTargets,
        },
      });

      console.log(`   ✅ Updated Domain "${domainSlug}"`);
      console.log(`      - Welcome message: ${personaConfig.welcomeTemplate.substring(0, 50)}...`);
      console.log(`      - Identity spec: ${identitySpec.name} (${identitySpec.slug})`);
      console.log(`      - Flow phases: ${personaConfig.firstCallFlow.phases.length} phases`);
      console.log(`      - Default targets: ${Object.keys(defaultTargets).length} parameters`);
    }
  }

  console.log("\n✨ Migration complete!\n");

  // 4. Display summary
  const updatedDomains = await prisma.domain.findMany({
    where: {
      onboardingWelcome: { not: null },
    },
    include: {
      onboardingIdentitySpec: {
        select: {
          slug: true,
          name: true,
        },
      },
    },
  });

  console.log("📋 Summary:");
  console.log(`   Total domains with onboarding config: ${updatedDomains.length}`);
  for (const domain of updatedDomains) {
    console.log(`   - ${domain.slug}: ${domain.onboardingIdentitySpec?.name || "No identity spec"}`);
  }
}

main()
  .catch((error) => {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
