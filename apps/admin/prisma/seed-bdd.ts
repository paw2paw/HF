/**
 * Seed script for BDD Features with calibration data
 *
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-bdd.ts
 * Or: npx tsx prisma/seed-bdd.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding BDD Features with calibration data...\n");

  // Check if feature already exists
  const existing = await prisma.bddFeature.findUnique({
    where: { slug: "session-continuity-after-break" },
  });

  if (existing) {
    console.log("Feature 'session-continuity-after-break' already exists. Skipping.");
    return;
  }

  // Create the Session Continuity feature with full calibration data
  const feature = await prisma.bddFeature.create({
    data: {
      slug: "session-continuity-after-break",
      name: "Session Continuity After Break",
      description:
        "Measures how well the AI demonstrates memory and warmth when a caller returns after an absence. " +
        "Critical for building trust and showing the AI remembers past interactions.",
      category: "engagement",
      priority: 10,
      isActive: true,
      version: "1.0",

      scenarios: {
        create: [
          {
            name: "Caller returns after 2+ week break",
            given: "The caller hasn't contacted us in more than 2 weeks",
            when: "They initiate a new conversation",
            then: "The AI should acknowledge the absence warmly and demonstrate memory of previous context",
            sortOrder: 0,

            criteria: {
              create: [
                {
                  description: "Acknowledge absence warmly",
                  scaleType: "continuous",
                  minScore: 0,
                  maxScore: 1,
                  weight: 1.0,
                  sortOrder: 0,

                  anchors: {
                    create: [
                      {
                        score: 0.9,
                        example:
                          "Welcome back! I remember we were discussing your account upgrade options last time. " +
                          "How have things been going?",
                        rationale:
                          "Demonstrates warmth ('Welcome back!') AND memory ('discussing your account upgrade') " +
                          "AND personal interest ('How have things been going?')",
                        positiveSignals: [
                          "references_previous",
                          "warm_greeting",
                          "personal_interest",
                          "specific_memory",
                        ],
                        negativeSignals: [],
                        isGold: true,
                        source: "expert_created",
                        sortOrder: 0,
                      },
                      {
                        score: 0.7,
                        example:
                          "Good to hear from you again! Last time we spoke about your service plan. What can I help with today?",
                        rationale:
                          "Shows warmth and references previous conversation, but less specific memory detail",
                        positiveSignals: ["warm_greeting", "references_previous"],
                        negativeSignals: ["generic_memory"],
                        isGold: false,
                        source: "expert_created",
                        sortOrder: 1,
                      },
                      {
                        score: 0.5,
                        example: "Hi there! It's been a while. How can I help you today?",
                        rationale:
                          "Acknowledges absence ('It's been a while') but shows no memory of previous context",
                        positiveSignals: ["acknowledges_absence"],
                        negativeSignals: ["no_memory_reference", "generic_help_offer"],
                        isGold: false,
                        source: "expert_created",
                        sortOrder: 2,
                      },
                      {
                        score: 0.2,
                        example: "Hello, how can I help you today?",
                        rationale:
                          "Generic greeting with no acknowledgment of absence or previous relationship",
                        positiveSignals: [],
                        negativeSignals: ["generic_greeting", "no_memory_reference", "no_acknowledgment"],
                        isGold: true,
                        source: "expert_created",
                        sortOrder: 3,
                      },
                    ],
                  },
                },
                {
                  description: "Reference previous context or conversation",
                  scaleType: "binary",
                  minScore: 0,
                  maxScore: 1,
                  weight: 0.8,
                  sortOrder: 1,

                  anchors: {
                    create: [
                      {
                        score: 1.0,
                        example:
                          "I see from our last conversation you were interested in the premium tier. " +
                          "Have you had a chance to review the options I sent over?",
                        rationale:
                          "Explicitly references specific previous topic AND follows up on pending action",
                        positiveSignals: [
                          "specific_previous_topic",
                          "follows_up_on_action",
                          "shows_continuity",
                        ],
                        negativeSignals: [],
                        isGold: true,
                        source: "expert_created",
                        sortOrder: 0,
                      },
                      {
                        score: 0.0,
                        example: "How can I assist you today?",
                        rationale: "No reference to any previous interaction or context",
                        positiveSignals: [],
                        negativeSignals: ["no_context_reference", "fresh_start"],
                        isGold: true,
                        source: "expert_created",
                        sortOrder: 1,
                      },
                    ],
                  },
                },
                {
                  description: "Offer to pick up where we left off",
                  scaleType: "binary",
                  minScore: 0,
                  maxScore: 1,
                  weight: 0.6,
                  sortOrder: 2,

                  anchors: {
                    create: [
                      {
                        score: 1.0,
                        example:
                          "Would you like to continue where we left off with the setup, or is there something new I can help with?",
                        rationale:
                          "Explicitly offers continuity as an option while also allowing for new topics",
                        positiveSignals: [
                          "offers_continuity",
                          "respects_choice",
                          "acknowledges_previous_work",
                        ],
                        negativeSignals: [],
                        isGold: true,
                        source: "expert_created",
                        sortOrder: 0,
                      },
                      {
                        score: 0.0,
                        example: "What brings you in today?",
                        rationale: "Treats interaction as entirely fresh with no continuity offered",
                        positiveSignals: [],
                        negativeSignals: ["no_continuity_offer", "fresh_start_assumption"],
                        isGold: false,
                        source: "expert_created",
                        sortOrder: 1,
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            name: "Caller returns same day after disconnect",
            given: "The caller was disconnected earlier today (within 4 hours)",
            when: "They call back",
            then: "The AI should immediately acknowledge the disconnect and resume context",
            sortOrder: 1,

            criteria: {
              create: [
                {
                  description: "Acknowledge the disconnect apologetically",
                  scaleType: "continuous",
                  minScore: 0,
                  maxScore: 1,
                  weight: 1.0,
                  sortOrder: 0,

                  anchors: {
                    create: [
                      {
                        score: 0.95,
                        example:
                          "I'm sorry we got disconnected! I can see we were in the middle of setting up your account. " +
                          "Let me pick up right where we left off - we had just completed step 2.",
                        rationale:
                          "Apologizes, acknowledges disconnect explicitly, references exact context, and offers seamless continuity",
                        positiveSignals: [
                          "apologizes",
                          "acknowledges_disconnect",
                          "specific_context",
                          "seamless_continuity",
                        ],
                        negativeSignals: [],
                        isGold: true,
                        source: "expert_created",
                        sortOrder: 0,
                      },
                      {
                        score: 0.6,
                        example: "Welcome back! Sorry about that. Were we in the middle of something?",
                        rationale:
                          "Apologizes and acknowledges return, but puts burden on caller to provide context",
                        positiveSignals: ["apologizes", "acknowledges_return"],
                        negativeSignals: ["shifts_burden_to_caller", "vague_context"],
                        isGold: false,
                        source: "expert_created",
                        sortOrder: 1,
                      },
                      {
                        score: 0.2,
                        example: "Hello, how can I help you today?",
                        rationale: "No acknowledgment of disconnect or previous conversation",
                        positiveSignals: [],
                        negativeSignals: [
                          "no_acknowledgment",
                          "treats_as_new",
                          "ignores_disconnect",
                        ],
                        isGold: true,
                        source: "expert_created",
                        sortOrder: 2,
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      scenarios: {
        include: {
          criteria: {
            include: {
              anchors: true,
            },
          },
        },
      },
    },
  });

  console.log(`Created BDD Feature: ${feature.name}`);
  console.log(`  - ${feature.scenarios.length} scenarios`);

  let totalCriteria = 0;
  let totalAnchors = 0;
  for (const scenario of feature.scenarios) {
    totalCriteria += scenario.criteria.length;
    for (const criteria of scenario.criteria) {
      totalAnchors += criteria.anchors.length;
    }
  }

  console.log(`  - ${totalCriteria} acceptance criteria`);
  console.log(`  - ${totalAnchors} scoring anchors`);
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
