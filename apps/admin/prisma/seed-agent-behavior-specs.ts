/**
 * Seed MEASURE_AGENT AnalysisSpecs
 *
 * These specs define how to measure agent behavior from transcripts.
 * Each spec targets a BEHAVIOR parameter and produces BehaviorMeasurement records.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const measureAgentSpecs = [
  // === COMMUNICATION STYLE SPECS ===
  {
    slug: "agent-role-switching",
    name: "Agent Role Switching Analysis",
    description: "Measures how frequently the agent switches between communication roles (advisor, listener, questioner, empathizer) within the conversation.",
    domain: "agent-behavior",
    outputType: "MEASURE_AGENT",
    triggers: [
      {
        given: "A conversation transcript with multiple agent responses",
        when: "Analyzing the agent's communication patterns",
        then: "Identify role transitions and calculate switching frequency",
        actions: [
          {
            description: "Count instances where agent shifts from one role to another (e.g., from giving advice to asking questions, from explaining to empathizing)",
            parameterId: "BEH-ROLE-SWITCH",
            weight: 1.0,
          },
        ],
      },
    ],
  },
  {
    slug: "agent-response-length",
    name: "Agent Response Length Analysis",
    description: "Measures the average length of agent responses, normalized to a 0-1 scale.",
    domain: "agent-behavior",
    outputType: "MEASURE_AGENT",
    triggers: [
      {
        given: "A conversation transcript with agent responses",
        when: "Calculating response metrics",
        then: "Compute average word count and normalize",
        actions: [
          {
            description: "Calculate mean word count per agent response. Map to scale: <20 words = 0.2, 20-50 = 0.4, 50-100 = 0.6, 100-200 = 0.8, >200 = 1.0",
            parameterId: "BEH-RESPONSE-LEN",
            weight: 1.0,
          },
        ],
      },
    ],
  },
  {
    slug: "agent-formality",
    name: "Agent Formality Level Analysis",
    description: "Measures the formality level of agent communication.",
    domain: "agent-behavior",
    outputType: "MEASURE_AGENT",
    triggers: [
      {
        given: "A conversation transcript with agent responses",
        when: "Analyzing language style",
        then: "Score formality based on vocabulary and structure",
        actions: [
          {
            description: "Analyze: contractions (informal), colloquialisms, sentence complexity, professional vocabulary. Score 0 (very casual) to 1 (very formal)",
            parameterId: "BEH-FORMALITY",
            weight: 1.0,
          },
        ],
      },
    ],
  },

  // === EMPATHY SPECS ===
  {
    slug: "agent-empathy-expression",
    name: "Agent Empathy Expression Analysis",
    description: "Measures frequency and quality of empathetic statements from the agent.",
    domain: "agent-behavior",
    outputType: "MEASURE_AGENT",
    triggers: [
      {
        given: "A conversation transcript",
        when: "Analyzing agent emotional intelligence",
        then: "Count and evaluate empathy expressions",
        actions: [
          {
            description: "Count empathy markers: acknowledgment phrases ('I understand', 'That must be'), emotional validation, mirroring feelings. Normalize by response count.",
            parameterId: "BEH-EMPATHY-RATE",
            weight: 1.0,
          },
        ],
      },
    ],
  },
  {
    slug: "agent-personalization",
    name: "Agent Personalization Analysis",
    description: "Measures how much the agent personalizes responses with caller-specific information.",
    domain: "agent-behavior",
    outputType: "MEASURE_AGENT",
    triggers: [
      {
        given: "A conversation transcript with known caller context",
        when: "Analyzing response personalization",
        then: "Score personalization level",
        actions: [
          {
            description: "Count references to: caller's name, past interactions, known preferences, specific situation details. Higher count = higher personalization score.",
            parameterId: "BEH-PERSONALIZATION",
            weight: 1.0,
          },
        ],
      },
    ],
  },
  {
    slug: "agent-warmth",
    name: "Agent Warmth Analysis",
    description: "Measures overall warmth and friendliness in agent communication.",
    domain: "agent-behavior",
    outputType: "MEASURE_AGENT",
    triggers: [
      {
        given: "A conversation transcript",
        when: "Analyzing agent tone",
        then: "Score warmth level",
        actions: [
          {
            description: "Analyze: greeting quality, positive sentiment, friendly closings, encouraging language. Score 0 (cold/distant) to 1 (very warm/friendly)",
            parameterId: "BEH-WARMTH",
            weight: 1.0,
          },
        ],
      },
    ],
  },

  // === ENGAGEMENT SPECS ===
  {
    slug: "agent-question-rate",
    name: "Agent Question Rate Analysis",
    description: "Measures how frequently the agent asks questions.",
    domain: "agent-behavior",
    outputType: "MEASURE_AGENT",
    triggers: [
      {
        given: "A conversation transcript",
        when: "Analyzing engagement patterns",
        then: "Count and categorize questions",
        actions: [
          {
            description: "Count questions per response. Distinguish: clarifying questions, engagement questions, follow-up questions. Normalize by response count.",
            parameterId: "BEH-QUESTION-RATE",
            weight: 1.0,
          },
        ],
      },
    ],
  },
  {
    slug: "agent-active-listening",
    name: "Agent Active Listening Analysis",
    description: "Measures active listening signals from the agent.",
    domain: "agent-behavior",
    outputType: "MEASURE_AGENT",
    triggers: [
      {
        given: "A conversation transcript",
        when: "Analyzing listening behavior",
        then: "Score active listening indicators",
        actions: [
          {
            description: "Count: paraphrasing caller's words, summarizing their points, confirming understanding ('So you're saying...', 'If I understand correctly...')",
            parameterId: "BEH-ACTIVE-LISTEN",
            weight: 1.0,
          },
        ],
      },
    ],
  },
  {
    slug: "agent-proactivity",
    name: "Agent Proactive Guidance Analysis",
    description: "Measures how proactively the agent offers guidance and suggestions.",
    domain: "agent-behavior",
    outputType: "MEASURE_AGENT",
    triggers: [
      {
        given: "A conversation transcript",
        when: "Analyzing guidance patterns",
        then: "Score proactivity level",
        actions: [
          {
            description: "Count unprompted: suggestions, offers of additional help, next-step guidance, anticipatory information. Higher = more proactive.",
            parameterId: "BEH-PROACTIVE",
            weight: 1.0,
          },
        ],
      },
    ],
  },

  // === EFFICIENCY SPECS ===
  {
    slug: "agent-directness",
    name: "Agent Directness Analysis",
    description: "Measures how directly the agent addresses caller needs.",
    domain: "agent-behavior",
    outputType: "MEASURE_AGENT",
    triggers: [
      {
        given: "A conversation transcript",
        when: "Analyzing response structure",
        then: "Score directness",
        actions: [
          {
            description: "Analyze response structure: Is the key answer/action at the start (direct) or buried after preamble (indirect)? Score 0-1.",
            parameterId: "BEH-DIRECTNESS",
            weight: 1.0,
          },
        ],
      },
    ],
  },
  {
    slug: "agent-clarity",
    name: "Agent Communication Clarity Analysis",
    description: "Measures clarity of agent communication.",
    domain: "agent-behavior",
    outputType: "MEASURE_AGENT",
    triggers: [
      {
        given: "A conversation transcript",
        when: "Analyzing communication quality",
        then: "Score clarity",
        actions: [
          {
            description: "Analyze: sentence simplicity, jargon avoidance, logical structure, unambiguous phrasing. Higher = clearer communication.",
            parameterId: "BEH-CLARITY",
            weight: 1.0,
          },
        ],
      },
    ],
  },

  // === ADAPTABILITY SPECS ===
  {
    slug: "agent-style-mirroring",
    name: "Agent Style Mirroring Analysis",
    description: "Measures how well the agent mirrors the caller's communication style.",
    domain: "agent-behavior",
    outputType: "MEASURE_AGENT",
    triggers: [
      {
        given: "A conversation transcript comparing caller and agent styles",
        when: "Analyzing style convergence",
        then: "Score mirroring behavior",
        actions: [
          {
            description: "Compare agent style to caller style: formality match, length match, tone match. Higher = better mirroring.",
            parameterId: "BEH-MIRROR-STYLE",
            weight: 1.0,
          },
        ],
      },
    ],
  },
  {
    slug: "agent-pace-matching",
    name: "Agent Pace Matching Analysis",
    description: "Measures how well the agent matches the caller's conversational pace.",
    domain: "agent-behavior",
    outputType: "MEASURE_AGENT",
    triggers: [
      {
        given: "A conversation transcript",
        when: "Analyzing conversation pacing",
        then: "Score pace matching",
        actions: [
          {
            description: "Compare response timing and information density to caller patterns. Higher = better pace matching.",
            parameterId: "BEH-PACE-MATCH",
            weight: 1.0,
          },
        ],
      },
    ],
  },
];

async function seedAgentBehaviorSpecs() {
  console.log("Seeding MEASURE_AGENT AnalysisSpecs...");

  // Verify parameters exist
  const parameterIds = measureAgentSpecs.flatMap((spec) =>
    spec.triggers.flatMap((t) => t.actions.map((a) => a.parameterId))
  );
  const uniqueParamIds = [...new Set(parameterIds)];

  const existingParams = await prisma.parameter.findMany({
    where: { parameterId: { in: uniqueParamIds } },
    select: { parameterId: true },
  });
  const existingSet = new Set(existingParams.map((p) => p.parameterId));

  const missing = uniqueParamIds.filter((id) => !existingSet.has(id));
  if (missing.length > 0) {
    console.warn(`Warning: Missing parameters: ${missing.join(", ")}`);
  }

  for (const spec of measureAgentSpecs) {
    // Upsert the spec
    const existingSpec = await prisma.analysisSpec.findUnique({
      where: { slug: spec.slug },
    });

    let specRecord;
    if (existingSpec) {
      specRecord = await prisma.analysisSpec.update({
        where: { slug: spec.slug },
        data: {
          name: spec.name,
          description: spec.description,
          domain: spec.domain,
          outputType: spec.outputType as any,
          isActive: true,
        },
      });
      // Delete existing triggers (cascade deletes actions)
      await prisma.analysisTrigger.deleteMany({
        where: { specId: specRecord.id },
      });
    } else {
      specRecord = await prisma.analysisSpec.create({
        data: {
          slug: spec.slug,
          name: spec.name,
          description: spec.description,
          domain: spec.domain,
          outputType: spec.outputType as any,
          isActive: true,
        },
      });
    }

    // Create triggers and actions
    for (let i = 0; i < spec.triggers.length; i++) {
      const trigger = spec.triggers[i];
      const triggerRecord = await prisma.analysisTrigger.create({
        data: {
          specId: specRecord.id,
          given: trigger.given,
          when: trigger.when,
          then: trigger.then,
          sortOrder: i,
        },
      });

      for (let j = 0; j < trigger.actions.length; j++) {
        const action = trigger.actions[j];
        await prisma.analysisAction.create({
          data: {
            triggerId: triggerRecord.id,
            description: action.description,
            parameterId: existingSet.has(action.parameterId) ? action.parameterId : null,
            weight: action.weight,
            sortOrder: j,
          },
        });
      }
    }

    console.log(`  ✓ ${spec.slug}: ${spec.name}`);
  }

  console.log(`\nSeeded ${measureAgentSpecs.length} MEASURE_AGENT AnalysisSpecs`);
}

// Run if called directly
seedAgentBehaviorSpecs()
  .catch((e) => {
    console.error("Error seeding agent behavior specs:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export { seedAgentBehaviorSpecs, measureAgentSpecs };
