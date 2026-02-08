/**
 * MVP Trial Playbook - Seed File
 *
 * Creates a complete Playbook called "MVP Trial" that properly maps the BDD story
 * structure to specs, parameters, and the full analysis pipeline.
 *
 * Structure:
 * ├── Domain: "mvp-trial"
 * ├── Playbook: "MVP Trial v2.0"
 * │   ├── [STORY] BDD Story Spec (STORY-COG-ACT-001)
 * │   ├── [AC-1] Cognitive activation cadence
 * │   │   ├── mvp-measure-engagement (MVP-ENGAGE)
 * │   │   └── mvp-measure-conversation-pace (MVP-CONV-PACE)
 * │   ├── [AC-2] Prompt quality constraints
 * │   │   └── mvp-measure-assertiveness (MVP-TONE-ASSERT)
 * │   ├── [AC-3] Turn-taking constraints
 * │   │   ├── mvp-measure-conversation-dominance (MVP-CONV-DOM)
 * │   │   └── mvp-measure-conversation-pace (MVP-CONV-PACE)
 * │   ├── [AC-4] Advancement requires user input
 * │   │   ├── mvp-measure-conversation-dominance (MVP-CONV-DOM)
 * │   │   └── mvp-measure-engagement (MVP-ENGAGE)
 * │   ├── [AC-5] Non-lecture delivery
 * │   │   ├── mvp-measure-conversation-dominance (MVP-CONV-DOM)
 * │   │   └── mvp-measure-assertiveness (MVP-TONE-ASSERT)
 * │   ├── [PIPELINE] System Analysis
 * │   │   ├── system-measure-agent
 * │   │   ├── system-memory-taxonomy
 * │   │   ├── system-personality-aggregate
 * │   │   ├── system-reward-compute
 * │   │   └── system-target-learn
 * │   └── [COMPOSE] Prompt Generation
 * │       ├── system-slug-select
 * │       ├── system-compose-next-prompt
 * │       └── prompt-slug-* templates
 *
 * Prerequisites:
 * - Run seed-mvp-cognitive-activation.ts first (creates MVP parameters and specs)
 * - Run seed-system-specs.ts first (creates system specs)
 */

import { PrismaClient, PlaybookStatus, PlaybookItemType } from "@prisma/client";

const prisma = new PrismaClient();

// Acceptance Criteria from the BDD story
const acceptanceCriteria = [
  {
    id: "AC-1",
    label: "Cognitive activation cadence",
    description: "System introduces cognitively activating prompts every 120-180 seconds",
    priority: "must",
    specSlugs: ["mvp-measure-engagement", "mvp-measure-conversation-pace"],
    parameters: ["MVP-ENGAGE", "MVP-CONV-PACE"],
    order: 1,
  },
  {
    id: "AC-2",
    label: "Prompt quality constraints",
    description: "Prompts require explanation, reflection, imagination, or opinion; not yes/no",
    priority: "must",
    specSlugs: ["mvp-measure-assertiveness"],
    parameters: ["MVP-TONE-ASSERT"],
    order: 2,
  },
  {
    id: "AC-3",
    label: "Turn-taking constraints",
    description: "Max 2 consecutive system turns; max 120 words per monologue",
    priority: "must",
    specSlugs: ["mvp-measure-conversation-dominance", "mvp-measure-conversation-pace"],
    parameters: ["MVP-CONV-DOM", "MVP-CONV-PACE"],
    order: 3,
  },
  {
    id: "AC-4",
    label: "Advancement requires user input",
    description: "System waits for user response before progressing to next idea",
    priority: "must",
    specSlugs: ["mvp-measure-conversation-dominance", "mvp-measure-engagement"],
    parameters: ["MVP-CONV-DOM", "MVP-ENGAGE"],
    order: 4,
  },
  {
    id: "AC-5",
    label: "Non-lecture delivery",
    description: "Explanations interleaved with prompts; participation opportunity within ≤2 turns",
    priority: "must",
    specSlugs: ["mvp-measure-conversation-dominance", "mvp-measure-assertiveness"],
    parameters: ["MVP-CONV-DOM", "MVP-TONE-ASSERT"],
    order: 5,
  },
];

// Pipeline groups (system specs)
const pipelineGroups = [
  {
    id: "PIPELINE",
    label: "Analysis Pipeline",
    description: "System specs for measurement, learning, and adaptation",
    specSlugs: [
      "system-measure-agent",
      "system-memory-taxonomy",
      "system-personality-aggregate",
      "system-reward-compute",
      "system-target-learn",
    ],
    order: 10,
  },
  {
    id: "COMPOSE",
    label: "Prompt Composition",
    description: "Specs for personalized prompt generation",
    specSlugs: [
      "system-slug-select",
      "system-compose-next-prompt",
    ],
    order: 20,
  },
];

async function main() {
  console.log("\n🎯 Seeding MVP Trial Playbook (Structured)...\n");

  // ============================================
  // 1. CREATE/UPDATE DOMAIN
  // ============================================
  console.log("📁 Creating MVP Trial domain...");

  const domain = await prisma.domain.upsert({
    where: { slug: "mvp-trial" },
    update: {
      name: "MVP Trial",
      description: `Test domain for the MVP Cognitive Activation story.

BDD Story: STORY-COG-ACT-001
"As a user, I want to be mentally active and involved as the conversation advances,
so that the session feels participatory rather than like a lecture."

Time Window: mid_session

This playbook maps 5 Acceptance Criteria to measurement specs:
- AC-1: Cognitive activation cadence (MVP-ENGAGE, MVP-CONV-PACE)
- AC-2: Prompt quality constraints (MVP-TONE-ASSERT)
- AC-3: Turn-taking constraints (MVP-CONV-DOM, MVP-CONV-PACE)
- AC-4: Advancement requires input (MVP-CONV-DOM, MVP-ENGAGE)
- AC-5: Non-lecture delivery (MVP-CONV-DOM, MVP-TONE-ASSERT)`,
      isActive: true,
    },
    create: {
      slug: "mvp-trial",
      name: "MVP Trial",
      description: `Test domain for the MVP Cognitive Activation story.

BDD Story: STORY-COG-ACT-001
"As a user, I want to be mentally active and involved as the conversation advances,
so that the session feels participatory rather than like a lecture."

Time Window: mid_session

This playbook maps 5 Acceptance Criteria to measurement specs:
- AC-1: Cognitive activation cadence (MVP-ENGAGE, MVP-CONV-PACE)
- AC-2: Prompt quality constraints (MVP-TONE-ASSERT)
- AC-3: Turn-taking constraints (MVP-CONV-DOM, MVP-CONV-PACE)
- AC-4: Advancement requires input (MVP-CONV-DOM, MVP-ENGAGE)
- AC-5: Non-lecture delivery (MVP-CONV-DOM, MVP-TONE-ASSERT)`,
      isActive: true,
      isDefault: false,
    },
  });

  console.log(`   ✓ Domain: ${domain.slug} (${domain.id})`);

  // ============================================
  // 2. CREATE/UPDATE PLAYBOOK
  // ============================================
  console.log("\n📚 Creating MVP Trial playbook...");

  let playbook = await prisma.playbook.findFirst({
    where: {
      name: "MVP Trial",
      domainId: domain.id,
    },
  });

  const playbookDescription = `Complete playbook for MVP Cognitive Activation testing.

BDD Story: STORY-COG-ACT-001
"As a user, I want to be mentally active and involved as the conversation advances,
so that the session feels participatory rather than like a lecture."

Time Window: mid_session (after topic framing, before completion signal)

Acceptance Criteria:
- AC-1: Cognitive activation cadence (prompt every 120-180s, max 240s gap)
- AC-2: Prompt quality constraints (open-ended, not yes/no)
- AC-3: Turn-taking constraints (max 2 consecutive turns, max 120 words)
- AC-4: Advancement requires user input
- AC-5: Non-lecture delivery (explanations interleaved with prompts)

Parameters:
- MVP-ENGAGE (0.65-0.85): Engagement level - outcome measure
- MVP-CONV-DOM (0.40-0.55): Conversation dominance - turn-taking balance
- MVP-TONE-ASSERT (0.35-0.50): Assertiveness - invitation vs dictation
- MVP-CONV-PACE (0.40-0.60): Conversation pace - prompt timing control

Pipeline: MEASURE → LEARN → AGGREGATE → REWARD → ADAPT → COMPOSE`;

  if (playbook) {
    playbook = await prisma.playbook.update({
      where: { id: playbook.id },
      data: {
        description: playbookDescription,
        status: PlaybookStatus.DRAFT,
        version: "2.0",
      },
    });
  } else {
    playbook = await prisma.playbook.create({
      data: {
        name: "MVP Trial",
        description: playbookDescription,
        domainId: domain.id,
        status: PlaybookStatus.DRAFT,
        version: "2.0",
      },
    });
  }

  console.log(`   ✓ Playbook: ${playbook.name} v${playbook.version} (${playbook.id})`);

  // ============================================
  // 3. CLEAR EXISTING PLAYBOOK ITEMS
  // ============================================
  console.log("\n🧹 Clearing existing playbook items...");

  const deleted = await prisma.playbookItem.deleteMany({
    where: { playbookId: playbook.id },
  });

  console.log(`   ✓ Removed ${deleted.count} existing items`);

  // ============================================
  // 4. LOAD ALL SPECS
  // ============================================
  console.log("\n🔍 Loading specs...");

  const allSpecs = await prisma.analysisSpec.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, name: true, outputType: true, domain: true },
  });

  const specBySlug = new Map(allSpecs.map(s => [s.slug, s]));
  console.log(`   Found ${allSpecs.length} active specs`);

  // ============================================
  // 5. CREATE PLAYBOOK ITEMS WITH GROUPS
  // ============================================
  console.log("\n📎 Creating grouped playbook items...");

  let sortOrder = 0;
  const itemsCreated: string[] = [];
  const addedSpecIds = new Set<string>();

  // Group 0: BDD Story Spec
  const bddSpec = specBySlug.get("mvp-story-cognitive-activation");
  if (bddSpec) {
    await prisma.playbookItem.create({
      data: {
        playbookId: playbook.id,
        itemType: PlaybookItemType.SPEC,
        specId: bddSpec.id,
        isEnabled: true,
        sortOrder: sortOrder++,
        groupId: "STORY",
        groupLabel: "BDD Story: Mid-session Cognitive Activation",
        groupOrder: 0,
      },
    });
    addedSpecIds.add(bddSpec.id);
    itemsCreated.push(`[STORY] ${bddSpec.slug}`);
    console.log(`   ✓ [STORY] ${bddSpec.name}`);
  }

  // Groups 1-5: Acceptance Criteria
  for (const ac of acceptanceCriteria) {
    console.log(`\n   [${ac.id}] ${ac.label}`);

    for (const specSlug of ac.specSlugs) {
      const spec = specBySlug.get(specSlug);
      if (!spec) {
        console.log(`      ⚠ Spec not found: ${specSlug}`);
        continue;
      }

      // Skip if already added (specs can be in multiple ACs)
      if (addedSpecIds.has(spec.id)) {
        console.log(`      ○ ${spec.name} (already linked)`);
        continue;
      }

      await prisma.playbookItem.create({
        data: {
          playbookId: playbook.id,
          itemType: PlaybookItemType.SPEC,
          specId: spec.id,
          isEnabled: true,
          sortOrder: sortOrder++,
          groupId: ac.id,
          groupLabel: ac.label,
          groupOrder: ac.order,
        },
      });
      addedSpecIds.add(spec.id);
      itemsCreated.push(`[${ac.id}] ${spec.slug}`);
      console.log(`      ✓ ${spec.name}`);
    }
  }

  // Groups 10+: Pipeline
  for (const group of pipelineGroups) {
    console.log(`\n   [${group.id}] ${group.label}`);

    for (const specSlug of group.specSlugs) {
      const spec = specBySlug.get(specSlug);
      if (!spec) {
        console.log(`      ⚠ Spec not found: ${specSlug}`);
        continue;
      }

      if (addedSpecIds.has(spec.id)) {
        console.log(`      ○ ${spec.name} (already linked)`);
        continue;
      }

      await prisma.playbookItem.create({
        data: {
          playbookId: playbook.id,
          itemType: PlaybookItemType.SPEC,
          specId: spec.id,
          isEnabled: true,
          sortOrder: sortOrder++,
          groupId: group.id,
          groupLabel: group.label,
          groupOrder: group.order,
        },
      });
      addedSpecIds.add(spec.id);
      itemsCreated.push(`[${group.id}] ${spec.slug}`);
      console.log(`      ✓ ${spec.name}`);
    }
  }

  // Add prompt slug templates
  console.log(`\n   [SLUGS] Prompt Slug Templates`);
  const promptSlugSpecs = allSpecs.filter(s => s.domain === "prompt-slugs");
  let slugCount = 0;
  for (const spec of promptSlugSpecs) {
    if (addedSpecIds.has(spec.id)) continue;

    await prisma.playbookItem.create({
      data: {
        playbookId: playbook.id,
        itemType: PlaybookItemType.SPEC,
        specId: spec.id,
        isEnabled: true,
        sortOrder: sortOrder++,
        groupId: "SLUGS",
        groupLabel: "Prompt Slug Templates",
        groupOrder: 30,
      },
    });
    addedSpecIds.add(spec.id);
    slugCount++;
  }
  console.log(`      ✓ Added ${slugCount} prompt slug templates`);

  // ============================================
  // 6. UPDATE PLAYBOOK STATS
  // ============================================
  console.log("\n📊 Updating playbook stats...");

  // Count by output type
  const linkedSpecs = allSpecs.filter(s => addedSpecIds.has(s.id));
  const measureCount = linkedSpecs.filter(s => s.outputType === "MEASURE_AGENT" || s.outputType === "MEASURE").length;
  const learnCount = linkedSpecs.filter(s => s.outputType === "LEARN").length;
  const adaptCount = linkedSpecs.filter(s => s.outputType === "ADAPT").length;

  // Count unique MVP parameters
  const mvpParamCount = 4; // MVP-ENGAGE, MVP-CONV-DOM, MVP-TONE-ASSERT, MVP-CONV-PACE

  await prisma.playbook.update({
    where: { id: playbook.id },
    data: {
      measureSpecCount: measureCount,
      learnSpecCount: learnCount,
      adaptSpecCount: adaptCount,
      parameterCount: mvpParamCount,
    },
  });

  console.log(`   Measure specs: ${measureCount}`);
  console.log(`   Learn specs: ${learnCount}`);
  console.log(`   Adapt specs: ${adaptCount}`);
  console.log(`   Parameters: ${mvpParamCount}`);

  // ============================================
  // 7. SUMMARY
  // ============================================
  console.log("\n✅ MVP Trial Playbook seeding complete!\n");
  console.log("Structure:");
  console.log(`  Domain: ${domain.name} (${domain.slug})`);
  console.log(`  Playbook: ${playbook.name} v${playbook.version}`);
  console.log(`  Total Items: ${itemsCreated.length}`);

  console.log("\n📋 Groups:");

  // Group items for display
  const itemsByGroup = new Map<string, string[]>();
  for (const item of itemsCreated) {
    const match = item.match(/\[([^\]]+)\]/);
    const group = match ? match[1] : "OTHER";
    if (!itemsByGroup.has(group)) itemsByGroup.set(group, []);
    itemsByGroup.get(group)!.push(item.replace(/\[[^\]]+\]\s*/, ""));
  }

  // Display order
  const displayOrder = ["STORY", "AC-1", "AC-2", "AC-3", "AC-4", "AC-5", "PIPELINE", "COMPOSE", "SLUGS"];
  for (const groupId of displayOrder) {
    const items = itemsByGroup.get(groupId);
    if (!items) continue;
    const ac = acceptanceCriteria.find(a => a.id === groupId);
    const pg = pipelineGroups.find(p => p.id === groupId);
    const label = ac?.label || pg?.label || groupId;
    console.log(`\n  ${groupId}: ${label}`);
    for (const item of items.slice(0, 5)) {
      console.log(`    - ${item}`);
    }
    if (items.length > 5) {
      console.log(`    ... and ${items.length - 5} more`);
    }
  }

  console.log("\n🌳 View the tree at: /playbooks/{id}/tree");
}

main()
  .catch((e) => {
    console.error("Error seeding MVP Trial Playbook:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
