/**
 * Seed script: Create proper ADAPT specs for behavioral adaptations
 *
 * This script reclassifies specs that were incorrectly in prompt-slugs domain
 * to proper ADAPT specs with triggers and parameter-linked actions.
 *
 * Run with: npx ts-node prisma/seed-behavioral-adapt-specs.ts
 */

import { PrismaClient, AnalysisOutputType, SpecificationScope } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================================
// ADAPT Spec Definitions
// ============================================================================

interface AdaptAction {
  description: string;
  parameterId: string;
  // Target adjustment: negative = decrease, positive = increase
  // Values are deltas from current effective target
  targetDelta?: number;
  // Or absolute target value (0-1)
  absoluteTarget?: number;
  weight: number;
}

interface AdaptTrigger {
  name: string;
  given: string;
  when: string;
  then: string;
  actions: AdaptAction[];
}

interface AdaptSpec {
  slug: string;
  name: string;
  description: string;
  category: string;
  triggers: AdaptTrigger[];
  // Original prompt template for reference (will be stored in config)
  guidanceNotes: string;
}

const emotionAdaptSpecs: AdaptSpec[] = [
  {
    slug: "adapt-emotion-soothing",
    name: "Adapt: Soothing Mode",
    description: "Activates calm, gentle communication when caller shows high distress or anxiety.",
    category: "emotion",
    guidanceNotes: "Use calm tone, acknowledge feelings, measured pace, avoid rushing to solutions.",
    triggers: [
      {
        name: "High distress detected",
        given: "Caller shows signs of high distress, anxiety, or emotional overwhelm",
        when: "Agent responds to distressed caller",
        then: "Apply soothing behavioral adjustments across communication parameters",
        actions: [
          {
            description: "Significantly reduce assertiveness for gentle, non-directive tone",
            parameterId: "MVP-TONE-ASSERT",
            absoluteTarget: 0.20,
            weight: 1.0,
          },
          {
            description: "Slow conversation pace for measured, calm delivery",
            parameterId: "MVP-CONV-PACE",
            targetDelta: -0.15,
            weight: 0.9,
          },
          {
            description: "Reduce dominance to let caller feel heard",
            parameterId: "MVP-CONV-DOM",
            absoluteTarget: 0.35,
            weight: 0.8,
          },
        ],
      },
    ],
  },
  {
    slug: "adapt-emotion-validating",
    name: "Adapt: Validating Mode",
    description: "Validates feelings while maintaining forward momentum for moderate emotional states.",
    category: "emotion",
    guidanceNotes: "Acknowledge feelings as valid, use reflective statements, balance empathy with progression.",
    triggers: [
      {
        name: "Moderate emotional state detected",
        given: "Caller is experiencing some emotional response to their situation",
        when: "Agent responds to emotional content",
        then: "Apply validating behavioral adjustments",
        actions: [
          {
            description: "Moderately reduce assertiveness for empathetic tone",
            parameterId: "MVP-TONE-ASSERT",
            absoluteTarget: 0.35,
            weight: 1.0,
          },
          {
            description: "Increase engagement focus to ensure caller feels heard",
            parameterId: "MVP-ENGAGE",
            targetDelta: 0.10,
            weight: 0.8,
          },
        ],
      },
    ],
  },
  {
    slug: "adapt-emotion-reassuring",
    name: "Adapt: Reassuring Mode",
    description: "Provides confident, supportive communication when caller needs a confidence boost.",
    category: "emotion",
    guidanceNotes: "Clear guidance, affirm ability, supportive language, celebrate small wins.",
    triggers: [
      {
        name: "Uncertainty or low confidence detected",
        given: "Caller shows signs of uncertainty or lacking confidence",
        when: "Agent provides guidance or information",
        then: "Apply reassuring behavioral adjustments",
        actions: [
          {
            description: "Balanced assertiveness for confident but not pushy delivery",
            parameterId: "MVP-TONE-ASSERT",
            absoluteTarget: 0.45,
            weight: 1.0,
          },
          {
            description: "Maintain good engagement to build rapport",
            parameterId: "MVP-ENGAGE",
            absoluteTarget: 0.70,
            weight: 0.8,
          },
        ],
      },
    ],
  },
  {
    slug: "adapt-emotion-deescalate",
    name: "Adapt: De-escalation Mode",
    description: "Lowers emotional temperature when caller is frustrated or angry.",
    category: "emotion",
    guidanceNotes: "Stay calm, don't match energy, acknowledge frustration, focus on what CAN be done.",
    triggers: [
      {
        name: "Frustration or anger detected",
        given: "Caller is showing frustration, upset, or anger signals",
        when: "Agent responds to frustrated caller",
        then: "Apply de-escalation behavioral adjustments",
        actions: [
          {
            description: "Significantly reduce assertiveness for calm, non-confrontational tone",
            parameterId: "MVP-TONE-ASSERT",
            absoluteTarget: 0.25,
            weight: 1.0,
          },
          {
            description: "Slow down pace to avoid escalation",
            parameterId: "MVP-CONV-PACE",
            targetDelta: -0.20,
            weight: 0.9,
          },
          {
            description: "Reduce dominance to give caller space to vent",
            parameterId: "MVP-CONV-DOM",
            absoluteTarget: 0.30,
            weight: 0.9,
          },
        ],
      },
    ],
  },
  {
    slug: "adapt-emotion-grounding",
    name: "Adapt: Grounding Mode",
    description: "Helps overwhelmed callers focus on the present moment with clear structure.",
    category: "emotion",
    guidanceNotes: "Focus on one thing at a time, concrete language, gentle redirects, break things down.",
    triggers: [
      {
        name: "Overwhelm or scattered state detected",
        given: "Caller seems overwhelmed, scattered, or unable to focus",
        when: "Agent helps caller organize thoughts",
        then: "Apply grounding behavioral adjustments",
        actions: [
          {
            description: "Slow pace to give space for processing",
            parameterId: "MVP-CONV-PACE",
            targetDelta: -0.15,
            weight: 1.0,
          },
          {
            description: "Slightly higher dominance to provide structure",
            parameterId: "MVP-CONV-DOM",
            absoluteTarget: 0.50,
            weight: 0.8,
          },
          {
            description: "Moderate assertiveness for clear guidance",
            parameterId: "MVP-TONE-ASSERT",
            absoluteTarget: 0.40,
            weight: 0.7,
          },
        ],
      },
    ],
  },
];

const controlAdaptSpecs: AdaptSpec[] = [
  {
    slug: "adapt-control-redirect",
    name: "Adapt: Redirect Mode",
    description: "Gently steers conversation back on track without being dismissive.",
    category: "control",
    guidanceNotes: "Acknowledge before redirecting, use bridging phrases, connect to original goal.",
    triggers: [
      {
        name: "Off-topic conversation detected",
        given: "Conversation has drifted from the main topic or goal",
        when: "Agent needs to redirect conversation flow",
        then: "Apply redirect behavioral adjustments",
        actions: [
          {
            description: "Briefly increase dominance to take initiative",
            parameterId: "MVP-CONV-DOM",
            absoluteTarget: 0.55,
            weight: 1.0,
          },
          {
            description: "Moderate assertiveness for clear but kind redirection",
            parameterId: "MVP-TONE-ASSERT",
            absoluteTarget: 0.45,
            weight: 0.8,
          },
        ],
      },
    ],
  },
  {
    slug: "adapt-control-clarify",
    name: "Adapt: Clarify Mode",
    description: "Gathers more information when request is ambiguous or incomplete.",
    category: "control",
    guidanceNotes: "Ask clear specific questions, one at a time, summarize understanding.",
    triggers: [
      {
        name: "Ambiguous request detected",
        given: "Caller's request is unclear or more information is needed",
        when: "Agent needs to gather clarifying information",
        then: "Apply clarification behavioral adjustments",
        actions: [
          {
            description: "Balance dominance for back-and-forth clarification",
            parameterId: "MVP-CONV-DOM",
            absoluteTarget: 0.45,
            weight: 1.0,
          },
          {
            description: "Low-moderate assertiveness for open questioning",
            parameterId: "MVP-TONE-ASSERT",
            absoluteTarget: 0.35,
            weight: 0.8,
          },
          {
            description: "Focus on engagement through probing questions",
            parameterId: "MVP-ENGAGE",
            absoluteTarget: 0.75,
            weight: 0.7,
          },
        ],
      },
    ],
  },
  {
    slug: "adapt-control-summarize",
    name: "Adapt: Summarize Mode",
    description: "Consolidates discussion and confirms shared understanding.",
    category: "control",
    guidanceNotes: "Clear concise summary, highlight decisions, note next steps, ask for confirmation.",
    triggers: [
      {
        name: "Summary point reached",
        given: "Significant discussion has occurred that needs consolidation",
        when: "Agent summarizes and confirms understanding",
        then: "Apply summarization behavioral adjustments",
        actions: [
          {
            description: "Higher dominance to deliver summary",
            parameterId: "MVP-CONV-DOM",
            absoluteTarget: 0.60,
            weight: 1.0,
          },
          {
            description: "Moderate assertiveness for clear delivery",
            parameterId: "MVP-TONE-ASSERT",
            absoluteTarget: 0.45,
            weight: 0.8,
          },
        ],
      },
    ],
  },
  {
    slug: "adapt-control-slow-down",
    name: "Adapt: Slow Down Mode",
    description: "Deliberately slows conversation when moving too fast or caller seems rushed.",
    category: "control",
    guidanceNotes: "Pump the brakes gently, deliberate pauses, break into smaller pieces.",
    triggers: [
      {
        name: "Fast pace detected",
        given: "Conversation is moving too fast or caller seems rushed/overwhelmed",
        when: "Agent responds to fast-paced exchange",
        then: "Apply slow-down behavioral adjustments",
        actions: [
          {
            description: "Significantly slow conversation pace",
            parameterId: "MVP-CONV-PACE",
            targetDelta: -0.25,
            weight: 1.0,
          },
          {
            description: "Lower assertiveness for gentler delivery",
            parameterId: "MVP-TONE-ASSERT",
            absoluteTarget: 0.30,
            weight: 0.8,
          },
        ],
      },
    ],
  },
  {
    slug: "adapt-control-close-topic",
    name: "Adapt: Close Topic Mode",
    description: "Wraps up current topic and transitions to next or end.",
    category: "control",
    guidanceNotes: "Signal wrapping up, summarize conclusions, ask if anything else, clear transition.",
    triggers: [
      {
        name: "Topic closure appropriate",
        given: "Current topic has been adequately addressed",
        when: "Agent closes topic and transitions",
        then: "Apply topic closure behavioral adjustments",
        actions: [
          {
            description: "Higher dominance to control transition",
            parameterId: "MVP-CONV-DOM",
            absoluteTarget: 0.55,
            weight: 1.0,
          },
          {
            description: "Moderate assertiveness for clear closure",
            parameterId: "MVP-TONE-ASSERT",
            absoluteTarget: 0.45,
            weight: 0.8,
          },
        ],
      },
    ],
  },
];

const engageAdaptSpecs: AdaptSpec[] = [
  {
    slug: "adapt-engage-encourage",
    name: "Adapt: Encourage Mode",
    description: "Provides warm encouragement and positive energy to motivate caller.",
    category: "engage",
    guidanceNotes: "Warm enthusiasm, celebrate progress, express confidence, energizing language.",
    triggers: [
      {
        name: "Encouragement opportunity",
        given: "Caller could benefit from encouragement or positive reinforcement",
        when: "Agent provides motivational support",
        then: "Apply encouragement behavioral adjustments",
        actions: [
          {
            description: "High engagement for warm connection",
            parameterId: "MVP-ENGAGE",
            absoluteTarget: 0.80,
            weight: 1.0,
          },
          {
            description: "Moderate assertiveness for confident support",
            parameterId: "MVP-TONE-ASSERT",
            absoluteTarget: 0.45,
            weight: 0.7,
          },
        ],
      },
    ],
  },
  {
    slug: "adapt-engage-prompt-action",
    name: "Adapt: Prompt Action Mode",
    description: "Moves conversation from discussion to concrete next steps.",
    category: "engage",
    guidanceNotes: "Be specific about actions, break into steps, set expectations, offer support.",
    triggers: [
      {
        name: "Action point reached",
        given: "Discussion has reached a point where action is appropriate",
        when: "Agent prompts caller toward action",
        then: "Apply action-prompting behavioral adjustments",
        actions: [
          {
            description: "Higher assertiveness for clear action guidance",
            parameterId: "MVP-TONE-ASSERT",
            absoluteTarget: 0.55,
            weight: 1.0,
          },
          {
            description: "Moderate dominance to guide toward action",
            parameterId: "MVP-CONV-DOM",
            absoluteTarget: 0.50,
            weight: 0.8,
          },
        ],
      },
    ],
  },
];

// ============================================================================
// Main seeding function
// ============================================================================

async function main() {
  console.log("=== Seeding Behavioral ADAPT Specs ===\n");

  const allSpecs = [...emotionAdaptSpecs, ...controlAdaptSpecs, ...engageAdaptSpecs];

  // Verify MVP parameters exist
  const requiredParams = ["MVP-TONE-ASSERT", "MVP-CONV-PACE", "MVP-CONV-DOM", "MVP-ENGAGE"];
  const existingParams = await prisma.parameter.findMany({
    where: { parameterId: { in: requiredParams } },
    select: { parameterId: true },
  });
  const existingParamIds = new Set(existingParams.map((p) => p.parameterId));

  const missingParams = requiredParams.filter((id) => !existingParamIds.has(id));
  if (missingParams.length > 0) {
    console.error(`[ERROR] Missing required parameters: ${missingParams.join(", ")}`);
    console.error("Please run the MVP parameters seed first.");
    process.exit(1);
  }

  console.log(`Found all ${requiredParams.length} required parameters.\n`);

  let specsCreated = 0;
  let triggersCreated = 0;
  let actionsCreated = 0;

  for (const spec of allSpecs) {
    console.log(`--- ${spec.name} ---`);

    // Upsert the spec
    const existingSpec = await prisma.analysisSpec.findUnique({
      where: { slug: spec.slug },
      include: { triggers: true },
    });

    if (existingSpec) {
      // Delete existing triggers (cascade deletes actions)
      if (existingSpec.triggers.length > 0) {
        await prisma.analysisTrigger.deleteMany({
          where: { specId: existingSpec.id },
        });
        console.log(`  Deleted ${existingSpec.triggers.length} existing triggers`);
      }
    }

    // Upsert the spec
    const createdSpec = await prisma.analysisSpec.upsert({
      where: { slug: spec.slug },
      update: {
        name: spec.name,
        description: spec.description,
        outputType: "ADAPT" as AnalysisOutputType,
        domain: "behavioral-adaptation",
        isActive: true,
        isDirty: false,
        config: {
          category: spec.category,
          guidanceNotes: spec.guidanceNotes,
        },
      },
      create: {
        slug: spec.slug,
        name: spec.name,
        description: spec.description,
        scope: "SYSTEM" as SpecificationScope,
        outputType: "ADAPT" as AnalysisOutputType,
        domain: "behavioral-adaptation",
        priority: 50,
        isActive: true,
        isDirty: false,
        config: {
          category: spec.category,
          guidanceNotes: spec.guidanceNotes,
        },
      },
    });

    specsCreated++;

    // Create triggers and actions
    for (let i = 0; i < spec.triggers.length; i++) {
      const trigger = spec.triggers[i];

      // Create trigger first (without nested actions)
      const createdTrigger = await prisma.analysisTrigger.create({
        data: {
          specId: createdSpec.id,
          name: trigger.name,
          given: trigger.given,
          when: trigger.when,
          then: trigger.then,
          sortOrder: i,
        },
      });

      triggersCreated++;

      // Create actions separately (to avoid Prisma nested create limitation with parameterId)
      for (let j = 0; j < trigger.actions.length; j++) {
        const action = trigger.actions[j];

        // Build description with target info encoded at the end
        let fullDescription = action.description;
        if (action.absoluteTarget !== undefined) {
          fullDescription += ` [target: ${action.absoluteTarget}]`;
        } else if (action.targetDelta !== undefined) {
          const sign = action.targetDelta >= 0 ? "+" : "";
          fullDescription += ` [delta: ${sign}${action.targetDelta}]`;
        }

        await prisma.analysisAction.create({
          data: {
            triggerId: createdTrigger.id,
            description: fullDescription,
            parameterId: action.parameterId,
            weight: action.weight,
            sortOrder: j,
          },
        });
        actionsCreated++;
      }
    }

    console.log(`  Created spec with ${spec.triggers.length} trigger(s)`);
  }

  // Mark old prompt-slug versions as inactive (don't delete, keep for reference)
  const oldSlugs = [
    "prompt-slug-emotion-soothing",
    "prompt-slug-emotion-validating",
    "prompt-slug-emotion-reassuring",
    "prompt-slug-emotion-deescalate",
    "prompt-slug-emotion-grounding",
    "prompt-slug-control-redirect",
    "prompt-slug-control-clarify",
    "prompt-slug-control-summarise",
    "prompt-slug-control-slow-down",
    "prompt-slug-control-close-topic",
    "prompt-slug-engage-encourage",
    "prompt-slug-engage-prompt-action",
  ];

  const deactivated = await prisma.analysisSpec.updateMany({
    where: { slug: { in: oldSlugs } },
    data: {
      isActive: false,
      description: prisma.raw ? undefined : undefined, // Can't easily append, so just deactivate
    },
  });

  console.log(`\n=== Summary ===`);
  console.log(`Specs created/updated: ${specsCreated}`);
  console.log(`Triggers created: ${triggersCreated}`);
  console.log(`Actions created: ${actionsCreated}`);
  console.log(`Old prompt-slug specs deactivated: ${deactivated.count}`);

  // Show final state
  const finalSpecs = await prisma.analysisSpec.findMany({
    where: {
      OR: [
        { domain: "behavioral-adaptation" },
        { slug: { in: oldSlugs } },
      ],
    },
    select: {
      slug: true,
      name: true,
      outputType: true,
      domain: true,
      isActive: true,
      _count: { select: { triggers: true } },
    },
    orderBy: { slug: "asc" },
  });

  console.log("\n=== All Behavioral/Emotional Specs ===");
  for (const s of finalSpecs) {
    const status = s.isActive ? "✓" : "✗";
    console.log(`${status} ${s.slug} (${s.outputType}, ${s._count.triggers} triggers)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
