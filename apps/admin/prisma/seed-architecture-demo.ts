/**
 * Architecture Demo Seed
 *
 * Run with: npx tsx prisma/seed-architecture-demo.ts
 *
 * This seed demonstrates the new layered architecture:
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    SYSTEM LAYER (always runs)               │
 * │  • Memory extraction from every call                        │
 * │  • OCEAN personality observation                            │
 * │  • Session delta tracking                                   │
 * └─────────────────────────────────────────────────────────────┘
 *                              ↓
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    PLAYBOOK LAYER (per-domain)              │
 * │  • Behavior Dimension targets (sliders: warmth, empathy...) │
 * │  • Prompt template selection                                │
 * │  • Optional domain-specific specs                           │
 * └─────────────────────────────────────────────────────────────┘
 *                              ↓
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    CALLER LAYER (learned)                   │
 * │  • Per-caller overrides (from personality observations)     │
 * │  • "Sarah prefers more direct communication"                │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Key concepts:
 * - SYSTEM specs run automatically for EVERY call (memory, personality)
 * - Playbooks configure BEHAVIOR dimensions (warmth, empathy, etc.)
 * - Behavior dimensions are extensible via Parameter model
 * - CALLER-level targets are learned over time from reward loop
 */

import {
  PrismaClient,
  SpecificationScope,
  AnalysisOutputType,
  MemoryCategory,
  ParameterType,
  BehaviorTargetScope,
  PlaybookStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n🏗️  ARCHITECTURE DEMO SEED\n");
  console.log("This creates a clean demo of the layered architecture.\n");

  // ============================================
  // STEP 1: CLEANUP (optional)
  // ============================================
  console.log("━".repeat(60));
  console.log("STEP 1: Cleanup existing demo data\n");

  // Delete existing demo entities
  const demoSlugs = [
    // System specs
    "system-memory-extraction",
    "system-personality-ocean",
    "system-session-delta",
    // Demo playbook specs (optional)
    "wellness-engagement-check",
  ];

  for (const slug of demoSlugs) {
    const spec = await prisma.analysisSpec.findUnique({ where: { slug } });
    if (spec) {
      // Delete triggers and actions
      const triggers = await prisma.analysisTrigger.findMany({
        where: { specId: spec.id },
      });
      for (const t of triggers) {
        await prisma.analysisAction.deleteMany({ where: { triggerId: t.id } });
      }
      await prisma.analysisTrigger.deleteMany({ where: { specId: spec.id } });
      await prisma.analysisSpec.delete({ where: { id: spec.id } });
      console.log(`   🗑️  Deleted spec: ${slug}`);
    }
  }

  // Delete demo domain and playbook
  const demoDomain = await prisma.domain.findUnique({
    where: { slug: "wellness-demo" },
  });
  if (demoDomain) {
    // Delete playbooks first
    const playbooks = await prisma.playbook.findMany({
      where: { domainId: demoDomain.id },
    });
    for (const pb of playbooks) {
      await prisma.behaviorTarget.deleteMany({ where: { playbookId: pb.id } });
      await prisma.playbookItem.deleteMany({ where: { playbookId: pb.id } });
      await prisma.playbook.delete({ where: { id: pb.id } });
      console.log(`   🗑️  Deleted playbook: ${pb.name}`);
    }
    await prisma.domain.delete({ where: { id: demoDomain.id } });
    console.log(`   🗑️  Deleted domain: wellness-demo`);
  }

  // Delete SYSTEM-level behavior targets (will recreate)
  await prisma.behaviorTarget.deleteMany({
    where: { scope: "SYSTEM" },
  });
  console.log(`   🗑️  Deleted SYSTEM behavior targets`);

  // ============================================
  // STEP 2: BEHAVIOR DIMENSIONS (Parameters)
  // ============================================
  console.log("\n" + "━".repeat(60));
  console.log("STEP 2: Ensure BEHAVIOR Dimension Parameters exist\n");

  // These are the extensible behavior dimensions
  // Admins can add more by creating Parameters with parameterType: BEHAVIOR
  const behaviorDimensions = [
    {
      parameterId: "BEH-WARMTH",
      name: "Warmth",
      definition:
        "How warm and friendly the agent's communication style should be",
      scaleType: "0-1",
      directionality: "higher_better",
      computedBy: "measured",
      sectionId: "behavior",
      domainGroup: "communication",
      isAdjustable: true,
      defaultTarget: 0.5,
    },
    {
      parameterId: "BEH-EMPATHY-RATE",
      name: "Empathy",
      definition:
        "How much empathetic acknowledgment the agent should express",
      scaleType: "0-1",
      directionality: "higher_better",
      computedBy: "measured",
      sectionId: "behavior",
      domainGroup: "communication",
      isAdjustable: true,
      defaultTarget: 0.5,
    },
    {
      parameterId: "BEH-FORMALITY",
      name: "Formality",
      definition:
        "How formal vs casual the agent's language and tone should be",
      scaleType: "0-1",
      directionality: "neutral",
      computedBy: "measured",
      sectionId: "behavior",
      domainGroup: "communication",
      isAdjustable: true,
      defaultTarget: 0.5,
    },
    {
      parameterId: "BEH-DIRECTNESS",
      name: "Directness",
      definition:
        "How direct and concise the agent should be in responses",
      scaleType: "0-1",
      directionality: "neutral",
      computedBy: "measured",
      sectionId: "behavior",
      domainGroup: "communication",
      isAdjustable: true,
      defaultTarget: 0.5,
    },
    {
      parameterId: "BEH-PROACTIVE",
      name: "Proactivity",
      definition:
        "How proactively the agent should offer additional information or guidance",
      scaleType: "0-1",
      directionality: "neutral",
      computedBy: "measured",
      sectionId: "behavior",
      domainGroup: "engagement",
      isAdjustable: true,
      defaultTarget: 0.5,
    },
    {
      parameterId: "BEH-QUESTION-RATE",
      name: "Question Rate",
      definition: "How often the agent should ask clarifying questions",
      scaleType: "0-1",
      directionality: "neutral",
      computedBy: "measured",
      sectionId: "behavior",
      domainGroup: "engagement",
      isAdjustable: true,
      defaultTarget: 0.5,
    },
    {
      parameterId: "BEH-PACE-MATCH",
      name: "Pace Matching",
      definition:
        "How well the agent matches the caller's communication pace",
      scaleType: "0-1",
      directionality: "higher_better",
      computedBy: "measured",
      sectionId: "behavior",
      domainGroup: "adaptability",
      isAdjustable: true,
      defaultTarget: 0.5,
    },
  ];

  for (const dim of behaviorDimensions) {
    const existing = await prisma.parameter.findUnique({
      where: { parameterId: dim.parameterId },
    });

    if (existing) {
      // Ensure it's marked as BEHAVIOR and adjustable
      await prisma.parameter.update({
        where: { parameterId: dim.parameterId },
        data: {
          parameterType: ParameterType.BEHAVIOR,
          isAdjustable: dim.isAdjustable,
        },
      });
      console.log(`   ✓ Updated: ${dim.parameterId} (BEHAVIOR, adjustable)`);
    } else {
      await prisma.parameter.create({
        data: {
          parameterId: dim.parameterId,
          name: dim.name,
          definition: dim.definition,
          scaleType: dim.scaleType,
          directionality: dim.directionality,
          computedBy: dim.computedBy,
          sectionId: dim.sectionId,
          domainGroup: dim.domainGroup,
          parameterType: ParameterType.BEHAVIOR,
          isAdjustable: dim.isAdjustable,
        },
      });
      console.log(`   ✓ Created: ${dim.parameterId} (BEHAVIOR, adjustable)`);
    }
  }

  // ============================================
  // STEP 3: SYSTEM-LEVEL BEHAVIOR TARGETS
  // ============================================
  console.log("\n" + "━".repeat(60));
  console.log("STEP 3: Create SYSTEM-level behavior targets (global defaults)\n");

  for (const dim of behaviorDimensions) {
    await prisma.behaviorTarget.create({
      data: {
        parameterId: dim.parameterId,
        scope: BehaviorTargetScope.SYSTEM,
        targetValue: dim.defaultTarget,
        confidence: 1.0,
        source: "SEED",
      },
    });
    console.log(
      `   ✓ SYSTEM target: ${dim.parameterId} = ${dim.defaultTarget}`
    );
  }

  // ============================================
  // STEP 4: SYSTEM-SCOPE SPECS (Always Run)
  // ============================================
  console.log("\n" + "━".repeat(60));
  console.log("STEP 4: Create SYSTEM-scope specs (foundational, always run)\n");

  // These specs run for EVERY call regardless of domain
  const systemSpecs = [
    {
      slug: "system-memory-extraction",
      name: "Memory Extraction",
      description:
        "Extracts facts, preferences, and context from every call. This spec runs automatically for all calls regardless of domain.",
      scope: SpecificationScope.SYSTEM,
      outputType: AnalysisOutputType.LEARN,
      domain: "memory",
      priority: 100, // Highest priority - runs first
      triggers: [
        {
          name: "Extract personal facts",
          given: "A caller interacts with the agent",
          when: "The caller mentions personal information (location, job, family, etc.)",
          then: "Extract and store the fact as a CallerMemory",
          actions: [
            {
              description:
                "Extract location-related facts (city, country, timezone)",
              learnCategory: MemoryCategory.FACT,
              learnKeyPrefix: "location_",
              weight: 1.0,
            },
            {
              description:
                "Extract professional facts (job title, company, industry)",
              learnCategory: MemoryCategory.FACT,
              learnKeyPrefix: "work_",
              weight: 1.0,
            },
            {
              description:
                "Extract relationship facts (family, pets, relationships)",
              learnCategory: MemoryCategory.RELATIONSHIP,
              learnKeyPrefix: "relationship_",
              weight: 1.0,
            },
          ],
        },
        {
          name: "Extract preferences",
          given: "A caller interacts with the agent",
          when: "The caller expresses preferences about communication or service",
          then: "Extract and store the preference as a CallerMemory",
          actions: [
            {
              description:
                "Extract communication preferences (contact method, response length, formality)",
              learnCategory: MemoryCategory.PREFERENCE,
              learnKeyPrefix: "pref_comm_",
              weight: 1.0,
            },
            {
              description:
                "Extract service preferences (frequency, channels, timing)",
              learnCategory: MemoryCategory.PREFERENCE,
              learnKeyPrefix: "pref_service_",
              weight: 1.0,
            },
          ],
        },
        {
          name: "Extract topics",
          given: "A caller interacts with the agent",
          when: "The caller discusses specific topics or expresses interest",
          then: "Track topics as CallerMemory for context building",
          actions: [
            {
              description:
                "Extract topics of interest (products, services, subjects)",
              learnCategory: MemoryCategory.TOPIC,
              learnKeyPrefix: "topic_",
              weight: 0.8,
            },
          ],
        },
      ],
    },
    {
      slug: "system-personality-ocean",
      name: "OCEAN Personality Observation",
      description:
        "Observes Big Five personality traits from caller communication patterns. Runs automatically for all calls.",
      scope: SpecificationScope.SYSTEM,
      outputType: AnalysisOutputType.MEASURE,
      domain: "personality",
      priority: 90,
      triggers: [
        {
          name: "Observe personality traits",
          given: "A caller has multiple conversation turns",
          when: "Sufficient conversational content exists for personality inference",
          then: "Score caller on Big Five personality dimensions",
          actions: [
            {
              description:
                "Measure Openness: curiosity, creativity, openness to new ideas",
              parameterId: "B5-O",
              weight: 1.0,
            },
            {
              description:
                "Measure Conscientiousness: organization, dependability, self-discipline",
              parameterId: "B5-C",
              weight: 1.0,
            },
            {
              description:
                "Measure Extraversion: sociability, assertiveness, positive emotions",
              parameterId: "B5-E",
              weight: 1.0,
            },
            {
              description:
                "Measure Agreeableness: cooperation, trust, helpfulness",
              parameterId: "B5-A",
              weight: 1.0,
            },
            {
              description:
                "Measure Neuroticism: anxiety, emotional volatility, negativity",
              parameterId: "B5-N",
              weight: 1.0,
            },
          ],
        },
      ],
    },
    {
      slug: "system-session-delta",
      name: "Session Delta Tracking",
      description:
        "Tracks changes in caller state between calls (engagement, mood, rapport changes). Runs automatically.",
      scope: SpecificationScope.SYSTEM,
      outputType: AnalysisOutputType.ADAPT,
      domain: "delta",
      priority: 80,
      triggers: [
        {
          name: "Track engagement changes",
          given: "A caller has had previous calls",
          when: "This call can be compared to previous calls",
          then: "Compute delta values for key metrics",
          actions: [
            {
              description:
                "Compute engagement delta: Did the caller become more or less engaged?",
              parameterId: "DELTA-ENGAGEMENT",
              weight: 1.0,
            },
            {
              description:
                "Compute rapport delta: Did rapport improve or decline?",
              parameterId: "DELTA-RAPPORT",
              weight: 1.0,
            },
          ],
        },
      ],
    },
  ];

  // Ensure Big Five parameters exist
  const b5Params = [
    { parameterId: "B5-O", name: "Openness" },
    { parameterId: "B5-C", name: "Conscientiousness" },
    { parameterId: "B5-E", name: "Extraversion" },
    { parameterId: "B5-A", name: "Agreeableness" },
    { parameterId: "B5-N", name: "Neuroticism" },
  ];

  for (const p of b5Params) {
    const exists = await prisma.parameter.findUnique({
      where: { parameterId: p.parameterId },
    });
    if (!exists) {
      await prisma.parameter.create({
        data: {
          parameterId: p.parameterId,
          name: p.name,
          definition: `Big Five personality trait: ${p.name}`,
          scaleType: "0-1",
          directionality: "neutral",
          computedBy: "measured",
          sectionId: "personality",
          domainGroup: "big-five",
          parameterType: ParameterType.TRAIT,
          isAdjustable: false, // Traits are observed, not targeted
        },
      });
      console.log(`   ✓ Created personality param: ${p.parameterId}`);
    }
  }

  // Ensure delta parameters exist
  const deltaParams = [
    { parameterId: "DELTA-ENGAGEMENT", name: "Engagement Delta" },
    { parameterId: "DELTA-RAPPORT", name: "Rapport Delta" },
  ];

  for (const p of deltaParams) {
    const exists = await prisma.parameter.findUnique({
      where: { parameterId: p.parameterId },
    });
    if (!exists) {
      await prisma.parameter.create({
        data: {
          parameterId: p.parameterId,
          name: p.name,
          definition: `Session-to-session change tracking: ${p.name}`,
          scaleType: "-1-1",
          directionality: "higher_better",
          computedBy: "computed",
          sectionId: "delta",
          domainGroup: "session-tracking",
          parameterType: ParameterType.ADAPT,
          isAdjustable: false, // Deltas are computed, not targeted
        },
      });
      console.log(`   ✓ Created delta param: ${p.parameterId}`);
    }
  }

  // Create SYSTEM specs
  for (const spec of systemSpecs) {
    const created = await prisma.analysisSpec.create({
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
              create: t.actions.map((a: any, aIdx) => ({
                description: a.description,
                parameterId: a.parameterId || null,
                learnCategory: a.learnCategory || null,
                learnKeyPrefix: a.learnKeyPrefix || null,
                weight: a.weight,
                sortOrder: aIdx,
              })),
            },
          })),
        },
      },
    });
    console.log(`   ✓ Created SYSTEM spec: ${spec.name}`);
  }

  // ============================================
  // STEP 5: DEMO DOMAIN + PLAYBOOK
  // ============================================
  console.log("\n" + "━".repeat(60));
  console.log("STEP 5: Create demo Domain and Playbook\n");

  // Create demo domain
  const domain = await prisma.domain.create({
    data: {
      slug: "wellness-demo",
      name: "Wellness Coaching (Demo)",
      description:
        "Demo domain for wellness coaching conversations. Configured for high empathy and warmth.",
      isDefault: false,
      isActive: true,
    },
  });
  console.log(`   ✓ Created domain: ${domain.name}`);

  // Create playbook with BEHAVIOR targets
  const playbook = await prisma.playbook.create({
    data: {
      name: "Wellness Playbook v1",
      description:
        "Wellness-optimized behavior configuration with high empathy, warmth, and appropriate pace.",
      domainId: domain.id,
      status: PlaybookStatus.DRAFT,
      version: "1.0",
    },
  });
  console.log(`   ✓ Created playbook: ${playbook.name}`);

  // Set PLAYBOOK-level behavior targets (these override SYSTEM defaults)
  const wellnessTargets = [
    { parameterId: "BEH-WARMTH", targetValue: 0.8 }, // Higher warmth for wellness
    { parameterId: "BEH-EMPATHY-RATE", targetValue: 0.9 }, // High empathy
    { parameterId: "BEH-FORMALITY", targetValue: 0.3 }, // More casual
    { parameterId: "BEH-DIRECTNESS", targetValue: 0.4 }, // Less direct, more exploratory
    { parameterId: "BEH-PROACTIVE", targetValue: 0.7 }, // Proactive guidance
    { parameterId: "BEH-QUESTION-RATE", targetValue: 0.6 }, // Moderate questioning
    { parameterId: "BEH-PACE-MATCH", targetValue: 0.8 }, // Good pace matching
  ];

  for (const target of wellnessTargets) {
    await prisma.behaviorTarget.create({
      data: {
        parameterId: target.parameterId,
        playbookId: playbook.id,
        scope: BehaviorTargetScope.PLAYBOOK,
        targetValue: target.targetValue,
        confidence: 1.0,
        source: "SEED",
      },
    });
    console.log(
      `   ✓ PLAYBOOK target: ${target.parameterId} = ${target.targetValue}`
    );
  }

  // ============================================
  // STEP 6: SUMMARY
  // ============================================
  console.log("\n" + "━".repeat(60));
  console.log("SUMMARY\n");

  const systemSpecCount = await prisma.analysisSpec.count({
    where: { scope: "SYSTEM" },
  });
  const systemTargetCount = await prisma.behaviorTarget.count({
    where: { scope: "SYSTEM" },
  });
  const playbookTargetCount = await prisma.behaviorTarget.count({
    where: { scope: "PLAYBOOK" },
  });
  const behaviorParamCount = await prisma.parameter.count({
    where: { parameterType: "BEHAVIOR", isAdjustable: true },
  });

  console.log("Created architecture demo with:\n");
  console.log(`   🔹 ${systemSpecCount} SYSTEM specs (run for every call)`);
  console.log(`   🔹 ${systemTargetCount} SYSTEM behavior targets (global defaults)`);
  console.log(`   🔹 ${behaviorParamCount} BEHAVIOR dimensions (extensible)`);
  console.log(`   🔹 1 Domain: wellness-demo`);
  console.log(`   🔹 1 Playbook with ${playbookTargetCount} PLAYBOOK targets`);

  console.log("\n" + "━".repeat(60));
  console.log("HOW IT WORKS\n");

  console.log(`
1. SYSTEM LAYER (always runs):
   - Memory Extraction: Captures facts, preferences, topics from every call
   - Personality OCEAN: Observes Big Five traits
   - Session Delta: Tracks engagement/rapport changes

2. PLAYBOOK LAYER (per-domain):
   - Wellness playbook overrides SYSTEM behavior targets:
     • Warmth: 0.5 → 0.8 (warmer)
     • Empathy: 0.5 → 0.9 (much more empathetic)
     • Formality: 0.5 → 0.3 (more casual)
     • Directness: 0.5 → 0.4 (gentler approach)

3. CALLER LAYER (not seeded - learned over time):
   - As the reward loop runs, individual caller preferences are learned
   - "Sarah prefers very direct answers" → BehaviorTarget(callerId, directness=0.8)

Target Resolution at Runtime:
   SYSTEM (0.5) → PLAYBOOK (0.8) → SEGMENT (none) → CALLER (learned)
   Final target = 0.8 (or caller override if exists)
`);

  console.log("\n✅ Architecture demo seed complete!\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
