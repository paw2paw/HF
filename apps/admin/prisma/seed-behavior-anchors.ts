/**
 * Seed script for BEHAVIOR parameter scoring anchors
 *
 * Run with: npx tsx prisma/seed-behavior-anchors.ts
 *
 * Adds scoring anchors to BEHAVIOR parameters so they can be compiled and scored.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Scoring anchors for each BEHAVIOR parameter
const behaviorAnchors: Record<string, Array<{
  score: number;
  example: string;
  rationale: string;
  positiveSignals: string[];
  negativeSignals: string[];
}>> = {
  "BEH-WARMTH": [
    {
      score: 0.9,
      example: "It's so wonderful to hear from you again! I've been thinking about our last conversation and how much progress you've made. How are you feeling today?",
      rationale: "Highly warm - expresses genuine care, references history, asks about wellbeing with enthusiasm",
      positiveSignals: ["enthusiasm", "personal_reference", "care_expression", "history_acknowledgment"],
      negativeSignals: [],
    },
    {
      score: 0.5,
      example: "Hello! Good to connect with you. How can I help you today?",
      rationale: "Moderate warmth - friendly but generic, no personal touch",
      positiveSignals: ["friendly_greeting", "helpful_offer"],
      negativeSignals: ["generic", "impersonal"],
    },
    {
      score: 0.1,
      example: "What do you need?",
      rationale: "Low warmth - abrupt, no greeting, task-focused only",
      positiveSignals: [],
      negativeSignals: ["abrupt", "no_greeting", "cold"],
    },
  ],
  "EXP-BEH-WARMTH": [
    {
      score: 0.9,
      example: "I'm really glad you reached out! I can hear this has been on your mind, and I want you to know I'm here to help you through it.",
      rationale: "Very high warmth - emotional acknowledgment, supportive language, personal connection",
      positiveSignals: ["emotional_acknowledgment", "supportive", "personal_connection"],
      negativeSignals: [],
    },
    {
      score: 0.5,
      example: "Thanks for sharing that. Let me help you work through this.",
      rationale: "Moderate warmth - acknowledges input, offers help, but somewhat neutral tone",
      positiveSignals: ["acknowledgment", "helpful"],
      negativeSignals: ["neutral_tone"],
    },
    {
      score: 0.1,
      example: "Noted. Here's the information you requested.",
      rationale: "Low warmth - purely transactional, no emotional connection",
      positiveSignals: [],
      negativeSignals: ["transactional", "cold", "no_emotion"],
    },
  ],
  "BEH-EMPATHY-RATE": [
    {
      score: 0.9,
      example: "That sounds really frustrating. It's completely understandable that you'd feel overwhelmed given everything you're dealing with. Many people in your situation would feel exactly the same way.",
      rationale: "High empathy - validates feelings, normalizes experience, shows deep understanding",
      positiveSignals: ["feeling_validation", "normalization", "understanding_expression"],
      negativeSignals: [],
    },
    {
      score: 0.5,
      example: "I understand that's difficult. Let's see what we can do about it.",
      rationale: "Moderate empathy - acknowledges difficulty but moves quickly to solutions",
      positiveSignals: ["acknowledgment"],
      negativeSignals: ["quick_pivot", "solution_focused"],
    },
    {
      score: 0.1,
      example: "Here's how to fix that problem.",
      rationale: "Low empathy - jumps straight to solution without acknowledging feelings",
      positiveSignals: [],
      negativeSignals: ["no_acknowledgment", "dismissive", "purely_technical"],
    },
  ],
  "EXP-BEH-EMPATHY": [
    {
      score: 0.9,
      example: "I can really sense how much this matters to you. It takes courage to share something so personal, and I appreciate your trust. Let's take this at whatever pace feels right for you.",
      rationale: "Very high empathy - acknowledges vulnerability, expresses appreciation, offers control",
      positiveSignals: ["vulnerability_acknowledgment", "trust_appreciation", "pace_control"],
      negativeSignals: [],
    },
    {
      score: 0.5,
      example: "I hear you. That's a tough situation to be in.",
      rationale: "Moderate empathy - brief acknowledgment without deep engagement",
      positiveSignals: ["acknowledgment"],
      negativeSignals: ["brief", "surface_level"],
    },
    {
      score: 0.1,
      example: "Okay, moving on to the next topic.",
      rationale: "No empathy - dismisses emotional content entirely",
      positiveSignals: [],
      negativeSignals: ["dismissive", "topic_change", "no_acknowledgment"],
    },
  ],
  "BEH-FORMALITY": [
    {
      score: 0.9,
      example: "Good afternoon. I would be pleased to assist you with your inquiry. Please allow me to review the relevant documentation and provide you with a comprehensive response.",
      rationale: "Very formal - professional language, structured communication, proper address",
      positiveSignals: ["professional_language", "formal_address", "structured"],
      negativeSignals: [],
    },
    {
      score: 0.5,
      example: "Hi there! Happy to help you out with this. Let me take a look and get back to you.",
      rationale: "Moderate formality - friendly but professional, balanced tone",
      positiveSignals: ["friendly", "professional"],
      negativeSignals: [],
    },
    {
      score: 0.1,
      example: "Hey! Yeah, sure thing, let me check that out real quick for ya.",
      rationale: "Very casual - informal language, colloquialisms, relaxed tone",
      positiveSignals: ["casual", "approachable"],
      negativeSignals: ["too_informal", "unprofessional"],
    },
  ],
  "EXP-BEH-FORMAL": [
    {
      score: 0.9,
      example: "I appreciate you bringing this matter to my attention. I shall investigate the circumstances thoroughly and provide you with a detailed assessment at your earliest convenience.",
      rationale: "Highly formal - business language, proper grammar, professional distance",
      positiveSignals: ["business_language", "proper_grammar", "professional"],
      negativeSignals: [],
    },
    {
      score: 0.5,
      example: "Thanks for letting me know about this. I'll look into it and get back to you soon.",
      rationale: "Moderate formality - conversational but respectful",
      positiveSignals: ["conversational", "respectful"],
      negativeSignals: [],
    },
    {
      score: 0.1,
      example: "Got it! Gonna dig into this and hit you back in a bit.",
      rationale: "Very informal - slang, casual phrasing",
      positiveSignals: ["casual", "friendly"],
      negativeSignals: ["slang", "too_casual"],
    },
  ],
  "BEH-DIRECTNESS": [
    {
      score: 0.9,
      example: "The answer is no. This won't work because of X, Y, and Z. Here's what will work instead.",
      rationale: "Very direct - clear answer, concise reasoning, actionable alternative",
      positiveSignals: ["clear_answer", "concise", "actionable"],
      negativeSignals: [],
    },
    {
      score: 0.5,
      example: "That's an interesting approach. There are some considerations to keep in mind, and we might want to explore a few options before deciding.",
      rationale: "Moderate directness - provides input but softens message",
      positiveSignals: ["provides_input", "explores_options"],
      negativeSignals: ["indirect", "hedging"],
    },
    {
      score: 0.1,
      example: "Well, there are many ways to look at this situation, and it really depends on various factors that we might want to consider in the broader context of your overall goals and circumstances...",
      rationale: "Very indirect - avoids clear answer, excessive hedging",
      positiveSignals: [],
      negativeSignals: ["avoids_answer", "excessive_hedging", "verbose"],
    },
  ],
  "MVP-BEH-DIRECTNESS": [
    {
      score: 0.9,
      example: "Do X. Don't do Y. Here's why.",
      rationale: "Maximum directness - imperative statements, clear instruction",
      positiveSignals: ["imperative", "clear", "concise"],
      negativeSignals: [],
    },
    {
      score: 0.5,
      example: "I'd suggest considering X over Y, as it tends to work better in these situations.",
      rationale: "Moderate directness - gives recommendation with softening",
      positiveSignals: ["recommendation", "reasoning"],
      negativeSignals: ["softening"],
    },
    {
      score: 0.1,
      example: "Some people find that one approach works, while others prefer different methods, so it really varies...",
      rationale: "Indirect - no clear recommendation, defers decision",
      positiveSignals: [],
      negativeSignals: ["no_recommendation", "vague", "defers"],
    },
  ],
  "BEH-PROACTIVE": [
    {
      score: 0.9,
      example: "Based on what you've shared, I'd also recommend looking into X because it often comes up as a related issue. And before you run into it, here's how to handle Y.",
      rationale: "Highly proactive - anticipates needs, offers unsolicited helpful information",
      positiveSignals: ["anticipates_needs", "proactive_suggestions", "preventive_advice"],
      negativeSignals: [],
    },
    {
      score: 0.5,
      example: "Here's the answer to your question. Let me know if you have any follow-up questions.",
      rationale: "Moderate proactivity - answers question, invites follow-up but doesn't anticipate",
      positiveSignals: ["answers_question", "invites_followup"],
      negativeSignals: ["reactive_only"],
    },
    {
      score: 0.1,
      example: "Yes.",
      rationale: "Not proactive - minimal response, no additional value",
      positiveSignals: [],
      negativeSignals: ["minimal", "no_elaboration", "purely_reactive"],
    },
  ],
  "EXP-BEH-PROACTIVE": [
    {
      score: 0.9,
      example: "Great question! And while we're on this topic, you might also want to know about A and B, which are closely related. Plus, here's something that might come up later that's worth being aware of now.",
      rationale: "Very proactive - expands scope helpfully, anticipates future needs",
      positiveSignals: ["expands_scope", "anticipates_future", "adds_value"],
      negativeSignals: [],
    },
    {
      score: 0.5,
      example: "Here's the information you asked for. There's also a related topic if you're interested.",
      rationale: "Moderately proactive - offers optional additional info",
      positiveSignals: ["offers_additional", "optional_expansion"],
      negativeSignals: ["passive_offer"],
    },
    {
      score: 0.1,
      example: "The answer is in section 3.2 of the documentation.",
      rationale: "Not proactive - points to source without elaboration",
      positiveSignals: [],
      negativeSignals: ["redirects", "no_elaboration", "minimal_effort"],
    },
  ],
  "BEH-QUESTION-RATE": [
    {
      score: 0.9,
      example: "What specifically are you trying to achieve? When did you first notice this? Have you tried any solutions so far? What constraints are you working with?",
      rationale: "High question rate - multiple diagnostic questions to understand fully",
      positiveSignals: ["multiple_questions", "diagnostic", "thorough"],
      negativeSignals: [],
    },
    {
      score: 0.5,
      example: "Interesting. Can you tell me more about that?",
      rationale: "Moderate question rate - asks for clarification but not deeply probing",
      positiveSignals: ["clarifying", "open_ended"],
      negativeSignals: ["single_question", "surface_level"],
    },
    {
      score: 0.1,
      example: "I see. Here's what you should do.",
      rationale: "Low question rate - assumes understanding, moves to solution",
      positiveSignals: [],
      negativeSignals: ["no_questions", "assumes", "premature_solution"],
    },
  ],
  "BEH-PACE-MATCH": [
    {
      score: 0.9,
      example: "[After receiving a brief, urgent message] Quick answer: Yes, do X. More details if needed.",
      rationale: "Excellent pace matching - mirrors caller's urgency and brevity",
      positiveSignals: ["mirrors_pace", "appropriate_length", "matches_urgency"],
      negativeSignals: [],
    },
    {
      score: 0.5,
      example: "[After receiving a detailed message] Here's a moderately detailed response that covers the main points.",
      rationale: "Moderate pace matching - reasonable response but not perfectly calibrated",
      positiveSignals: ["reasonable_length"],
      negativeSignals: ["not_calibrated"],
    },
    {
      score: 0.1,
      example: "[After receiving a brief message] Let me provide you with a comprehensive overview of all the relevant factors, considerations, and potential approaches...",
      rationale: "Poor pace matching - overwhelming response to brief query",
      positiveSignals: [],
      negativeSignals: ["mismatched_pace", "overwhelming", "ignores_signals"],
    },
  ],
  "EXP-BEH-PACE": [
    {
      score: 0.9,
      example: "Matching your energy! Quick and to the point.",
      rationale: "Excellent pace - matches caller rhythm exactly",
      positiveSignals: ["rhythm_match", "energy_match"],
      negativeSignals: [],
    },
    {
      score: 0.5,
      example: "Taking a measured approach to respond appropriately.",
      rationale: "Moderate pace - neither rushed nor slow",
      positiveSignals: ["measured"],
      negativeSignals: ["generic_pace"],
    },
    {
      score: 0.1,
      example: "Taking my time to thoroughly explain every aspect in great detail...",
      rationale: "Mismatched pace - too slow for context",
      positiveSignals: [],
      negativeSignals: ["too_slow", "mismatched"],
    },
  ],
  "EXP-BEH-DETAIL": [
    {
      score: 0.9,
      example: "Here's a comprehensive breakdown: First, understand that X works by doing A, B, and C. The key mechanism is... [continues with thorough explanation]",
      rationale: "High detail - comprehensive, educational, thorough",
      positiveSignals: ["comprehensive", "thorough", "educational"],
      negativeSignals: [],
    },
    {
      score: 0.5,
      example: "X works by doing A and B. The main thing to know is that it helps with C.",
      rationale: "Moderate detail - covers basics without deep dive",
      positiveSignals: ["covers_basics"],
      negativeSignals: ["surface_level"],
    },
    {
      score: 0.1,
      example: "Use X for that.",
      rationale: "Minimal detail - bare answer with no explanation",
      positiveSignals: [],
      negativeSignals: ["minimal", "no_explanation"],
    },
  ],
  "BEH-RESPONSE-LEN": [
    {
      score: 0.9,
      example: "[A 3-4 paragraph response with examples, context, and next steps]",
      rationale: "Long response - comprehensive coverage",
      positiveSignals: ["comprehensive", "examples", "context"],
      negativeSignals: [],
    },
    {
      score: 0.5,
      example: "Here's a medium-length response that covers the key points without excessive detail.",
      rationale: "Medium response - balanced length",
      positiveSignals: ["balanced"],
      negativeSignals: [],
    },
    {
      score: 0.1,
      example: "Yes.",
      rationale: "Very short response - minimal words",
      positiveSignals: ["concise"],
      negativeSignals: ["too_brief"],
    },
  ],
};

async function main() {
  console.log("\n🎯 Seeding BEHAVIOR parameter scoring anchors...\n");

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const [parameterId, anchors] of Object.entries(behaviorAnchors)) {
    // Check if parameter exists
    const param = await prisma.parameter.findUnique({
      where: { parameterId },
    });

    if (!param) {
      console.log(`   ⚠️  Parameter not found: ${parameterId}`);
      continue;
    }

    // Check existing anchors
    const existingCount = await prisma.parameterScoringAnchor.count({
      where: { parameterId },
    });

    if (existingCount >= 3) {
      console.log(`   ⏭️  ${parameterId} already has ${existingCount} anchors`);
      totalSkipped++;
      continue;
    }

    // Delete existing anchors and recreate
    await prisma.parameterScoringAnchor.deleteMany({
      where: { parameterId },
    });

    // Create new anchors
    for (const anchor of anchors) {
      await prisma.parameterScoringAnchor.create({
        data: {
          parameterId,
          score: anchor.score,
          example: anchor.example,
          rationale: anchor.rationale,
          positiveSignals: anchor.positiveSignals,
          negativeSignals: anchor.negativeSignals,
          isGold: true,
          source: "seed",
        },
      });
    }

    console.log(`   ✓ ${parameterId}: ${anchors.length} anchors`);
    totalCreated++;
  }

  console.log(`\n✅ Done! Created anchors for ${totalCreated} parameters, skipped ${totalSkipped}\n`);

  // Summary
  const paramsWithAnchors = await prisma.parameter.findMany({
    where: { parameterType: "BEHAVIOR" },
    include: {
      _count: { select: { scoringAnchors: true } },
    },
  });

  console.log("BEHAVIOR parameters anchor status:");
  for (const p of paramsWithAnchors) {
    const status = p._count.scoringAnchors >= 3 ? "✓" : "⚠️";
    console.log(`   ${status} ${p.parameterId}: ${p._count.scoringAnchors} anchors`);
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
