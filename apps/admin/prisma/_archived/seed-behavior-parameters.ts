/**
 * Seed BEHAVIOR Parameters
 *
 * These are agent-side parameters that define HOW the agent should communicate.
 * Used with BehaviorTarget to set goals and BehaviorMeasurement to track actuals.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const behaviorParameters = [
  // === COMMUNICATION STYLE ===
  {
    parameterId: "BEH-ROLE-SWITCH",
    sectionId: "behavior",
    domainGroup: "communication",
    name: "Role Switch Frequency",
    definition: "How often the agent switches between communication roles (advisor, listener, questioner, empathizer)",
    measurementMvp: "Count role transitions per response, normalize by response count",
    interpretationHigh: "Agent frequently shifts roles - adapts communication style dynamically",
    interpretationLow: "Agent maintains consistent role - stable, predictable communication",
    scaleType: "continuous",
    directionality: "neutral", // Neither high nor low is inherently better
    computedBy: "measure_agent",
  },
  {
    parameterId: "BEH-RESPONSE-LEN",
    sectionId: "behavior",
    domainGroup: "communication",
    name: "Average Response Length",
    definition: "Average word count per agent response, normalized to 0-1 scale (0=very brief, 1=very verbose)",
    measurementMvp: "Calculate mean word count, map to scale using calibrated thresholds",
    interpretationHigh: "Agent provides detailed, comprehensive responses",
    interpretationLow: "Agent keeps responses brief and concise",
    scaleType: "continuous",
    directionality: "neutral",
    computedBy: "measure_agent",
  },
  {
    parameterId: "BEH-FORMALITY",
    sectionId: "behavior",
    domainGroup: "communication",
    name: "Formality Level",
    definition: "Degree of formal vs casual language in agent responses",
    measurementMvp: "Analyze vocabulary, contractions, sentence structure for formality markers",
    interpretationHigh: "Agent uses formal, professional language",
    interpretationLow: "Agent uses casual, conversational language",
    scaleType: "continuous",
    directionality: "neutral",
    computedBy: "measure_agent",
  },

  // === EMPATHY & RAPPORT ===
  {
    parameterId: "BEH-EMPATHY-RATE",
    sectionId: "behavior",
    domainGroup: "empathy",
    name: "Empathy Expression Rate",
    definition: "Frequency of empathetic statements, acknowledgments, and emotional validation",
    measurementMvp: "Count empathy markers (acknowledgments, validation phrases, emotional mirroring) per response",
    interpretationHigh: "Agent frequently expresses empathy and validates emotions",
    interpretationLow: "Agent maintains neutral, task-focused communication",
    scaleType: "continuous",
    directionality: "neutral",
    computedBy: "measure_agent",
  },
  {
    parameterId: "BEH-PERSONALIZATION",
    sectionId: "behavior",
    domainGroup: "empathy",
    name: "Personalization Level",
    definition: "How much the agent references caller-specific information (name, history, preferences)",
    measurementMvp: "Count references to caller's name, past interactions, known facts",
    interpretationHigh: "Agent heavily personalizes responses with caller context",
    interpretationLow: "Agent uses generic, non-personalized responses",
    scaleType: "continuous",
    directionality: "positive", // Generally higher is better
    computedBy: "measure_agent",
  },
  {
    parameterId: "BEH-WARMTH",
    sectionId: "behavior",
    domainGroup: "empathy",
    name: "Warmth Level",
    definition: "Overall warmth and friendliness in agent tone",
    measurementMvp: "Analyze sentiment, greeting quality, closing warmth, word choice",
    interpretationHigh: "Agent is warm, friendly, and approachable",
    interpretationLow: "Agent is neutral or distant in tone",
    scaleType: "continuous",
    directionality: "neutral",
    computedBy: "measure_agent",
  },

  // === ENGAGEMENT STYLE ===
  {
    parameterId: "BEH-QUESTION-RATE",
    sectionId: "behavior",
    domainGroup: "engagement",
    name: "Question Asking Rate",
    definition: "Frequency of questions asked to engage the caller",
    measurementMvp: "Count questions per response, distinguish clarifying vs engagement questions",
    interpretationHigh: "Agent frequently asks questions to engage and understand",
    interpretationLow: "Agent primarily provides statements without questions",
    scaleType: "continuous",
    directionality: "neutral",
    computedBy: "measure_agent",
  },
  {
    parameterId: "BEH-ACTIVE-LISTEN",
    sectionId: "behavior",
    domainGroup: "engagement",
    name: "Active Listening Signals",
    definition: "Frequency of active listening indicators (paraphrasing, summarizing, confirming understanding)",
    measurementMvp: "Count paraphrases, summaries, 'I hear you' type phrases",
    interpretationHigh: "Agent frequently demonstrates active listening",
    interpretationLow: "Agent responds without explicit listening confirmation",
    scaleType: "continuous",
    directionality: "positive",
    computedBy: "measure_agent",
  },
  {
    parameterId: "BEH-PROACTIVE",
    sectionId: "behavior",
    domainGroup: "engagement",
    name: "Proactive Guidance",
    definition: "How proactively the agent offers suggestions, next steps, or additional information",
    measurementMvp: "Count unprompted suggestions, offers of help, next-step guidance",
    interpretationHigh: "Agent proactively guides and suggests",
    interpretationLow: "Agent responds reactively to explicit requests only",
    scaleType: "continuous",
    directionality: "neutral",
    computedBy: "measure_agent",
  },

  // === EFFICIENCY ===
  {
    parameterId: "BEH-DIRECTNESS",
    sectionId: "behavior",
    domainGroup: "efficiency",
    name: "Response Directness",
    definition: "How directly the agent addresses the caller's question or need",
    measurementMvp: "Analyze response structure - is the answer/action at the start or buried?",
    interpretationHigh: "Agent addresses the core need immediately and directly",
    interpretationLow: "Agent provides context/preamble before addressing the need",
    scaleType: "continuous",
    directionality: "neutral",
    computedBy: "measure_agent",
  },
  {
    parameterId: "BEH-CLARITY",
    sectionId: "behavior",
    domainGroup: "efficiency",
    name: "Communication Clarity",
    definition: "How clear and unambiguous the agent's communication is",
    measurementMvp: "Analyze sentence complexity, jargon usage, structure clarity",
    interpretationHigh: "Agent communicates with high clarity - simple, structured, unambiguous",
    interpretationLow: "Agent uses complex language or ambiguous phrasing",
    scaleType: "continuous",
    directionality: "positive",
    computedBy: "measure_agent",
  },

  // === ADAPTABILITY ===
  {
    parameterId: "BEH-MIRROR-STYLE",
    sectionId: "behavior",
    domainGroup: "adaptability",
    name: "Style Mirroring",
    definition: "How much the agent mirrors the caller's communication style (formality, length, tone)",
    measurementMvp: "Compare agent style metrics to caller style metrics, measure convergence",
    interpretationHigh: "Agent closely mirrors caller's communication style",
    interpretationLow: "Agent maintains independent style regardless of caller",
    scaleType: "continuous",
    directionality: "neutral",
    computedBy: "measure_agent",
  },
  {
    parameterId: "BEH-PACE-MATCH",
    sectionId: "behavior",
    domainGroup: "adaptability",
    name: "Pace Matching",
    definition: "How well the agent matches the caller's conversation pace",
    measurementMvp: "Compare response timing, message frequency, information density",
    interpretationHigh: "Agent matches caller's conversational pace",
    interpretationLow: "Agent maintains independent pace",
    scaleType: "continuous",
    directionality: "neutral",
    computedBy: "measure_agent",
  },
];

async function seedBehaviorParameters() {
  console.log("Seeding BEHAVIOR parameters...");

  for (const param of behaviorParameters) {
    await prisma.parameter.upsert({
      where: { parameterId: param.parameterId },
      update: {
        ...param,
        parameterType: "BEHAVIOR",
      },
      create: {
        ...param,
        parameterType: "BEHAVIOR",
      },
    });
    console.log(`  ✓ ${param.parameterId}: ${param.name}`);
  }

  console.log(`\nSeeded ${behaviorParameters.length} BEHAVIOR parameters`);
}

// Run if called directly
seedBehaviorParameters()
  .catch((e) => {
    console.error("Error seeding behavior parameters:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export { seedBehaviorParameters, behaviorParameters };
