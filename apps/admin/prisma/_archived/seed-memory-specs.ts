/**
 * Seed script for Memory & Continuity Analysis Specs
 *
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-memory-specs.ts
 *
 * Creates LEARN-type analysis specs for extracting and using memories across sessions.
 */

import { PrismaClient, MemoryCategory, AnalysisOutputType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n🧠 Seeding Memory & Continuity Analysis Specs...\n");

  const specs = [
    // ========================================
    // Feature: Personal memory across sessions
    // ========================================
    {
      slug: "memory-personal-across-sessions",
      name: "Personal Memory Across Sessions",
      description:
        "The system remembers the user as a person. When users mention future events, plans, or intentions, the system captures these and naturally references them in subsequent sessions, creating a sense of being remembered as a person rather than starting fresh each time.",
      outputType: "LEARN" as const,
      domain: "memory",
      priority: 10,
      triggers: [
        {
          name: "Future event mentioned",
          given:
            "The user mentioned a future event, plan, or intention in a prior session (e.g., 'I have a job interview next week', 'We're going on vacation in March', 'I'm starting a new project')",
          when: "The next session begins and the timeframe of that event has arrived or passed",
          then:
            "The system naturally asks about that event in a way that feels relevant and human. The reference demonstrates genuine interest and shows the user they are remembered as a person, not just a session.",
          actions: [
            {
              description:
                "Extract future events, plans, and intentions mentioned by the user. Capture: the event/plan, the timeframe (specific date or relative), the emotional context (excited, nervous, hopeful), and any associated people or places.",
              learnCategory: "EVENT" as MemoryCategory,
              learnKeyPrefix: "future_event_",
              learnKeyHint:
                "Create a specific key like 'future_event_job_interview' or 'future_event_vacation_march'. Include the timeframe in the value.",
              weight: 1.0,
            },
            {
              description:
                "Track the user's emotional investment in future events. Note if they express excitement, anxiety, hope, or concern, as this informs how to follow up appropriately.",
              learnCategory: "CONTEXT" as MemoryCategory,
              learnKeyPrefix: "event_sentiment_",
              learnKeyHint:
                "Key should reference the event. Value should capture the emotional tone and any concerns or hopes expressed.",
              weight: 0.8,
            },
          ],
        },
      ],
    },

    // ========================================
    // Feature: Contextual memory retrieval
    // ========================================
    {
      slug: "memory-contextual-retrieval",
      name: "Contextual Memory Retrieval",
      description:
        "Memory is used only when relevant. The system holds information from prior sessions but only references it when directly connected to the current topic, ensuring memory supports conversation flow rather than interrupting it.",
      outputType: "LEARN" as const,
      domain: "memory",
      priority: 9,
      triggers: [
        {
          name: "Topic-relevant memory connection",
          given:
            "The system holds information from prior sessions (facts, preferences, events, relationships)",
          when:
            "The user raises a topic that directly connects to stored memory (e.g., mentions work when we know their job, discusses relationships when we know their family situation)",
          then:
            "Memory is referenced only if it directly supports the current conversation. The reference feels natural and helpful, not like the system is showing off what it knows. Flow remains intact.",
          actions: [
            {
              description:
                "Identify topic clusters and themes the user frequently discusses. This enables recognizing when current topics connect to prior context.",
              learnCategory: "TOPIC" as MemoryCategory,
              learnKeyPrefix: "topic_cluster_",
              learnKeyHint:
                "Group related topics: 'topic_cluster_work', 'topic_cluster_family', 'topic_cluster_health'. Track frequency and recency.",
              weight: 1.0,
            },
            {
              description:
                "Note explicit connections the user makes between topics. When they link work stress to sleep issues, or family dynamics to emotional state, capture these relationships.",
              learnCategory: "CONTEXT" as MemoryCategory,
              learnKeyPrefix: "topic_connection_",
              learnKeyHint:
                "Capture connections like 'topic_connection_work_stress_sleep' with the relationship described in the value.",
              weight: 0.9,
            },
          ],
        },
      ],
    },

    // ========================================
    // Feature: Memory strengthens connection
    // ========================================
    {
      slug: "memory-strengthens-connection",
      name: "Memory Strengthens Connection",
      description:
        "Memory deepens familiarity without disruption. When memory is referenced during a session, it is introduced naturally to strengthen the sense of familiarity while keeping conversation flow intact.",
      outputType: "LEARN" as const,
      domain: "memory",
      priority: 8,
      triggers: [
        {
          name: "Familiarity-building details",
          given: "Memory is being used during a session to personalize the interaction",
          when:
            "The system has an opportunity to reference prior knowledge (shared history, known preferences, past conversations)",
          then:
            "The reference is introduced naturally, strengthening the sense of familiarity. The user feels known without feeling surveilled. Conversation flow remains intact and the interaction feels more human.",
          actions: [
            {
              description:
                "Capture personal details that create a sense of being known: nicknames used, communication style preferences, humor patterns, topics that light them up or shut them down.",
              learnCategory: "PREFERENCE" as MemoryCategory,
              learnKeyPrefix: "personal_style_",
              learnKeyHint:
                "Track 'personal_style_humor' (type of jokes they enjoy), 'personal_style_depth' (prefers deep vs light conversation), 'personal_style_pace' (fast thinker vs deliberate).",
              weight: 1.0,
            },
            {
              description:
                "Note shared experiences and conversation highlights that can be referenced to build continuity. 'Remember when we talked about X?' moments.",
              learnCategory: "EVENT" as MemoryCategory,
              learnKeyPrefix: "shared_moment_",
              learnKeyHint:
                "Capture significant conversation moments: breakthroughs, funny exchanges, emotional sharing. Include what made it meaningful.",
              weight: 0.8,
            },
          ],
        },
      ],
    },

    // ========================================
    // Feature: Legitimate and non-intrusive memory
    // ========================================
    {
      slug: "memory-legitimate-non-intrusive",
      name: "Legitimate and Non-Intrusive Memory",
      description:
        "The user trusts why the system remembers. When the system references past information, it feels legitimate because it was voluntarily shared by the user. Trust is preserved through respectful use of memory.",
      outputType: "LEARN" as const,
      domain: "memory",
      priority: 10,
      triggers: [
        {
          name: "Voluntary disclosure tracking",
          given:
            "The system references past information during conversation",
          when:
            "That information was voluntarily shared by the user (not inferred or assumed)",
          then:
            "The memory reference feels legitimate and respectful. The user understands why the system knows this information. Trust is preserved and potentially strengthened.",
          actions: [
            {
              description:
                "Track the source of information: was it directly stated by the user, inferred from context, or derived from patterns? Only reference information with clear voluntary disclosure.",
              learnCategory: "CONTEXT" as MemoryCategory,
              learnKeyPrefix: "disclosure_source_",
              learnKeyHint:
                "For each key fact, track how we learned it: 'disclosure_source_occupation' = 'directly stated on session 3'.",
              weight: 1.0,
            },
            {
              description:
                "Note what the user seems comfortable discussing vs. topics they skirt around. Respect boundaries in what we remember and reference.",
              learnCategory: "PREFERENCE" as MemoryCategory,
              learnKeyPrefix: "comfort_boundary_",
              learnKeyHint:
                "Track 'comfort_boundary_family' (open/guarded), 'comfort_boundary_health' (shares freely/private). Respect these in memory use.",
              weight: 0.9,
            },
          ],
        },
      ],
    },

    // ========================================
    // Feature: Memory deepens learning and relationship
    // ========================================
    {
      slug: "memory-deepens-learning-relationship",
      name: "Memory Deepens Learning and Relationship",
      description:
        "Memory enriches both content and connection. When the system uses memory during learning moments, it connects content to the user's life, making learning more meaningful while deepening the personal relationship.",
      outputType: "LEARN" as const,
      domain: "memory",
      priority: 9,
      triggers: [
        {
          name: "Learning personalization",
          given: "The system is using memory during a learning or growth moment",
          when:
            "Memory connects new content or insights to the user's specific life situation, experiences, or goals",
          then:
            "Learning becomes more meaningful because it's personalized. The relationship deepens because the system demonstrates understanding of the user's life context. Content sticks better because it's connected to real experiences.",
          actions: [
            {
              description:
                "Capture the user's learning goals, growth areas, and what they're working to understand or improve. This enables connecting new content to their journey.",
              learnCategory: "CONTEXT" as MemoryCategory,
              learnKeyPrefix: "learning_goal_",
              learnKeyHint:
                "Track specific goals: 'learning_goal_communication' (wants to be more assertive), 'learning_goal_career' (transitioning to management). Include why it matters to them.",
              weight: 1.0,
            },
            {
              description:
                "Note real-life examples and stories the user has shared. These become anchors for connecting abstract concepts to their lived experience.",
              learnCategory: "EVENT" as MemoryCategory,
              learnKeyPrefix: "life_example_",
              learnKeyHint:
                "Capture stories they've told: 'life_example_difficult_conversation_boss', 'life_example_parenting_challenge'. These become personalization anchors.",
              weight: 0.9,
            },
            {
              description:
                "Track 'aha moments' and breakthroughs the user has had. These can be referenced to reinforce growth and show continuity in their development.",
              learnCategory: "EVENT" as MemoryCategory,
              learnKeyPrefix: "breakthrough_",
              learnKeyHint:
                "Capture realizations: 'breakthrough_communication_pattern', 'breakthrough_self_awareness'. Include what triggered the insight.",
              weight: 0.8,
            },
          ],
        },
      ],
    },
  ];

  // Insert specs
  for (const spec of specs) {
    try {
      // Check if spec exists
      const existing = await prisma.analysisSpec.findUnique({
        where: { slug: spec.slug },
      });

      if (existing) {
        console.log(`   ⏭️  Skipping existing spec: ${spec.slug}`);
        continue;
      }

      // Create spec with triggers and actions
      await prisma.analysisSpec.create({
        data: {
          slug: spec.slug,
          name: spec.name,
          description: spec.description,
          outputType: spec.outputType as AnalysisOutputType,
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
                  weight: a.weight,
                  learnCategory: a.learnCategory,
                  learnKeyPrefix: a.learnKeyPrefix,
                  learnKeyHint: a.learnKeyHint,
                  sortOrder: aIdx,
                })),
              },
            })),
          },
        },
      });

      console.log(`   ✓ Created spec: ${spec.name}`);
    } catch (error: any) {
      console.error(`   ✗ Error creating spec ${spec.slug}:`, error.message);
    }
  }

  console.log("\n✅ Memory & Continuity specs seeded!\n");

  // Summary
  const count = await prisma.analysisSpec.count({
    where: { domain: "memory" },
  });
  console.log(`   Total memory specs in database: ${count}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
