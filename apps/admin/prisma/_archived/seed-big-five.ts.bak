/**
 * Seed script for Big Five personality parameters:
 * 1. Add scoring anchors to B5-* parameters
 * 2. Create BDD features for observing each trait
 *
 * Run with: npx tsx prisma/seed-big-five.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Big Five scoring anchors - concrete examples of what each score looks like
const BIG_FIVE_ANCHORS: Record<
  string,
  Array<{
    score: number;
    example: string;
    rationale: string;
    positiveSignals: string[];
    negativeSignals: string[];
    isGold: boolean;
  }>
> = {
  "B5-O": [
    // Openness to Experience
    {
      score: 0.9,
      example:
        "Oh that's fascinating! I've never thought about it that way before. What if we combined that with the approach you mentioned earlier? I'd love to explore some unconventional solutions here.",
      rationale:
        "High curiosity, embraces novel ideas, actively seeks to combine concepts, explicitly interested in unconventional approaches",
      positiveSignals: [
        "asks_exploratory_questions",
        "connects_disparate_ideas",
        "welcomes_novelty",
        "abstract_thinking",
      ],
      negativeSignals: [],
      isGold: true,
    },
    {
      score: 0.7,
      example:
        "That's an interesting idea. I'm open to trying something different if you think it might work better than the standard approach.",
      rationale:
        "Shows openness to alternatives, willing to deviate from standard, but not actively generating novel ideas",
      positiveSignals: ["receptive_to_alternatives", "flexibility"],
      negativeSignals: ["passive_curiosity"],
      isGold: false,
    },
    {
      score: 0.5,
      example:
        "I suppose we could try that. What's the usual way people handle this situation?",
      rationale:
        "Neutral - will consider alternatives but defaults to seeking conventional approaches",
      positiveSignals: ["not_resistant"],
      negativeSignals: ["prefers_conventional", "seeks_norms"],
      isGold: false,
    },
    {
      score: 0.3,
      example:
        "I'd rather stick with what's worked before. Can we just do it the normal way?",
      rationale:
        "Preference for familiar approaches, resistant to novelty, seeks proven methods",
      positiveSignals: [],
      negativeSignals: [
        "resists_novelty",
        "prefers_familiar",
        "dismisses_alternatives",
      ],
      isGold: false,
    },
    {
      score: 0.1,
      example:
        "No, I don't want to experiment with anything new. Just tell me the standard process and I'll follow it exactly.",
      rationale:
        "Strong preference for convention, rejects novel approaches outright, concrete/practical focus only",
      positiveSignals: [],
      negativeSignals: [
        "rigid_conventional",
        "rejects_novelty",
        "concrete_only",
        "rule_following",
      ],
      isGold: true,
    },
  ],

  "B5-C": [
    // Conscientiousness
    {
      score: 0.9,
      example:
        "I've already prepared a list of questions and I've been tracking my progress in a spreadsheet. Can we go through each item systematically? I want to make sure I don't miss anything.",
      rationale:
        "High organization, prepared in advance, systematic approach, explicit tracking, thorough",
      positiveSignals: [
        "prepared",
        "systematic",
        "tracks_progress",
        "thorough",
        "organized",
      ],
      negativeSignals: [],
      isGold: true,
    },
    {
      score: 0.7,
      example:
        "I've got a few things I need to cover today. Let me check my notes... okay, I think the main one is the billing issue from last week.",
      rationale:
        "Has notes/preparation, some organization, but less systematic than high-C",
      positiveSignals: ["has_notes", "some_preparation"],
      negativeSignals: ["less_systematic"],
      isGold: false,
    },
    {
      score: 0.5,
      example:
        "I'm calling about... let me think... I know there was something I needed to sort out. Oh right, my account settings.",
      rationale:
        "Moderate - has purpose but not well-prepared, some mental organization",
      positiveSignals: ["has_purpose"],
      negativeSignals: ["unprepared", "disorganized_recall"],
      isGold: false,
    },
    {
      score: 0.3,
      example:
        "I'm not really sure what I need exactly. Can you just tell me what options I have? I'll figure it out as we go.",
      rationale:
        "Low preparation, spontaneous approach, comfortable with ambiguity, no clear plan",
      positiveSignals: ["flexible"],
      negativeSignals: ["no_preparation", "no_plan", "reactive"],
      isGold: false,
    },
    {
      score: 0.1,
      example:
        "Whatever, I didn't really look at any of that stuff you sent. Can you just handle it for me? I don't want to deal with the details.",
      rationale:
        "Minimal effort, avoids detail work, delegates without engagement, no follow-through",
      positiveSignals: [],
      negativeSignals: [
        "avoids_details",
        "no_effort",
        "disengaged",
        "delegates_completely",
      ],
      isGold: true,
    },
  ],

  "B5-E": [
    // Extraversion
    {
      score: 0.9,
      example:
        "Oh great, I love talking through these things! So let me tell you what happened - it's actually quite a story. And then I was thinking, maybe you could help me figure out the best approach? What do you think?",
      rationale:
        "High energy, enthusiastic, verbose, seeks interaction, shares openly, engages actively",
      positiveSignals: [
        "enthusiastic",
        "verbose",
        "seeks_dialogue",
        "shares_freely",
        "high_energy",
      ],
      negativeSignals: [],
      isGold: true,
    },
    {
      score: 0.7,
      example:
        "Sure, happy to chat about this. I've been meaning to sort it out. So basically what happened was...",
      rationale:
        "Positive, willing to engage, moderately expressive, conversational",
      positiveSignals: ["positive_tone", "willing_to_engage", "conversational"],
      negativeSignals: [],
      isGold: false,
    },
    {
      score: 0.5,
      example: "Yes, I need help with my account. The issue is with billing.",
      rationale:
        "Neutral - functional communication, neither reserved nor expansive",
      positiveSignals: ["clear_communication"],
      negativeSignals: ["minimal_elaboration"],
      isGold: false,
    },
    {
      score: 0.3,
      example: "Billing issue. From last month.",
      rationale:
        "Brief, minimal words, task-focused only, avoids unnecessary interaction",
      positiveSignals: ["efficient"],
      negativeSignals: ["terse", "minimal_engagement", "reserved"],
      isGold: false,
    },
    {
      score: 0.1,
      example: "...[long pause] Yes. ...[pause] Just fix it please.",
      rationale:
        "Very reserved, uncomfortable with interaction, minimal verbal output, prefers silence",
      positiveSignals: [],
      negativeSignals: [
        "very_reserved",
        "uncomfortable",
        "minimal_speech",
        "avoids_interaction",
      ],
      isGold: true,
    },
  ],

  "B5-A": [
    // Agreeableness
    {
      score: 0.9,
      example:
        "I completely understand, these things happen! I'm sure you're doing your best. Thank you so much for helping me with this - I really appreciate your time.",
      rationale:
        "Highly cooperative, empathetic, appreciative, assumes good intent, warm",
      positiveSignals: [
        "empathetic",
        "appreciative",
        "assumes_good_intent",
        "warm",
        "cooperative",
      ],
      negativeSignals: [],
      isGold: true,
    },
    {
      score: 0.7,
      example:
        "That's okay, I understand. Thanks for looking into it for me. Let me know what you find.",
      rationale: "Cooperative, polite, accepting, but less effusively warm",
      positiveSignals: ["polite", "cooperative", "accepting"],
      negativeSignals: [],
      isGold: false,
    },
    {
      score: 0.5,
      example:
        "Alright, I'll wait for you to check. Just let me know what the outcome is.",
      rationale: "Neutral - neither warm nor cold, functional cooperation",
      positiveSignals: ["cooperative"],
      negativeSignals: ["neutral_tone"],
      isGold: false,
    },
    {
      score: 0.3,
      example:
        "Look, I've been waiting for a while already. I expect this to be sorted out properly this time.",
      rationale:
        "Lower warmth, sets expectations firmly, slight impatience, task-over-relationship focus",
      positiveSignals: ["clear_expectations"],
      negativeSignals: ["impatient", "demanding", "low_warmth"],
      isGold: false,
    },
    {
      score: 0.1,
      example:
        "This is ridiculous. I don't care about your excuses. Just get it done or let me speak to someone who can actually help.",
      rationale:
        "Confrontational, dismissive of others' perspective, hostile, uncooperative",
      positiveSignals: [],
      negativeSignals: [
        "confrontational",
        "dismissive",
        "hostile",
        "uncooperative",
        "blaming",
      ],
      isGold: true,
    },
  ],

  "B5-N": [
    // Neuroticism (stress sensitivity)
    {
      score: 0.9,
      example:
        "Oh no, this is really stressing me out. What if it doesn't get fixed? I've been worried about this all week. I just need to know everything is going to be okay.",
      rationale:
        "High anxiety, seeks reassurance, catastrophizes, emotionally reactive to uncertainty",
      positiveSignals: [],
      negativeSignals: [
        "high_anxiety",
        "catastrophizes",
        "seeks_reassurance",
        "emotionally_reactive",
        "worry",
      ],
      isGold: true,
    },
    {
      score: 0.7,
      example:
        "I'm a bit worried about this. It's been on my mind. Can you make sure it gets handled properly?",
      rationale: "Moderate worry, expresses concern, seeks confirmation",
      positiveSignals: [],
      negativeSignals: ["worried", "seeks_confirmation", "concern"],
      isGold: false,
    },
    {
      score: 0.5,
      example:
        "I'd like to get this resolved. It's not urgent but I want to make sure it's sorted.",
      rationale:
        "Neutral - acknowledges issue without emotional charge, matter-of-fact",
      positiveSignals: ["composed"],
      negativeSignals: [],
      isGold: false,
    },
    {
      score: 0.3,
      example:
        "It's fine, these things happen. Just let me know when it's done. No rush.",
      rationale: "Low stress response, accepting, patient, emotionally steady",
      positiveSignals: ["calm", "patient", "accepting", "steady"],
      negativeSignals: [],
      isGold: false,
    },
    {
      score: 0.1,
      example:
        "Whatever happens, happens. I'm not worried about it at all. Just do what you need to do whenever you get to it.",
      rationale:
        "Very low emotional reactivity, unfazed by uncertainty, relaxed about outcomes",
      positiveSignals: [
        "very_calm",
        "unfazed",
        "relaxed",
        "emotionally_stable",
      ],
      negativeSignals: [],
      isGold: true,
    },
  ],
};

// BDD Features for observing Big Five traits in calls
const BIG_FIVE_BDD_FEATURES = [
  {
    slug: "personality-openness",
    name: "Openness to Experience",
    description:
      "Observes caller's curiosity, willingness to explore alternatives, and comfort with abstract/novel ideas. " +
      "High openness shows as intellectual curiosity, creative thinking, and embracing unconventional approaches. " +
      "Low openness shows as preference for conventional methods, concrete thinking, and resistance to novelty.",
    category: "personality",
    priority: 10,
    scenarios: [
      {
        name: "Caller responds to alternative solutions",
        given: "The caller has a problem with multiple possible approaches",
        when: "The rep presents an alternative or unconventional solution",
        then: "Observe how the caller responds to the novel approach",
        criteria: [
          {
            description:
              "Caller shows curiosity about the alternative approach",
            parameterId: "B5-O",
            weight: 1.0,
          },
          {
            description: "Caller asks exploratory follow-up questions",
            parameterId: "B5-O",
            weight: 0.8,
          },
        ],
      },
      {
        name: "Caller discusses abstract concepts",
        given: "The conversation involves explaining a complex concept",
        when: "The rep uses analogies or abstract explanations",
        then: "Observe caller engagement with abstract vs concrete framing",
        criteria: [
          {
            description: "Caller engages with abstract framing positively",
            parameterId: "B5-O",
            weight: 1.0,
          },
        ],
      },
    ],
  },
  {
    slug: "personality-conscientiousness",
    name: "Conscientiousness",
    description:
      "Observes caller's organization, preparation, follow-through, and attention to detail. " +
      "High conscientiousness shows as systematic approach, preparation, tracking, and thoroughness. " +
      "Low conscientiousness shows as spontaneity, comfort with ambiguity, and delegation of details.",
    category: "personality",
    priority: 10,
    scenarios: [
      {
        name: "Caller preparation level",
        given: "The caller initiates a support or service request",
        when: "They describe their issue or needs",
        then: "Observe level of preparation and organization in their approach",
        criteria: [
          {
            description:
              "Caller demonstrates preparation (notes, lists, prior research)",
            parameterId: "B5-C",
            weight: 1.0,
          },
          {
            description: "Caller approaches problem systematically",
            parameterId: "B5-C",
            weight: 0.8,
          },
        ],
      },
      {
        name: "Caller attention to detail",
        given: "The conversation involves multiple steps or details",
        when: "Details and action items are discussed",
        then: "Observe caller engagement with specifics vs high-level only",
        criteria: [
          {
            description:
              "Caller tracks details and confirms understanding of specifics",
            parameterId: "B5-C",
            weight: 1.0,
          },
        ],
      },
    ],
  },
  {
    slug: "personality-extraversion",
    name: "Extraversion",
    description:
      "Observes caller's social energy, verbosity, and interaction style. " +
      "High extraversion shows as enthusiasm, elaboration, seeking dialogue, and high energy. " +
      "Low extraversion shows as brevity, task-focus, and minimal social engagement.",
    category: "personality",
    priority: 10,
    scenarios: [
      {
        name: "Caller communication style",
        given: "The caller is engaged in conversation",
        when: "They describe their situation or respond to questions",
        then: "Observe verbosity, energy level, and social engagement",
        criteria: [
          {
            description:
              "Caller elaborates beyond minimum necessary information",
            parameterId: "B5-E",
            weight: 1.0,
          },
          {
            description: "Caller shows enthusiasm and positive energy",
            parameterId: "B5-E",
            weight: 0.8,
          },
        ],
      },
      {
        name: "Caller social engagement",
        given: "Opportunities for small talk or rapport building arise",
        when: "The rep initiates or responds to social elements",
        then: "Observe caller participation in social/non-task conversation",
        criteria: [
          {
            description: "Caller engages positively with social elements",
            parameterId: "B5-E",
            weight: 1.0,
          },
        ],
      },
    ],
  },
  {
    slug: "personality-agreeableness",
    name: "Agreeableness",
    description:
      "Observes caller's warmth, cooperation, empathy, and conflict style. " +
      "High agreeableness shows as appreciation, assuming good intent, and cooperative tone. " +
      "Low agreeableness shows as skepticism, directness, and challenging approach.",
    category: "personality",
    priority: 10,
    scenarios: [
      {
        name: "Caller response to delays or issues",
        given: "The caller experiences a delay, error, or problem",
        when: "The rep explains the situation or apologizes",
        then: "Observe caller's response - acceptance vs confrontation",
        criteria: [
          {
            description: "Caller shows understanding and patience",
            parameterId: "B5-A",
            weight: 1.0,
          },
          {
            description: "Caller expresses appreciation for rep's efforts",
            parameterId: "B5-A",
            weight: 0.8,
          },
        ],
      },
      {
        name: "Caller cooperation style",
        given: "The conversation requires back-and-forth collaboration",
        when: "The rep asks for information or cooperation",
        then: "Observe caller's cooperative vs challenging stance",
        criteria: [
          {
            description: "Caller cooperates readily and assumes good intent",
            parameterId: "B5-A",
            weight: 1.0,
          },
        ],
      },
    ],
  },
  {
    slug: "personality-neuroticism",
    name: "Neuroticism (Stress Sensitivity)",
    description:
      "Observes caller's emotional reactivity, anxiety level, and stress response. " +
      "High neuroticism shows as worry, seeking reassurance, and emotional volatility. " +
      "Low neuroticism shows as calm, composed, and unfazed by uncertainty.",
    category: "personality",
    priority: 10,
    scenarios: [
      {
        name: "Caller response to uncertainty",
        given: "The situation involves uncertainty or waiting",
        when: "The outcome is not immediately known or guaranteed",
        then: "Observe caller's emotional response to uncertainty",
        criteria: [
          {
            description:
              "Caller expresses worry or anxiety about outcomes (inverse scoring)",
            parameterId: "B5-N",
            weight: 1.0,
          },
          {
            description: "Caller seeks reassurance repeatedly",
            parameterId: "B5-N",
            weight: 0.8,
          },
        ],
      },
      {
        name: "Caller emotional stability",
        given: "The conversation involves a problem or setback",
        when: "Negative news or complications are discussed",
        then: "Observe caller's emotional regulation",
        criteria: [
          {
            description:
              "Caller remains composed vs becomes emotionally reactive",
            parameterId: "B5-N",
            weight: 1.0,
          },
        ],
      },
    ],
  },
];

async function main() {
  console.log("Seeding Big Five personality data...\n");

  // 1. Add scoring anchors to B5-* parameters
  console.log("Adding scoring anchors to B5-* parameters...");

  for (const [parameterId, anchors] of Object.entries(BIG_FIVE_ANCHORS)) {
    // Check if parameter exists
    const param = await prisma.parameter.findUnique({
      where: { parameterId },
    });

    if (!param) {
      console.log(`  ⚠️  Parameter ${parameterId} not found, skipping anchors`);
      continue;
    }

    // Delete existing anchors for this parameter (to allow re-running)
    await prisma.parameterScoringAnchor.deleteMany({
      where: { parameterId },
    });

    // Create new anchors
    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i];
      await prisma.parameterScoringAnchor.create({
        data: {
          parameterId,
          score: anchor.score,
          example: anchor.example,
          rationale: anchor.rationale,
          positiveSignals: anchor.positiveSignals,
          negativeSignals: anchor.negativeSignals,
          isGold: anchor.isGold,
          source: "expert_created",
          sortOrder: i,
        },
      });
    }

    console.log(`  ✓ Added ${anchors.length} anchors to ${parameterId}`);
  }

  // 2. Create BDD Features for Big Five observations
  console.log("\nCreating BDD Features for Big Five observations...");

  for (const feature of BIG_FIVE_BDD_FEATURES) {
    // Check if feature already exists
    const existing = await prisma.bddFeature.findUnique({
      where: { slug: feature.slug },
    });

    if (existing) {
      // Delete and recreate to allow re-running
      await prisma.bddFeature.delete({
        where: { slug: feature.slug },
      });
      console.log(`  ↻ Replacing existing feature: ${feature.slug}`);
    }

    // Create feature with scenarios and criteria
    const created = await prisma.bddFeature.create({
      data: {
        slug: feature.slug,
        name: feature.name,
        description: feature.description,
        category: feature.category,
        priority: feature.priority,
        isActive: true,
        version: "1.0",
        scenarios: {
          create: feature.scenarios.map((s, sIdx) => ({
            name: s.name,
            given: s.given,
            when: s.when,
            then: s.then,
            sortOrder: sIdx,
            criteria: {
              create: s.criteria.map((c, cIdx) => ({
                description: c.description,
                parameterId: c.parameterId,
                weight: c.weight,
                sortOrder: cIdx,
              })),
            },
          })),
        },
      },
      include: {
        scenarios: {
          include: {
            criteria: true,
          },
        },
      },
    });

    const criteriaCount = created.scenarios.reduce(
      (sum, s) => sum + s.criteria.length,
      0
    );
    console.log(
      `  ✓ Created ${feature.name}: ${created.scenarios.length} scenarios, ${criteriaCount} criteria`
    );
  }

  // Summary
  console.log("\n=== Summary ===");
  const anchorCount = await prisma.parameterScoringAnchor.count({
    where: {
      parameterId: { in: Object.keys(BIG_FIVE_ANCHORS) },
    },
  });
  const featureCount = await prisma.bddFeature.count({
    where: { category: "personality" },
  });

  console.log(`Total Big Five anchors: ${anchorCount}`);
  console.log(`Total personality BDD features: ${featureCount}`);
  console.log("\nDone!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
