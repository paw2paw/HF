/**
 * Seed WNF (Why Nations Fail) - Enhancement Script
 *
 * This script ENHANCES the existing WNF domain created by seed-mabel.ts:
 * - Creates curriculum modules for the WNF curriculum
 * - Links TUT-001 and VOICE-001 system specs to the playbook
 *
 * The WNF domain and playbook are created by seed-mabel.ts with all 12 behavior targets.
 * This script just adds the curriculum modules and system spec links.
 *
 * Run with: npx tsx prisma/seed-wnf.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     WHY NATIONS FAIL - ENHANCEMENT SEED                    ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  // 1. Find the existing WNF domain (created by seed-mabel.ts)
  console.log("\n📍 Looking up WNF Domain and Playbook...\n");

  const domain = await prisma.domain.findUnique({
    where: { slug: "wnf" },
  });

  if (!domain) {
    console.log("   ❌ WNF domain not found. Run seed-mabel.ts first.");
    return;
  }
  console.log(`   ✓ Found Domain: ${domain.name} (${domain.slug})`);

  const playbook = await prisma.playbook.findFirst({
    where: { domainId: domain.id, status: "PUBLISHED" },
    include: { behaviorTargets: true },
  });

  if (!playbook) {
    console.log("   ❌ WNF playbook not found. Run seed-mabel.ts first.");
    return;
  }
  console.log(`   ✓ Found Playbook: ${playbook.name} (${playbook.behaviorTargets.length} targets)`);

  // 2. Find the curriculum
  const curriculum = await prisma.curriculum.findUnique({
    where: { slug: "wnf-content-001" },
    include: { modules: true },
  });

  if (!curriculum) {
    console.log("   ❌ Curriculum 'wnf-content-001' not found. Run seed-from-specs.ts first.");
    return;
  }
  console.log(`   ✓ Found Curriculum: ${curriculum.name}`);

  // 3. Create Curriculum Modules
  console.log("\n📚 Creating Curriculum Modules...\n");

  const modules = [
    {
      slug: "nogales-puzzle",
      name: "The Nogales Puzzle",
      description: "Opening case study: Why is one side of a border city rich and the other poor?",
      sortOrder: 0,
      prerequisites: [],
      masteryThreshold: 0.7,
      content: {
        keyConcepts: ["natural experiment", "institutional divide", "same geography different outcomes"],
        caseStudy: "Nogales, Arizona vs Nogales, Sonora",
        keyQuestion: "Why is one side of the border rich and the other poor when geography, culture, and ethnicity are the same?",
        keyInsight: "The border marks an institutional line, not a natural one.",
      },
    },
    {
      slug: "failed-theories",
      name: "Theories That Don't Work",
      description: "Rebutting geography, culture, and ignorance as explanations for prosperity",
      sortOrder: 1,
      prerequisites: ["nogales-puzzle"],
      masteryThreshold: 0.7,
      content: {
        keyConcepts: ["geography hypothesis", "culture hypothesis", "ignorance hypothesis", "reversal of fortune"],
        rebuttals: {
          geography: "Singapore is on the equator and rich; North/South Korea share same peninsula",
          culture: "North/South Koreans share identical culture but vastly different outcomes",
          ignorance: "Leaders often know good policies but choose extractive ones to stay in power",
        },
        keyInsight: "None of these explain the Reversal of Fortune - why former rich regions became poor.",
      },
    },
    {
      slug: "inclusive-extractive",
      name: "Inclusive vs Extractive Institutions",
      description: "The core thesis: political institutions shape economic institutions",
      sortOrder: 2,
      prerequisites: ["failed-theories"],
      masteryThreshold: 0.8,
      content: {
        keyConcepts: ["inclusive institutions", "extractive institutions", "political vs economic institutions", "pluralism"],
        inclusiveCharacteristics: ["broad participation", "property rights", "rule of law", "incentives for innovation"],
        extractiveCharacteristics: ["concentrated power", "elite extraction", "suppress innovation", "no accountability"],
        keyInsight: "Political institutions shape economic institutions. Concentrated political power leads to extractive economic rules.",
      },
    },
    {
      slug: "virtuous-vicious-circles",
      name: "Virtuous and Vicious Circles",
      description: "How institutions reinforce themselves over time",
      sortOrder: 3,
      prerequisites: ["inclusive-extractive"],
      masteryThreshold: 0.7,
      content: {
        keyConcepts: ["virtuous circle", "vicious circle", "institutional persistence", "feedback loops"],
        keyInsight: "Inclusive institutions create positive feedback loops that reinforce democracy. Extractive institutions create negative loops that concentrate power further.",
      },
    },
    {
      slug: "critical-junctures",
      name: "Critical Junctures",
      description: "Major events that create opportunities for institutional change",
      sortOrder: 4,
      prerequisites: ["virtuous-vicious-circles"],
      masteryThreshold: 0.7,
      content: {
        keyConcepts: ["critical juncture", "institutional drift", "contingency", "path dependence"],
        examples: ["Black Death", "Atlantic trade", "Industrial Revolution", "decolonization"],
        keyInsight: "Major disruptions can break the grip of extractive elites - but the outcome depends on existing institutions and contingent factors.",
      },
    },
    {
      slug: "case-studies",
      name: "Case Studies",
      description: "Applying the framework: Korea, Germany, England's Industrial Revolution",
      sortOrder: 5,
      prerequisites: ["critical-junctures"],
      masteryThreshold: 0.7,
      content: {
        keyConcepts: ["comparative analysis", "natural experiments", "historical evidence"],
        cases: ["North vs South Korea", "East vs West Germany", "England's Glorious Revolution"],
        keyInsight: "Each case study shows how institutional differences - not geography, culture, or knowledge - explain divergent outcomes.",
      },
    },
    {
      slug: "scholarly-critiques",
      name: "Scholarly Critiques",
      description: "Stress-testing understanding: Diamond, Sachs, and the China question",
      sortOrder: 6,
      prerequisites: ["case-studies"],
      masteryThreshold: 0.75,
      content: {
        keyConcepts: ["academic debate", "alternative theories", "edge cases", "critical thinking"],
        critiques: {
          diamond: "Guns, Germs, and Steel emphasizes geography - but WNF shows institutions matter more",
          sachs: "Sachs focuses on geography and aid - WNF shows institutions determine how aid is used",
          china: "Is China an exception? Growth under extractive institutions may be temporary.",
        },
        keyInsight: "Understanding the critiques deepens appreciation for the institutional thesis while acknowledging its limits.",
      },
    },
  ];

  let modulesCreated = 0;
  let modulesUpdated = 0;

  for (const mod of modules) {
    const existing = await prisma.curriculumModule.findFirst({
      where: { curriculumId: curriculum.id, slug: mod.slug },
    });

    if (existing) {
      // Update existing module
      await prisma.curriculumModule.update({
        where: { id: existing.id },
        data: {
          name: mod.name,
          description: mod.description,
          sortOrder: mod.sortOrder,
          prerequisites: mod.prerequisites,
          masteryThreshold: mod.masteryThreshold,
          content: mod.content,
        },
      });
      modulesUpdated++;
    } else {
      // Create new module
      await prisma.curriculumModule.create({
        data: {
          curriculumId: curriculum.id,
          slug: mod.slug,
          name: mod.name,
          description: mod.description,
          sortOrder: mod.sortOrder,
          prerequisites: mod.prerequisites,
          masteryThreshold: mod.masteryThreshold,
          content: mod.content,
        },
      });
      modulesCreated++;
    }
    console.log(`   ✓ ${mod.sortOrder + 1}. ${mod.name}`);
  }

  console.log(`\n   Created ${modulesCreated} new modules (${modulesUpdated} updated)`);

  // 4. Link TUT-001 and VOICE-001 system specs to playbook
  console.log("\n🔗 Linking System Specs to playbook...\n");

  const systemSpecs = await prisma.analysisSpec.findMany({
    where: {
      specType: "SYSTEM",
      isActive: true,
      OR: [
        { slug: "spec-tut-001" },
        { slug: "spec-voice-001" },
      ],
    },
  });

  for (const spec of systemSpecs) {
    const existing = await prisma.playbookSpec.findFirst({
      where: { playbookId: playbook.id, specId: spec.id },
    });

    if (!existing) {
      await prisma.playbookSpec.create({
        data: {
          playbookId: playbook.id,
          specId: spec.id,
          isEnabled: true,
        },
      });
      console.log(`   ✓ Linked: ${spec.name} (${spec.slug})`);
    } else {
      console.log(`   ✓ Already linked: ${spec.name}`);
    }
  }

  // Final summary
  console.log("\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SUMMARY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`
   🌐 Domain: ${domain.slug} (${domain.name})
   📚 Playbook: ${playbook.name}
   🎯 Behavior Targets: ${playbook.behaviorTargets.length}
   📖 Curriculum: ${curriculum.name}
   📚 Modules: ${modules.length}
`);

  console.log("✅ WNF enhancement complete!\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
