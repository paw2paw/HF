/**
 * Seed script: Map MVP Trial playbook BDD stories to proper entities
 *
 * This script takes the BDD acceptance criteria from MVP spec configs
 * and creates proper:
 * - AnalysisTrigger records (Given/When/Then)
 * - AnalysisAction records (linking to parameters)
 * - ParameterScoringAnchor records (calibration examples)
 *
 * Run with: npx ts-node prisma/seed-mvp-bdd-mapping.ts
 */

import { PrismaClient, MemoryCategory } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================================
// MVP: Mid-session Cognitive Activation Spec
// ============================================================================

const cognitiveActivationTriggers = [
  {
    name: "AC-1: Cognitive activation cadence",
    given: "The user is mid-session (after topic framing, before completion signal)",
    when: "The system advances the conversation",
    then: "The system introduces at least one cognitively activating prompt every 120-180 seconds",
    actions: [
      {
        description: "Measure timing between cognitive prompts",
        parameterId: "MVP-CONV-PACE",
        weight: 1.0,
      },
      {
        description: "Measure user engagement via substantive contributions",
        parameterId: "MVP-ENGAGE",
        weight: 0.8,
      },
    ],
  },
  {
    name: "AC-2: Prompt quality constraints",
    given: "The system introduces a cognitively activating prompt",
    when: "The user is invited to respond",
    then: "The prompt requires explanation, reflection, imagination, or opinion; is not answerable with yes/no",
    actions: [
      {
        description: "Measure invitational vs directive tone",
        parameterId: "MVP-TONE-ASSERT",
        weight: 1.0,
      },
    ],
  },
  {
    name: "AC-3: Turn-taking constraints",
    given: "The session is mid-session",
    when: "The system communicates",
    then: "System does not deliver >2 consecutive turns without user response; does not deliver explanations >120 words (text) or 40 seconds (voice)",
    actions: [
      {
        description: "Measure system vs user word/turn share",
        parameterId: "MVP-CONV-DOM",
        weight: 1.0,
      },
      {
        description: "Measure turn spacing appropriateness",
        parameterId: "MVP-CONV-PACE",
        weight: 0.7,
      },
    ],
  },
  {
    name: "AC-4: Advancement requires user input",
    given: "The system is about to introduce the next idea or example",
    when: "Advancing content",
    then: "System first asks for user input related to current idea and waits for response before proceeding",
    actions: [
      {
        description: "Measure user participation before topic advancement",
        parameterId: "MVP-CONV-DOM",
        weight: 0.8,
      },
      {
        description: "Measure user engagement at advancement points",
        parameterId: "MVP-ENGAGE",
        weight: 1.0,
      },
    ],
  },
  {
    name: "AC-5: Non-lecture delivery constraint",
    given: "The session is mid-session",
    when: "The system explains concepts",
    then: "Explanations are interleaved with user prompts; each explanation followed by participation opportunity within ≤2 system turns",
    actions: [
      {
        description: "Measure explanation interleaving with user prompts",
        parameterId: "MVP-CONV-DOM",
        weight: 1.0,
      },
      {
        description: "Measure participatory vs dictatorial delivery",
        parameterId: "MVP-TONE-ASSERT",
        weight: 0.9,
      },
    ],
  },
];

// ============================================================================
// MVP: Measure Engagement Level Spec
// ============================================================================

const measureEngagementTriggers = [
  {
    name: "Engagement measurement",
    given: "A transcript is available for analysis",
    when: "Engagement level measurement is requested",
    then: "Calculate weighted engagement score from submetrics: response_rate (0.3), elaboration_score (0.25), follow_up_rate (0.25), latency_score (0.2 if available)",
    actions: [
      {
        description: "Compute engagement from response rate, elaboration, follow-up, and latency submetrics",
        parameterId: "MVP-ENGAGE",
        weight: 1.0,
      },
    ],
  },
];

// ============================================================================
// MVP: Measure Conversation Pace Spec
// ============================================================================

const measurePaceTriggers = [
  {
    name: "Pace measurement",
    given: "A transcript with system prompts is available",
    when: "Conversation pace measurement is requested",
    then: "Calculate mean gap between cognitive prompts; normalize to 0-1 scale (60-300 seconds range)",
    actions: [
      {
        description: "Compute pace score from mean gap between cognitive prompts (normalized 60-300s scale)",
        parameterId: "MVP-CONV-PACE",
        weight: 1.0,
      },
    ],
  },
];

// ============================================================================
// MVP: Measure Assertiveness Spec
// ============================================================================

const measureAssertivenessTriggers = [
  {
    name: "Assertiveness measurement",
    given: "System utterances are available for analysis",
    when: "Assertiveness measurement is requested",
    then: "Calculate weighted score from: directive_ratio (0.4), hedge_inverse (0.3), question_softness_inverse (0.3)",
    actions: [
      {
        description: "Compute assertiveness from directive ratio, hedge density, and question softness",
        parameterId: "MVP-TONE-ASSERT",
        weight: 1.0,
      },
    ],
  },
];

// ============================================================================
// MVP: Measure Conversation Dominance Spec
// ============================================================================

const measureDominanceTriggers = [
  {
    name: "Dominance measurement",
    given: "A full conversation transcript is available",
    when: "Conversation dominance measurement is requested",
    then: "Calculate weighted score from: word_share (0.4), turn_share (0.3), initiative_share (0.3)",
    actions: [
      {
        description: "Compute dominance from system word share, turn share, and initiative share",
        parameterId: "MVP-CONV-DOM",
        weight: 1.0,
      },
    ],
  },
];

// ============================================================================
// Scoring Anchors for MVP Parameters
// ============================================================================

const scoringAnchors = [
  // MVP-ENGAGE anchors
  {
    parameterId: "MVP-ENGAGE",
    score: 0.9,
    isGold: true,
    example: `System: "What aspects of this topic resonate most with your own experience?"
User: "That's a great question. I've actually been thinking about this a lot lately. In my work, I've noticed that when teams focus on collaboration over individual achievement, the outcomes tend to be better. Not just in terms of results, but also in how people feel about the process. I remember one project where we specifically set up cross-functional pairs, and it completely changed the dynamic. People were more willing to share ideas and take risks."`,
    rationale: "High engagement: User provides extended, thoughtful response with personal examples, demonstrates reflection, and builds on the topic with their own insights.",
    positiveSignals: ["extended_response", "personal_example", "reflection", "topic_building"],
    negativeSignals: [],
  },
  {
    parameterId: "MVP-ENGAGE",
    score: 0.65,
    isGold: false,
    example: `System: "How do you see this applying to your situation?"
User: "Yeah, I can see how it might work. We've tried some similar approaches before. The collaboration part makes sense, though I'm not sure about the timing aspect you mentioned."`,
    rationale: "Moderate engagement: User responds substantively but without deep elaboration. Shows some connection to personal context but doesn't fully explore the topic.",
    positiveSignals: ["substantive_response", "personal_connection"],
    negativeSignals: ["limited_elaboration", "hedging"],
  },
  {
    parameterId: "MVP-ENGAGE",
    score: 0.35,
    isGold: false,
    example: `System: "What challenges do you anticipate with this approach?"
User: "I'm not sure. Maybe some?"
System: "Can you think of any specific situations where this might be difficult?"
User: "Not really, I guess it depends."`,
    rationale: "Low engagement: User provides minimal responses, doesn't elaborate even when prompted. Multiple short responses indicate disengagement.",
    positiveSignals: [],
    negativeSignals: ["minimal_response", "no_elaboration", "passive", "requires_multiple_prompts"],
  },

  // MVP-CONV-DOM anchors
  {
    parameterId: "MVP-CONV-DOM",
    score: 0.45,
    isGold: true,
    example: `System: "Let's explore the concept of active listening. What do you notice when someone really listens to you?" (25 words)
User: "I feel like they're actually present. They make eye contact, nod, and sometimes repeat back what I said to confirm understanding." (22 words)
System: "That's a great observation about confirmation. How does that make you feel different from when someone seems distracted?" (18 words)
User: "It's night and day honestly. When someone's distracted, I feel like I'm wasting my time. But with real listening, I feel valued and want to share more." (29 words)`,
    rationale: "Optimal dominance (0.45): System and user have roughly balanced word counts. System turns are concise prompts that invite user expansion. Clear give-and-take pattern.",
    positiveSignals: ["balanced_turns", "concise_prompts", "user_expansion", "dialogue_rhythm"],
    negativeSignals: [],
  },
  {
    parameterId: "MVP-CONV-DOM",
    score: 0.70,
    isGold: false,
    example: `System: "Active listening is a fundamental communication skill that involves fully concentrating on what is being said rather than just passively hearing the message. It includes paying attention, showing that you're listening, providing feedback, deferring judgment, and responding appropriately. Research shows that active listeners tend to have better relationships and are more effective in their communications." (55 words)
User: "Okay." (1 word)
System: "When practicing active listening, there are several techniques you can employ. First, maintain eye contact but don't stare. Second, use nonverbal cues like nodding. Third, ask clarifying questions. Fourth, paraphrase what you've heard. Fifth, avoid interrupting." (38 words)
User: "Got it." (2 words)`,
    rationale: "High dominance (0.70): System delivers long explanatory turns while user provides minimal responses. Lecture-like delivery pattern, not conversational.",
    positiveSignals: [],
    negativeSignals: ["lecture_mode", "monologue", "minimal_user_response", "no_participation_invites"],
  },

  // MVP-CONV-PACE anchors
  {
    parameterId: "MVP-CONV-PACE",
    score: 0.50,
    isGold: true,
    example: `[00:00] System: "Let's start by exploring what brought you to this topic today."
[00:45] User: [45 second response about their interest]
[01:30] System: "That's fascinating context. What specific aspect would you like to dive into first?"
[02:15] User: [45 second elaboration]
[03:00] System: "I'd love to hear your perspective on how this connects to your daily experience."`,
    rationale: "Optimal pace (0.50): Cognitive prompts every ~90-150 seconds. Good rhythm that allows user thinking time without losing momentum.",
    positiveSignals: ["regular_prompts", "thinking_time", "maintained_momentum"],
    negativeSignals: [],
  },
  {
    parameterId: "MVP-CONV-PACE",
    score: 0.20,
    isGold: false,
    example: `[00:00] System: "Let's explore active listening today."
[00:30] User: [Brief response]
[05:00] System: [Long explanation without prompts for 4+ minutes]
[05:30] User: "Okay, I see."
[10:00] System: "So what do you think about all that?"`,
    rationale: "Poor pace (0.20): Gaps exceed 240 seconds between cognitive prompts. User likely disengaged during extended monologue.",
    positiveSignals: [],
    negativeSignals: ["extended_gaps", "long_monologue", "infrequent_prompts"],
  },

  // MVP-TONE-ASSERT anchors
  {
    parameterId: "MVP-TONE-ASSERT",
    score: 0.40,
    isGold: true,
    example: `System: "I'm curious about your experience with this. What aspects stand out to you?"
System: "That's an interesting perspective. How might you see this playing out differently?"
System: "What would it look like if you applied this to your situation?"`,
    rationale: "Optimal assertiveness (0.40): Invitational language, open-ended questions, shows curiosity without directing. Uses 'might', 'curious', and genuine questions.",
    positiveSignals: ["invitational", "open_questions", "curious_tone", "user_agency"],
    negativeSignals: [],
  },
  {
    parameterId: "MVP-TONE-ASSERT",
    score: 0.65,
    isGold: false,
    example: `System: "You need to focus on active listening skills."
System: "You should practice these techniques daily."
System: "The correct approach is to maintain eye contact and nod regularly."`,
    rationale: "High assertiveness (0.65): Directive language ('you need', 'you should'), prescriptive statements, leaves little room for user input or alternative approaches.",
    positiveSignals: [],
    negativeSignals: ["directive_language", "prescriptive", "no_user_agency", "closed_framing"],
  },
  {
    parameterId: "MVP-TONE-ASSERT",
    score: 0.25,
    isGold: false,
    example: `System: "Maybe, perhaps, you might want to sort of consider, I think, possibly looking into this approach? But it's really up to you, I'm not sure..."
System: "It could be that, maybe, some people find this helpful? I don't know for sure though."`,
    rationale: "Low assertiveness (0.25): Excessive hedging ('maybe', 'perhaps', 'sort of', 'possibly'), lacks clarity and confidence. May confuse rather than guide.",
    positiveSignals: [],
    negativeSignals: ["excessive_hedging", "lacks_clarity", "uncertain", "confusing"],
  },
];

// ============================================================================
// Main seeding function
// ============================================================================

async function main() {
  console.log("=== Seeding MVP BDD Mappings ===\n");

  // Get the MVP specs from the playbook
  const specs = await prisma.analysisSpec.findMany({
    where: {
      slug: {
        in: [
          "mvp-story-cognitive-activation",
          "mvp-measure-engagement",
          "mvp-measure-conversation-pace",
          "mvp-measure-assertiveness",
          "mvp-measure-conversation-dominance",
        ],
      },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      _count: { select: { triggers: true } },
    },
  });

  const specMap = new Map(specs.map((s) => [s.slug, s]));

  // Map of spec slugs to their triggers
  const triggersBySpec: Record<string, typeof cognitiveActivationTriggers> = {
    "mvp-story-cognitive-activation": cognitiveActivationTriggers,
    "mvp-measure-engagement": measureEngagementTriggers,
    "mvp-measure-conversation-pace": measurePaceTriggers,
    "mvp-measure-assertiveness": measureAssertivenessTriggers,
    "mvp-measure-conversation-dominance": measureDominanceTriggers,
  };

  // Process each spec
  for (const [slug, triggers] of Object.entries(triggersBySpec)) {
    const spec = specMap.get(slug);
    if (!spec) {
      console.log(`[SKIP] Spec not found: ${slug}`);
      continue;
    }

    console.log(`\n--- ${spec.name} (${spec.slug}) ---`);
    console.log(`  Existing triggers: ${spec._count.triggers}`);

    // Delete existing triggers (cascade will delete actions)
    if (spec._count.triggers > 0) {
      await prisma.analysisTrigger.deleteMany({
        where: { specId: spec.id },
      });
      console.log(`  Deleted ${spec._count.triggers} existing triggers`);
    }

    // Create new triggers with actions
    let triggerCount = 0;
    let actionCount = 0;

    for (let i = 0; i < triggers.length; i++) {
      const t = triggers[i];

      // Verify all parameters exist
      const paramIds = t.actions.map((a) => a.parameterId);
      const existingParams = await prisma.parameter.findMany({
        where: { parameterId: { in: paramIds } },
        select: { parameterId: true },
      });
      const existingParamIds = new Set(existingParams.map((p) => p.parameterId));

      const missingParams = paramIds.filter((id) => !existingParamIds.has(id));
      if (missingParams.length > 0) {
        console.log(`  [WARN] Missing parameters for trigger "${t.name}": ${missingParams.join(", ")}`);
      }

      // Create trigger with actions
      await prisma.analysisTrigger.create({
        data: {
          specId: spec.id,
          name: t.name,
          given: t.given,
          when: t.when,
          then: t.then,
          sortOrder: i,
          actions: {
            create: t.actions
              .filter((a) => existingParamIds.has(a.parameterId))
              .map((a, j) => ({
                description: a.description,
                parameterId: a.parameterId,
                weight: a.weight,
                sortOrder: j,
              })),
          },
        },
      });

      triggerCount++;
      actionCount += t.actions.filter((a) => existingParamIds.has(a.parameterId)).length;
    }

    console.log(`  Created ${triggerCount} triggers with ${actionCount} actions`);
  }

  // Seed scoring anchors
  console.log("\n=== Seeding Scoring Anchors ===\n");

  // Get existing anchor counts
  const existingAnchors = await prisma.parameterScoringAnchor.groupBy({
    by: ["parameterId"],
    where: {
      parameterId: {
        in: scoringAnchors.map((a) => a.parameterId),
      },
    },
    _count: { id: true },
  });
  const anchorCounts = new Map(existingAnchors.map((a) => [a.parameterId, a._count.id]));

  // Verify parameters exist
  const anchorParamIds = [...new Set(scoringAnchors.map((a) => a.parameterId))];
  const existingAnchorParams = await prisma.parameter.findMany({
    where: { parameterId: { in: anchorParamIds } },
    select: { parameterId: true },
  });
  const existingAnchorParamSet = new Set(existingAnchorParams.map((p) => p.parameterId));

  // Delete existing anchors for these parameters
  for (const paramId of anchorParamIds) {
    if (existingAnchorParamSet.has(paramId)) {
      const count = anchorCounts.get(paramId) || 0;
      if (count > 0) {
        await prisma.parameterScoringAnchor.deleteMany({
          where: { parameterId: paramId },
        });
        console.log(`Deleted ${count} existing anchors for ${paramId}`);
      }
    }
  }

  // Create new anchors
  let createdAnchors = 0;
  for (const anchor of scoringAnchors) {
    if (!existingAnchorParamSet.has(anchor.parameterId)) {
      console.log(`[SKIP] Parameter not found: ${anchor.parameterId}`);
      continue;
    }

    await prisma.parameterScoringAnchor.create({
      data: {
        parameterId: anchor.parameterId,
        score: anchor.score,
        isGold: anchor.isGold,
        example: anchor.example,
        rationale: anchor.rationale,
        positiveSignals: anchor.positiveSignals,
        negativeSignals: anchor.negativeSignals,
        source: "seed-mvp-bdd-mapping",
        sortOrder: Math.round(anchor.score * 100), // Sort by score
      },
    });
    createdAnchors++;
  }

  console.log(`\nCreated ${createdAnchors} scoring anchors`);

  // Summary
  console.log("\n=== Summary ===");

  const finalSpecs = await prisma.analysisSpec.findMany({
    where: {
      slug: {
        in: Object.keys(triggersBySpec),
      },
    },
    select: {
      name: true,
      slug: true,
      _count: { select: { triggers: true } },
    },
  });

  for (const spec of finalSpecs) {
    console.log(`${spec.name}: ${spec._count.triggers} triggers`);
  }

  const finalAnchors = await prisma.parameterScoringAnchor.groupBy({
    by: ["parameterId"],
    where: {
      parameterId: { in: anchorParamIds },
    },
    _count: { id: true },
  });

  console.log("\nScoring anchors:");
  for (const a of finalAnchors) {
    console.log(`  ${a.parameterId}: ${a._count.id} anchors`);
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
