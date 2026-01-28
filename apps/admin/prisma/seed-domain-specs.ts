/**
 * Seed script for Domain-scoped Analysis Specs
 *
 * Run with: npx tsx prisma/seed-domain-specs.ts
 *
 * Creates DOMAIN-scoped specs for engagement, conversation style, and domain-specific behaviors.
 * These specs link to BEHAVIOR parameters that can be adjusted per-playbook.
 */

import { PrismaClient, SpecificationScope, AnalysisOutputType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n🌐 Seeding Domain-scoped Analysis Specs...\n");

  // First, delete existing domain specs to recreate with proper parameter links
  const existingSlugs = [
    "engagement-topic-depth",
    "engagement-response-timing",
    "engagement-proactive-guidance",
    "conversation-formality-match",
    "conversation-expertise-display",
    "conversation-empathy-expression",
    "conversation-question-strategy",
    "engagement-goal-progress",
    "engagement-caller-satisfaction",
    "engagement-handoff-quality",
    "conversation-adaptation-speed",
    "conversation-complexity-matching",
    // New specs with parameter links
    "domain-warmth-level",
    "domain-directness-level",
    "domain-empathy-level",
    "domain-formality-level",
    "domain-proactivity-level",
    "domain-question-rate",
    "domain-pace-matching",
  ];

  for (const slug of existingSlugs) {
    const existing = await prisma.analysisSpec.findUnique({ where: { slug } });
    if (existing) {
      // Delete triggers and actions first (cascade)
      const triggers = await prisma.analysisTrigger.findMany({
        where: { specId: existing.id },
      });
      for (const trigger of triggers) {
        await prisma.analysisAction.deleteMany({ where: { triggerId: trigger.id } });
      }
      await prisma.analysisTrigger.deleteMany({ where: { specId: existing.id } });
      await prisma.analysisSpec.delete({ where: { id: existing.id } });
      console.log(`   🗑️  Deleted existing spec: ${slug}`);
    }
  }

  // Specs that link to actual BEHAVIOR parameters
  const specs = [
    // ========================================
    // WARMTH & EMPATHY
    // ========================================
    {
      slug: "domain-warmth-level",
      name: "Domain Warmth Level",
      description:
        "Measures and adjusts agent warmth for the domain. Wellness domains need high warmth; support needs balanced warmth; sales needs genuine but professional warmth.",
      scope: "DOMAIN" as SpecificationScope,
      outputType: "MEASURE" as AnalysisOutputType,
      domain: "conversation",
      priority: 10,
      triggers: [
        {
          name: "Warmth appropriateness",
          given: "The agent is communicating with the caller",
          when: "Throughout the conversation",
          then: "The agent maintains warmth level appropriate to the domain context.",
          actions: [
            {
              description: "Measure warmth level: Is the agent's warmth appropriate for this domain?",
              parameterId: "BEH-WARMTH",
              weight: 1.0,
            },
            {
              description: "Adjust warmth target based on domain requirements.",
              parameterId: "EXP-BEH-WARMTH",
              weight: 0.8,
            },
          ],
        },
      ],
    },
    {
      slug: "domain-empathy-level",
      name: "Domain Empathy Expression",
      description:
        "Evaluates empathetic expression appropriate to domain. Wellness requires high empathy; support needs empathy with efficiency; sales needs genuine interest.",
      scope: "DOMAIN" as SpecificationScope,
      outputType: "MEASURE" as AnalysisOutputType,
      domain: "conversation",
      priority: 10,
      triggers: [
        {
          name: "Empathy appropriateness",
          given: "The caller expresses emotions, concerns, or challenges",
          when: "Throughout the conversation when emotional content arises",
          then: "The agent expresses empathy appropriate to the domain context.",
          actions: [
            {
              description: "Measure empathy expression rate against domain target.",
              parameterId: "BEH-EMPATHY-RATE",
              weight: 1.0,
            },
            {
              description: "Track empathy level for domain calibration.",
              parameterId: "EXP-BEH-EMPATHY",
              weight: 0.8,
            },
          ],
        },
      ],
    },

    // ========================================
    // FORMALITY & DIRECTNESS
    // ========================================
    {
      slug: "domain-formality-level",
      name: "Domain Formality Level",
      description:
        "Evaluates whether the agent's formality matches domain expectations. Support may be more formal; wellness more casual; sales balanced.",
      scope: "DOMAIN" as SpecificationScope,
      outputType: "MEASURE" as AnalysisOutputType,
      domain: "conversation",
      priority: 9,
      triggers: [
        {
          name: "Formality appropriateness",
          given: "The agent is communicating with the caller",
          when: "Throughout the conversation",
          then: "The agent maintains formality appropriate to the domain.",
          actions: [
            {
              description: "Measure formality alignment with domain expectations.",
              parameterId: "BEH-FORMALITY",
              weight: 1.0,
            },
            {
              description: "Track formality level for domain calibration.",
              parameterId: "EXP-BEH-FORMAL",
              weight: 0.8,
            },
          ],
        },
      ],
    },
    {
      slug: "domain-directness-level",
      name: "Domain Directness Level",
      description:
        "Measures response directness for the domain. Support needs high directness; tutoring needs balanced directness with explanation; wellness may need gentler approach.",
      scope: "DOMAIN" as SpecificationScope,
      outputType: "MEASURE" as AnalysisOutputType,
      domain: "efficiency",
      priority: 9,
      triggers: [
        {
          name: "Directness appropriateness",
          given: "The agent is providing information or guidance",
          when: "The caller needs answers or direction",
          then: "The agent is appropriately direct for the domain context.",
          actions: [
            {
              description: "Measure directness against domain target.",
              parameterId: "BEH-DIRECTNESS",
              weight: 1.0,
            },
            {
              description: "Track MVP directness metric.",
              parameterId: "MVP-BEH-DIRECTNESS",
              weight: 0.8,
            },
          ],
        },
      ],
    },

    // ========================================
    // ENGAGEMENT & PROACTIVITY
    // ========================================
    {
      slug: "domain-proactivity-level",
      name: "Domain Proactivity Level",
      description:
        "Measures how proactively the agent guides conversation. Tutors guide learning paths; support anticipates issues; sales surfaces needs.",
      scope: "DOMAIN" as SpecificationScope,
      outputType: "MEASURE" as AnalysisOutputType,
      domain: "engagement",
      priority: 10,
      triggers: [
        {
          name: "Proactive guidance assessment",
          given: "The agent has opportunities to provide guidance beyond direct questions",
          when: "The caller's situation suggests related needs or next steps",
          then: "The agent appropriately offers proactive guidance matching domain expectations.",
          actions: [
            {
              description: "Measure proactive guidance level against domain target.",
              parameterId: "BEH-PROACTIVE",
              weight: 1.0,
            },
            {
              description: "Track proactivity level for domain calibration.",
              parameterId: "EXP-BEH-PROACTIVE",
              weight: 0.8,
            },
          ],
        },
      ],
    },
    {
      slug: "domain-question-rate",
      name: "Domain Question Strategy",
      description:
        "Evaluates questioning strategy for the domain. Tutors ask Socratic questions; support asks diagnostic questions; sales asks discovery questions.",
      scope: "DOMAIN" as SpecificationScope,
      outputType: "MEASURE" as AnalysisOutputType,
      domain: "engagement",
      priority: 8,
      triggers: [
        {
          name: "Question strategy assessment",
          given: "The agent asks questions during the conversation",
          when: "Information gathering or understanding is needed",
          then: "The agent uses questioning strategy appropriate to the domain.",
          actions: [
            {
              description: "Measure question asking rate against domain target.",
              parameterId: "BEH-QUESTION-RATE",
              weight: 1.0,
            },
          ],
        },
      ],
    },

    // ========================================
    // PACING & ADAPTATION
    // ========================================
    {
      slug: "domain-pace-matching",
      name: "Domain Pace Matching",
      description:
        "Measures how well the agent matches conversation pace. Support needs quick responses; tutoring may need deliberate pacing; sales needs balanced momentum.",
      scope: "DOMAIN" as SpecificationScope,
      outputType: "MEASURE" as AnalysisOutputType,
      domain: "adaptability",
      priority: 9,
      triggers: [
        {
          name: "Pace matching evaluation",
          given: "The agent is responding to caller messages",
          when: "The caller sets a conversation pace through their messages",
          then: "The agent matches or appropriately adjusts pace for the domain.",
          actions: [
            {
              description: "Measure pace matching against domain expectations.",
              parameterId: "BEH-PACE-MATCH",
              weight: 1.0,
            },
            {
              description: "Track response pace for domain calibration.",
              parameterId: "EXP-BEH-PACE",
              weight: 0.8,
            },
          ],
        },
      ],
    },
    {
      slug: "domain-detail-level",
      name: "Domain Detail Level",
      description:
        "Measures response detail level for the domain. Tutoring needs thorough detail; support needs focused detail; sales needs enough detail to build confidence.",
      scope: "DOMAIN" as SpecificationScope,
      outputType: "MEASURE" as AnalysisOutputType,
      domain: "communication",
      priority: 8,
      triggers: [
        {
          name: "Detail level assessment",
          given: "The agent is explaining or providing information",
          when: "The caller needs understanding or clarification",
          then: "The agent provides appropriate detail level for the domain.",
          actions: [
            {
              description: "Measure detail level against domain target.",
              parameterId: "EXP-BEH-DETAIL",
              weight: 1.0,
            },
            {
              description: "Track response length as detail proxy.",
              parameterId: "BEH-RESPONSE-LEN",
              weight: 0.5,
            },
          ],
        },
      ],
    },
  ];

  // Insert specs
  for (const spec of specs) {
    try {
      // Create spec with triggers and actions
      await prisma.analysisSpec.create({
        data: {
          slug: spec.slug,
          name: spec.name,
          description: spec.description,
          scope: spec.scope,
          outputType: spec.outputType,
          domain: spec.domain,
          priority: spec.priority,
          isActive: true,
          triggers: {
            create: spec.triggers.map((t, tIdx) => ({
              name: t.name,
              given: t.given,
              when: t.when,
              then: t.then,
              sortOrder: tIdx,
              actions: {
                create: t.actions.map((a, aIdx) => ({
                  description: a.description,
                  parameterId: a.parameterId,
                  weight: a.weight,
                  sortOrder: aIdx,
                })),
              },
            })),
          },
        },
      });

      console.log(`   ✓ Created: ${spec.name} (${spec.scope})`);
    } catch (error: any) {
      console.error(`   ✗ Error creating spec ${spec.slug}:`, error.message);
    }
  }

  console.log("\n✅ Domain-scoped specs seeded!\n");

  // Summary
  const domainSpecs = await prisma.analysisSpec.count({
    where: { scope: "DOMAIN" },
  });

  // Count specs with parameter links
  const specsWithParams = await prisma.analysisSpec.findMany({
    where: { scope: "DOMAIN" },
    include: {
      triggers: {
        include: {
          actions: {
            where: { parameterId: { not: null } },
          },
        },
      },
    },
  });

  const totalActions = specsWithParams.reduce(
    (sum, spec) => sum + spec.triggers.reduce((tSum, t) => tSum + t.actions.length, 0),
    0
  );

  console.log(`   Total DOMAIN-scoped specs: ${domainSpecs}`);
  console.log(`   Total parameter-linked actions: ${totalActions}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
