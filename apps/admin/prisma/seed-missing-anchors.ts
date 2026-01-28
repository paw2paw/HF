/**
 * MISSING ANCHORS SEED
 *
 * This seed creates scoring anchors for all parameters that:
 * 1. Are referenced by MEASURE or MEASURE_AGENT spec actions
 * 2. Don't already have anchors
 *
 * Run with: npx ts-node --transpile-only prisma/seed-missing-anchors.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Generic anchor templates by parameter type/domain
const anchorTemplates: Record<string, { high: string; mid: string; low: string }> = {
  // Personality traits
  "PERS-OPENNESS": {
    high: "Shows strong intellectual curiosity, embraces novel ideas, discusses abstract concepts with enthusiasm",
    mid: "Demonstrates some interest in new ideas but prefers familiar topics; moderate exploration",
    low: "Prefers routine, avoids abstract discussions, shows resistance to new concepts",
  },
  "PERS-CONSCIENTIOUSNESS": {
    high: "Highly organized, makes detailed plans, follows through on commitments, sets clear goals",
    mid: "Generally organized but occasionally misses details; follows some routines",
    low: "Disorganized, spontaneous, difficulty with planning or following through",
  },
  "PERS-EXTRAVERSION": {
    high: "Energetic, talkative, enthusiastic about social interaction, takes initiative in conversation",
    mid: "Engages socially when prompted but doesn't initiate; balanced energy levels",
    low: "Reserved, prefers to listen, provides brief responses, seems drained by interaction",
  },
  "PERS-AGREEABLENESS": {
    high: "Warm, cooperative, avoids conflict, shows genuine concern for others, accommodating",
    mid: "Generally cooperative but asserts own views; balanced between self and others",
    low: "Competitive, skeptical, challenges others' views, prioritizes own interests",
  },
  "PERS-NEUROTICISM": {
    high: "Shows frequent anxiety, worry, emotional volatility, negative self-talk, stress signals",
    mid: "Occasional stress responses but generally stable; some worry but manages it",
    low: "Calm, emotionally stable, handles stress well, positive outlook",
  },

  // Companion/cognitive parameters
  "COMP-REMINISCENCE": {
    high: "Frequently draws on past experiences, tells stories, connects current topics to personal history",
    mid: "Sometimes references past experiences when relevant; balanced past/present focus",
    low: "Focuses mainly on present, rarely mentions past experiences or stories",
  },
  "COMP-ENGAGEMENT": {
    high: "Deeply engaged, asks follow-up questions, makes connections between topics, shows enthusiasm",
    mid: "Participates when prompted, provides adequate responses, moderate interest",
    low: "Disengaged, brief responses, doesn't elaborate, seems distracted",
  },
  "COMP-DEPTH-PREFERENCE": {
    high: "Seeks deep, meaningful discussions, explores nuances, asks probing questions",
    mid: "Comfortable with moderate depth, can go deeper when led",
    low: "Prefers surface-level conversation, avoids complexity",
  },
  "COMP-ENERGY": {
    high: "High conversational energy, animated, enthusiastic, lively exchanges",
    mid: "Moderate energy, engaged but calm",
    low: "Low energy, subdued, brief responses, seems tired or withdrawn",
  },
  "COMP-MOOD": {
    high: "Positive emotional tone, optimistic, cheerful, expresses happiness",
    mid: "Neutral mood, neither particularly positive nor negative",
    low: "Negative emotional tone, pessimistic, expresses frustration or sadness",
  },

  // Agent behavior parameters
  "BEH-STORY-INVITATION": {
    high: "Agent actively invites stories, asks 'tell me about...', creates space for narratives",
    mid: "Agent occasionally prompts for stories when relevant",
    low: "Agent doesn't invite stories, focuses only on direct Q&A",
  },
  "BEH-EMPATHY-RATE": {
    high: "Agent shows deep empathy, validates emotions, uses reflective statements frequently",
    mid: "Agent acknowledges emotions but doesn't deeply explore them",
    low: "Agent ignores emotional content, responds only to factual aspects",
  },
  "BEH-WARMTH": {
    high: "Agent uses warm, friendly language, personal touches, genuine care",
    mid: "Agent is polite but professional, neither cold nor warm",
    low: "Agent is cold, transactional, impersonal",
  },
  "BEH-DIRECTNESS": {
    high: "Agent provides clear, direct guidance without hedging",
    mid: "Agent balances directness with softening language",
    low: "Agent is vague, hedges frequently, avoids direct statements",
  },
  "BEH-PATIENCE-LEVEL": {
    high: "Agent shows unlimited patience, never rushes, allows long pauses",
    mid: "Agent is patient but moves conversation forward appropriately",
    low: "Agent seems rushed, interrupts, pushes to conclude",
  },

  // Tutor parameters
  "TUTOR-CURIOSITY": {
    high: "Learner asks many follow-up questions, explores beyond the material, shows excitement",
    mid: "Learner asks clarifying questions, moderate interest",
    low: "Learner shows no curiosity, just waits for information",
  },
  "TUTOR-CONFIDENCE": {
    high: "Learner expresses confidence, attempts problems willingly, positive self-talk",
    mid: "Learner cautious but engaged, seeks reassurance occasionally",
    low: "Learner expresses doubt, negative self-talk, reluctant to try",
  },
  "TUTOR-ENGAGEMENT": {
    high: "Learner fully engaged, participates actively, asks questions, takes notes",
    mid: "Learner participates when prompted, moderate attention",
    low: "Learner distracted, minimal responses, not paying attention",
  },
  "TUTOR-COMPREHENSION": {
    high: "Learner demonstrates clear understanding, can apply concepts, explains back correctly",
    mid: "Learner understands basics but struggles with application",
    low: "Learner shows confusion, misconceptions, cannot apply concepts",
  },
  "TUTOR-FRUSTRATION": {
    high: "Learner shows clear frustration signals, negative statements, wants to quit",
    mid: "Learner shows some frustration but continues trying",
    low: "Learner calm and patient, no frustration signals",
  },

  // Default for unknown parameters
  default: {
    high: "Strong positive indicators across relevant dimensions",
    mid: "Moderate indicators, balanced performance",
    low: "Weak indicators, needs improvement",
  },
};

async function main() {
  console.log("=== Creating Missing Scoring Anchors ===\n");

  // Find all MEASURE and MEASURE_AGENT specs
  const specs = await prisma.analysisSpec.findMany({
    where: {
      isActive: true,
      outputType: { in: ["MEASURE", "MEASURE_AGENT"] },
    },
    include: {
      triggers: {
        include: {
          actions: {
            where: { parameterId: { not: null } },
            select: { parameterId: true },
          },
        },
      },
    },
  });

  // Collect all parameter IDs used by these specs
  const parameterIds = new Set<string>();
  for (const spec of specs) {
    for (const trigger of spec.triggers) {
      for (const action of trigger.actions) {
        if (action.parameterId) {
          parameterIds.add(action.parameterId);
        }
      }
    }
  }

  console.log(`Found ${parameterIds.size} parameters used by MEASURE/MEASURE_AGENT specs\n`);

  // Check which parameters have no anchors
  let anchorsCreated = 0;
  let parametersWithAnchors = 0;

  for (const parameterId of parameterIds) {
    const existingAnchors = await prisma.parameterScoringAnchor.count({
      where: { parameterId },
    });

    if (existingAnchors > 0) {
      parametersWithAnchors++;
      console.log(`✓ ${parameterId}: ${existingAnchors} anchors already exist`);
      continue;
    }

    // Get parameter info
    const param = await prisma.parameter.findUnique({
      where: { parameterId },
      select: { name: true, definition: true },
    });

    if (!param) {
      console.log(`⚠ ${parameterId}: Parameter not found in database`);
      continue;
    }

    // Get anchor templates
    const templates = anchorTemplates[parameterId] || anchorTemplates.default;

    // Create 3 anchors: high (0.85), mid (0.50), low (0.20)
    const anchors = [
      {
        parameterId,
        score: 0.85,
        example: templates.high,
        rationale: `High score for ${param.name}: demonstrates strong performance on this dimension`,
        positiveSignals: ["clear indicators", "strong evidence", "consistent pattern"],
        negativeSignals: [],
        isGold: true,
        sortOrder: 0,
      },
      {
        parameterId,
        score: 0.50,
        example: templates.mid,
        rationale: `Mid-range score for ${param.name}: shows moderate/balanced performance`,
        positiveSignals: ["some indicators present"],
        negativeSignals: ["room for improvement"],
        isGold: false,
        sortOrder: 1,
      },
      {
        parameterId,
        score: 0.20,
        example: templates.low,
        rationale: `Low score for ${param.name}: limited evidence of this dimension`,
        positiveSignals: [],
        negativeSignals: ["weak indicators", "absence of expected signals"],
        isGold: false,
        sortOrder: 2,
      },
    ];

    for (const anchor of anchors) {
      await prisma.parameterScoringAnchor.create({
        data: anchor,
      });
      anchorsCreated++;
    }

    console.log(`+ ${parameterId}: Created 3 anchors for "${param.name}"`);
  }

  console.log("\n=== Summary ===");
  console.log(`Parameters already with anchors: ${parametersWithAnchors}`);
  console.log(`Anchors created: ${anchorsCreated}`);
  console.log(`Total parameters processed: ${parameterIds.size}`);

  // Verify
  console.log("\n=== Verification ===");
  const stillMissing = [];
  for (const parameterId of parameterIds) {
    const count = await prisma.parameterScoringAnchor.count({
      where: { parameterId },
    });
    if (count === 0) {
      stillMissing.push(parameterId);
    }
  }

  if (stillMissing.length === 0) {
    console.log("✓ All MEASURE/MEASURE_AGENT spec parameters now have anchors!");
  } else {
    console.log(`⚠ ${stillMissing.length} parameters still missing anchors:`);
    stillMissing.forEach((p) => console.log(`   - ${p}`));
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
