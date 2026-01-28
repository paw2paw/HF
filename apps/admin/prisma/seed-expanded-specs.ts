/**
 * Expanded Analysis Specs Seed
 *
 * Creates a rich set of ~60 analysis specs covering:
 * - Big 5 personality traits (detailed)
 * - Communication style parameters
 * - Emotional intelligence metrics
 * - Engagement and satisfaction measures
 * - Memory extraction (facts, preferences, events, relationships)
 * - Behavior adaptation (deltas, goals)
 * - Agent behavior measurement
 *
 * All specs are marked as compiled and ready to run.
 *
 * Run with: npx tsx prisma/seed-expanded-specs.ts
 */

import { PrismaClient, ParameterType, MemoryCategory, AnalysisOutputType, CompilationStatus } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================================
// EXPANDED PARAMETERS
// ============================================================================

const expandedParameters = [
  // === BIG 5 PERSONALITY (Detailed Sub-facets) ===
  // Openness
  {
    parameterId: "EXP-OPENNESS",
    name: "Openness to Experience",
    definition: "Willingness to try new things, intellectual curiosity, and appreciation for novelty.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEUTRAL",
    interpretationLow: "Prefers routine, concrete, practical",
    interpretationHigh: "Curious, imaginative, open to new ideas",
  },
  {
    parameterId: "EXP-OPENNESS-IDEAS",
    name: "Openness: Intellectual Curiosity",
    definition: "Interest in abstract ideas, philosophies, and intellectual discussion.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEUTRAL",
    interpretationLow: "Practical, concrete thinking",
    interpretationHigh: "Enjoys abstract concepts and theories",
  },
  {
    parameterId: "EXP-OPENNESS-AESTHETICS",
    name: "Openness: Aesthetic Appreciation",
    definition: "Appreciation for art, beauty, and creative expression.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEUTRAL",
    interpretationLow: "Functional, practical focus",
    interpretationHigh: "Values beauty and artistic expression",
  },

  // Conscientiousness
  {
    parameterId: "EXP-CONSCIENT",
    name: "Conscientiousness",
    definition: "Organization, dependability, and self-discipline.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEUTRAL",
    interpretationLow: "Flexible, spontaneous, adaptable",
    interpretationHigh: "Organized, disciplined, methodical",
  },
  {
    parameterId: "EXP-CONSCIENT-ORDER",
    name: "Conscientiousness: Organization",
    definition: "Preference for order, planning, and systematic approaches.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEUTRAL",
    interpretationLow: "Comfortable with ambiguity",
    interpretationHigh: "Needs structure and clear processes",
  },
  {
    parameterId: "EXP-CONSCIENT-ACHIEVE",
    name: "Conscientiousness: Achievement Striving",
    definition: "Drive to accomplish goals and exceed expectations.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEUTRAL",
    interpretationLow: "Relaxed about outcomes",
    interpretationHigh: "Highly driven, goal-focused",
  },

  // Extraversion
  {
    parameterId: "EXP-EXTRAVERSION",
    name: "Extraversion",
    definition: "Sociability, assertiveness, and energy from social interaction.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEUTRAL",
    interpretationLow: "Reserved, reflective, prefers solitude",
    interpretationHigh: "Outgoing, energetic, talkative",
  },
  {
    parameterId: "EXP-EXTRA-WARMTH",
    name: "Extraversion: Interpersonal Warmth",
    definition: "Warmth and friendliness in social interactions.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEUTRAL",
    interpretationLow: "Formal, reserved manner",
    interpretationHigh: "Warm, friendly, personable",
  },
  {
    parameterId: "EXP-EXTRA-ASSERT",
    name: "Extraversion: Assertiveness",
    definition: "Willingness to speak up, take charge, and express opinions.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEUTRAL",
    interpretationLow: "Deferential, follows others",
    interpretationHigh: "Takes charge, voices opinions freely",
  },

  // Agreeableness
  {
    parameterId: "EXP-AGREEABLE",
    name: "Agreeableness",
    definition: "Cooperativeness, trust, and concern for social harmony.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEUTRAL",
    interpretationLow: "Skeptical, competitive, challenging",
    interpretationHigh: "Trusting, cooperative, helpful",
  },
  {
    parameterId: "EXP-AGREE-TRUST",
    name: "Agreeableness: Trust",
    definition: "Tendency to believe others have good intentions.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEUTRAL",
    interpretationLow: "Skeptical, verifies claims",
    interpretationHigh: "Trusting, accepts at face value",
  },
  {
    parameterId: "EXP-AGREE-COOP",
    name: "Agreeableness: Cooperation",
    definition: "Willingness to compromise and work with others.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEUTRAL",
    interpretationLow: "Competitive, firm on position",
    interpretationHigh: "Accommodating, seeks consensus",
  },

  // Neuroticism
  {
    parameterId: "EXP-NEUROTICISM",
    name: "Emotional Stability",
    definition: "Tendency toward emotional stability vs. reactivity.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEUTRAL",
    interpretationLow: "Calm, resilient, even-tempered",
    interpretationHigh: "Sensitive, reactive, prone to worry",
  },
  {
    parameterId: "EXP-NEURO-ANXIETY",
    name: "Anxiety Tendency",
    definition: "Propensity to experience worry and nervousness.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEGATIVE",
    interpretationLow: "Relaxed, unconcerned",
    interpretationHigh: "Worries frequently, anticipates problems",
  },
  {
    parameterId: "EXP-NEURO-STRESS",
    name: "Stress Vulnerability",
    definition: "How easily overwhelmed by pressure or demands.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEGATIVE",
    interpretationLow: "Handles pressure well",
    interpretationHigh: "Easily overwhelmed under stress",
  },

  // === COMMUNICATION STYLE ===
  {
    parameterId: "EXP-COMM-VERBOSE",
    name: "Communication Verbosity",
    definition: "Preference for detailed vs. concise communication.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEUTRAL",
    interpretationLow: "Brief, to-the-point",
    interpretationHigh: "Detailed, thorough explanations",
  },
  {
    parameterId: "EXP-COMM-FORMAL",
    name: "Communication Formality",
    definition: "Preference for formal vs. casual language.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEUTRAL",
    interpretationLow: "Casual, colloquial",
    interpretationHigh: "Formal, professional tone",
  },
  {
    parameterId: "EXP-COMM-TECH",
    name: "Technical Sophistication",
    definition: "Comfort level with technical terminology and concepts.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEUTRAL",
    interpretationLow: "Prefers simple, plain language",
    interpretationHigh: "Comfortable with technical jargon",
  },
  {
    parameterId: "EXP-COMM-PACE",
    name: "Conversation Pace Preference",
    definition: "Preferred speed of information delivery.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEUTRAL",
    interpretationLow: "Slow, methodical discussion",
    interpretationHigh: "Fast-paced, quick exchanges",
  },

  // === EMOTIONAL INTELLIGENCE METRICS ===
  {
    parameterId: "EXP-EI-AWARE",
    name: "Emotional Self-Awareness",
    definition: "Ability to recognize and articulate own emotions.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "POSITIVE",
    interpretationLow: "Difficulty identifying feelings",
    interpretationHigh: "Clear emotional self-understanding",
  },
  {
    parameterId: "EXP-EI-EXPRESS",
    name: "Emotional Expressiveness",
    definition: "Tendency to openly express emotions in conversation.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEUTRAL",
    interpretationLow: "Reserved, stoic expression",
    interpretationHigh: "Openly shares feelings",
  },
  {
    parameterId: "EXP-EI-REGULATE",
    name: "Emotional Regulation",
    definition: "Ability to manage emotional responses appropriately.",
    parameterType: "TRAIT" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "POSITIVE",
    interpretationLow: "Emotions run high, reactive",
    interpretationHigh: "Composed, measured responses",
  },

  // === STATE PARAMETERS (Session-specific) ===
  {
    parameterId: "EXP-STATE-MOOD",
    name: "Current Mood",
    definition: "Caller's apparent emotional state during this call.",
    parameterType: "STATE" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "POSITIVE",
    interpretationLow: "Negative, frustrated, upset",
    interpretationHigh: "Positive, happy, upbeat",
  },
  {
    parameterId: "EXP-STATE-ENERGY",
    name: "Energy Level",
    definition: "Caller's apparent energy and alertness.",
    parameterType: "STATE" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEUTRAL",
    interpretationLow: "Low energy, tired, subdued",
    interpretationHigh: "High energy, alert, animated",
  },
  {
    parameterId: "EXP-STATE-FOCUS",
    name: "Focus Level",
    definition: "How focused and attentive the caller is.",
    parameterType: "STATE" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "POSITIVE",
    interpretationLow: "Distracted, scattered",
    interpretationHigh: "Fully engaged, focused",
  },
  {
    parameterId: "EXP-STATE-URGENCY",
    name: "Urgency Level",
    definition: "How urgent the caller perceives their need.",
    parameterType: "STATE" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "NEUTRAL",
    interpretationLow: "No rush, relaxed timeline",
    interpretationHigh: "Urgent, needs immediate help",
  },
  {
    parameterId: "EXP-STATE-TRUST",
    name: "Trust in Agent",
    definition: "Caller's current trust level with the agent.",
    parameterType: "STATE" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "POSITIVE",
    interpretationLow: "Skeptical, guarded",
    interpretationHigh: "Trusting, open",
  },

  // === ENGAGEMENT METRICS ===
  {
    parameterId: "EXP-ENGAGE-ACTIVE",
    name: "Active Participation",
    definition: "How actively the caller participates in the conversation.",
    parameterType: "STATE" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "POSITIVE",
    interpretationLow: "Passive, reactive only",
    interpretationHigh: "Active, initiating, contributing",
  },
  {
    parameterId: "EXP-ENGAGE-INVEST",
    name: "Investment Level",
    definition: "Emotional and cognitive investment in the conversation.",
    parameterType: "STATE" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "POSITIVE",
    interpretationLow: "Going through motions",
    interpretationHigh: "Deeply invested in outcome",
  },
  {
    parameterId: "EXP-ENGAGE-COLLAB",
    name: "Collaboration Willingness",
    definition: "Willingness to work together toward a solution.",
    parameterType: "STATE" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "POSITIVE",
    interpretationLow: "Expects agent to do everything",
    interpretationHigh: "Actively collaborates",
  },

  // === SATISFACTION METRICS ===
  {
    parameterId: "EXP-SAT-OVERALL",
    name: "Overall Satisfaction",
    definition: "Overall satisfaction with the call experience.",
    parameterType: "STATE" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "POSITIVE",
    interpretationLow: "Dissatisfied with experience",
    interpretationHigh: "Highly satisfied",
  },
  {
    parameterId: "EXP-SAT-RESOLVED",
    name: "Issue Resolution",
    definition: "Degree to which the caller's issue was resolved.",
    parameterType: "STATE" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "POSITIVE",
    interpretationLow: "Issue unresolved",
    interpretationHigh: "Fully resolved",
  },
  {
    parameterId: "EXP-SAT-EFFICIENCY",
    name: "Efficiency Perception",
    definition: "Caller's perception of how efficiently time was used.",
    parameterType: "STATE" as ParameterType,
    computedBy: "MEASURE",
    scaleType: "Percentage",
    directionality: "POSITIVE",
    interpretationLow: "Felt time was wasted",
    interpretationHigh: "Felt time was used well",
  },

  // === ADAPT PARAMETERS (Deltas) ===
  {
    parameterId: "EXP-DELTA-TRUST",
    name: "Trust Change",
    definition: "Change in trust level from previous interaction.",
    parameterType: "ADAPT" as ParameterType,
    computedBy: "ADAPT",
    scaleType: "Delta",
    directionality: "POSITIVE",
    interpretationLow: "Trust decreased",
    interpretationHigh: "Trust increased",
  },
  {
    parameterId: "EXP-DELTA-ENGAGE",
    name: "Engagement Change",
    definition: "Change in engagement from previous interaction.",
    parameterType: "ADAPT" as ParameterType,
    computedBy: "ADAPT",
    scaleType: "Delta",
    directionality: "POSITIVE",
    interpretationLow: "Less engaged than before",
    interpretationHigh: "More engaged than before",
  },
  {
    parameterId: "EXP-DELTA-SAT",
    name: "Satisfaction Change",
    definition: "Change in satisfaction from previous interaction.",
    parameterType: "ADAPT" as ParameterType,
    computedBy: "ADAPT",
    scaleType: "Delta",
    directionality: "POSITIVE",
    interpretationLow: "Less satisfied than before",
    interpretationHigh: "More satisfied than before",
  },

  // === GOAL PARAMETERS ===
  {
    parameterId: "EXP-GOAL-TRUST",
    name: "Trust Goal Progress",
    definition: "Progress toward trust target (0.8).",
    parameterType: "GOAL" as ParameterType,
    computedBy: "GOAL",
    scaleType: "Percentage",
    directionality: "POSITIVE",
    interpretationLow: "Far from target",
    interpretationHigh: "At or exceeding target",
  },
  {
    parameterId: "EXP-GOAL-ENGAGE",
    name: "Engagement Goal Progress",
    definition: "Progress toward engagement target (0.7).",
    parameterType: "GOAL" as ParameterType,
    computedBy: "GOAL",
    scaleType: "Percentage",
    directionality: "POSITIVE",
    interpretationLow: "Far from target",
    interpretationHigh: "At or exceeding target",
  },

  // === BEHAVIOR PARAMETERS (Agent targets) ===
  {
    parameterId: "EXP-BEH-WARMTH",
    name: "Agent Warmth Level",
    definition: "How warm and friendly the agent should be.",
    parameterType: "BEHAVIOR" as ParameterType,
    computedBy: "MEASURE_AGENT",
    scaleType: "Percentage",
    directionality: "ADAPTIVE",
    interpretationLow: "Professional, business-like",
    interpretationHigh: "Very warm, friendly, personable",
  },
  {
    parameterId: "EXP-BEH-PACE",
    name: "Agent Response Pace",
    definition: "How quickly the agent should respond and move through topics.",
    parameterType: "BEHAVIOR" as ParameterType,
    computedBy: "MEASURE_AGENT",
    scaleType: "Percentage",
    directionality: "ADAPTIVE",
    interpretationLow: "Slow, thorough, patient",
    interpretationHigh: "Quick, efficient, rapid",
  },
  {
    parameterId: "EXP-BEH-DETAIL",
    name: "Agent Detail Level",
    definition: "How much detail the agent should provide.",
    parameterType: "BEHAVIOR" as ParameterType,
    computedBy: "MEASURE_AGENT",
    scaleType: "Percentage",
    directionality: "ADAPTIVE",
    interpretationLow: "Brief, summary-level",
    interpretationHigh: "Comprehensive, detailed",
  },
  {
    parameterId: "EXP-BEH-FORMAL",
    name: "Agent Formality Level",
    definition: "How formal the agent's communication should be.",
    parameterType: "BEHAVIOR" as ParameterType,
    computedBy: "MEASURE_AGENT",
    scaleType: "Percentage",
    directionality: "ADAPTIVE",
    interpretationLow: "Casual, conversational",
    interpretationHigh: "Formal, professional",
  },
  {
    parameterId: "EXP-BEH-EMPATHY",
    name: "Agent Empathy Level",
    definition: "How much empathy the agent should express.",
    parameterType: "BEHAVIOR" as ParameterType,
    computedBy: "MEASURE_AGENT",
    scaleType: "Percentage",
    directionality: "ADAPTIVE",
    interpretationLow: "Task-focused, minimal validation",
    interpretationHigh: "Highly empathetic, validates feelings",
  },
  {
    parameterId: "EXP-BEH-PROACTIVE",
    name: "Agent Proactivity Level",
    definition: "How proactively the agent should offer information and suggestions.",
    parameterType: "BEHAVIOR" as ParameterType,
    computedBy: "MEASURE_AGENT",
    scaleType: "Percentage",
    directionality: "ADAPTIVE",
    interpretationLow: "Reactive, answers only what's asked",
    interpretationHigh: "Proactive, anticipates needs",
  },
];

// ============================================================================
// EXPANDED ANALYSIS SPECS
// ============================================================================

const expandedSpecs = [
  // === MEASURE: Big 5 Core ===
  {
    slug: "exp-measure-openness",
    name: "EXP: Measure Openness",
    description: "Score caller's openness to experience from conversation signals.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "personality",
    priority: 10,
    triggers: [{
      name: "Openness Assessment",
      given: "A conversation transcript",
      when: "Analyzing personality signals",
      then: "Score openness (0-1)",
      actions: [{ description: "Score openness based on curiosity, novelty-seeking, abstract thinking.", parameterId: "EXP-OPENNESS", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-openness-ideas",
    name: "EXP: Measure Intellectual Curiosity",
    description: "Score caller's interest in abstract ideas and concepts.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "personality",
    priority: 9,
    triggers: [{
      name: "Intellectual Curiosity Assessment",
      given: "A conversation with abstract topics",
      when: "Analyzing intellectual engagement",
      then: "Score intellectual curiosity (0-1)",
      actions: [{ description: "Score interest in ideas, theories, and philosophical discussion.", parameterId: "EXP-OPENNESS-IDEAS", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-conscient",
    name: "EXP: Measure Conscientiousness",
    description: "Score caller's organization and self-discipline signals.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "personality",
    priority: 10,
    triggers: [{
      name: "Conscientiousness Assessment",
      given: "A conversation transcript",
      when: "Analyzing organization signals",
      then: "Score conscientiousness (0-1)",
      actions: [{ description: "Score based on planning language, follow-through, attention to detail.", parameterId: "EXP-CONSCIENT", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-conscient-order",
    name: "EXP: Measure Organization Preference",
    description: "Score caller's need for structure and order.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "personality",
    priority: 9,
    triggers: [{
      name: "Organization Assessment",
      given: "A conversation showing process preferences",
      when: "Analyzing structure needs",
      then: "Score organization preference (0-1)",
      actions: [{ description: "Score need for clear processes, step-by-step approaches.", parameterId: "EXP-CONSCIENT-ORDER", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-extraversion",
    name: "EXP: Measure Extraversion",
    description: "Score caller's sociability and energy level.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "personality",
    priority: 10,
    triggers: [{
      name: "Extraversion Assessment",
      given: "A conversation transcript",
      when: "Analyzing social energy signals",
      then: "Score extraversion (0-1)",
      actions: [{ description: "Score based on talkativeness, enthusiasm, social engagement.", parameterId: "EXP-EXTRAVERSION", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-extra-warmth",
    name: "EXP: Measure Interpersonal Warmth",
    description: "Score caller's warmth in social interactions.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "personality",
    priority: 9,
    triggers: [{
      name: "Warmth Assessment",
      given: "A conversation with social elements",
      when: "Analyzing interpersonal warmth",
      then: "Score warmth (0-1)",
      actions: [{ description: "Score friendly language, personal sharing, rapport building.", parameterId: "EXP-EXTRA-WARMTH", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-agreeable",
    name: "EXP: Measure Agreeableness",
    description: "Score caller's cooperativeness and trust.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "personality",
    priority: 10,
    triggers: [{
      name: "Agreeableness Assessment",
      given: "A conversation transcript",
      when: "Analyzing cooperation signals",
      then: "Score agreeableness (0-1)",
      actions: [{ description: "Score based on cooperation, trust signals, conflict avoidance.", parameterId: "EXP-AGREEABLE", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-agree-trust",
    name: "EXP: Measure Trust Tendency",
    description: "Score caller's tendency to trust others.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "personality",
    priority: 9,
    triggers: [{
      name: "Trust Assessment",
      given: "A conversation with trust-relevant signals",
      when: "Analyzing trust behavior",
      then: "Score trust tendency (0-1)",
      actions: [{ description: "Score skepticism vs acceptance, verification needs.", parameterId: "EXP-AGREE-TRUST", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-neuroticism",
    name: "EXP: Measure Emotional Stability",
    description: "Score caller's emotional stability vs. reactivity.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "personality",
    priority: 10,
    triggers: [{
      name: "Stability Assessment",
      given: "A conversation transcript",
      when: "Analyzing emotional signals",
      then: "Score emotional stability (0-1)",
      actions: [{ description: "Score based on emotional language, stress responses, worry indicators.", parameterId: "EXP-NEUROTICISM", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-neuro-anxiety",
    name: "EXP: Measure Anxiety Tendency",
    description: "Score caller's propensity to worry.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "personality",
    priority: 9,
    triggers: [{
      name: "Anxiety Assessment",
      given: "A conversation with concern signals",
      when: "Analyzing worry patterns",
      then: "Score anxiety tendency (0-1)",
      actions: [{ description: "Score anticipatory concerns, worst-case thinking, worry language.", parameterId: "EXP-NEURO-ANXIETY", weight: 1.0 }],
    }],
  },

  // === MEASURE: Communication Style ===
  {
    slug: "exp-measure-comm-verbose",
    name: "EXP: Measure Communication Verbosity",
    description: "Score caller's preference for detailed vs. concise communication.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "communication",
    priority: 8,
    triggers: [{
      name: "Verbosity Assessment",
      given: "A conversation transcript",
      when: "Analyzing response patterns",
      then: "Score verbosity preference (0-1)",
      actions: [{ description: "Score based on response length, detail level, explanation requests.", parameterId: "EXP-COMM-VERBOSE", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-comm-formal",
    name: "EXP: Measure Communication Formality",
    description: "Score caller's preference for formal vs. casual language.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "communication",
    priority: 8,
    triggers: [{
      name: "Formality Assessment",
      given: "A conversation transcript",
      when: "Analyzing language style",
      then: "Score formality preference (0-1)",
      actions: [{ description: "Score based on language register, greetings, professional markers.", parameterId: "EXP-COMM-FORMAL", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-comm-tech",
    name: "EXP: Measure Technical Sophistication",
    description: "Score caller's comfort with technical language.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "communication",
    priority: 8,
    triggers: [{
      name: "Tech Level Assessment",
      given: "A conversation with technical elements",
      when: "Analyzing technical comfort",
      then: "Score technical sophistication (0-1)",
      actions: [{ description: "Score based on jargon use, concept grasp, simplification requests.", parameterId: "EXP-COMM-TECH", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-comm-pace",
    name: "EXP: Measure Pace Preference",
    description: "Score caller's preferred conversation pace.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "communication",
    priority: 8,
    triggers: [{
      name: "Pace Assessment",
      given: "A conversation transcript",
      when: "Analyzing conversation tempo",
      then: "Score pace preference (0-1)",
      actions: [{ description: "Score based on response speed expectations, topic switching, patience signals.", parameterId: "EXP-COMM-PACE", weight: 1.0 }],
    }],
  },

  // === MEASURE: Emotional Intelligence ===
  {
    slug: "exp-measure-ei-aware",
    name: "EXP: Measure Emotional Self-Awareness",
    description: "Score caller's ability to recognize own emotions.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "emotional",
    priority: 7,
    triggers: [{
      name: "Self-Awareness Assessment",
      given: "A conversation with emotional content",
      when: "Analyzing emotional articulation",
      then: "Score self-awareness (0-1)",
      actions: [{ description: "Score based on feeling labels, emotional language precision.", parameterId: "EXP-EI-AWARE", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-ei-express",
    name: "EXP: Measure Emotional Expressiveness",
    description: "Score caller's tendency to express emotions.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "emotional",
    priority: 7,
    triggers: [{
      name: "Expressiveness Assessment",
      given: "A conversation transcript",
      when: "Analyzing emotional sharing",
      then: "Score expressiveness (0-1)",
      actions: [{ description: "Score based on emotional disclosure, feeling sharing frequency.", parameterId: "EXP-EI-EXPRESS", weight: 1.0 }],
    }],
  },

  // === MEASURE: State Parameters ===
  {
    slug: "exp-measure-state-mood",
    name: "EXP: Measure Current Mood",
    description: "Score caller's apparent emotional state.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "state",
    priority: 10,
    triggers: [{
      name: "Mood Assessment",
      given: "A conversation transcript",
      when: "Analyzing emotional tone",
      then: "Score mood (0-1)",
      actions: [{ description: "Score based on sentiment, tone markers, emotional language.", parameterId: "EXP-STATE-MOOD", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-state-energy",
    name: "EXP: Measure Energy Level",
    description: "Score caller's apparent energy and alertness.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "state",
    priority: 9,
    triggers: [{
      name: "Energy Assessment",
      given: "A conversation transcript",
      when: "Analyzing energy signals",
      then: "Score energy (0-1)",
      actions: [{ description: "Score based on enthusiasm, response vigor, engagement intensity.", parameterId: "EXP-STATE-ENERGY", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-state-focus",
    name: "EXP: Measure Focus Level",
    description: "Score how focused the caller is.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "state",
    priority: 9,
    triggers: [{
      name: "Focus Assessment",
      given: "A conversation transcript",
      when: "Analyzing attention signals",
      then: "Score focus (0-1)",
      actions: [{ description: "Score based on topic coherence, follow-through, distraction signals.", parameterId: "EXP-STATE-FOCUS", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-state-urgency",
    name: "EXP: Measure Urgency Level",
    description: "Score how urgent the caller perceives their need.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "state",
    priority: 9,
    triggers: [{
      name: "Urgency Assessment",
      given: "A conversation transcript",
      when: "Analyzing urgency signals",
      then: "Score urgency (0-1)",
      actions: [{ description: "Score based on time pressure language, deadline mentions, impatience.", parameterId: "EXP-STATE-URGENCY", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-state-trust",
    name: "EXP: Measure Current Trust",
    description: "Score caller's current trust in the agent.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "state",
    priority: 10,
    triggers: [{
      name: "Trust Assessment",
      given: "A conversation transcript",
      when: "Analyzing trust signals",
      then: "Score trust (0-1)",
      actions: [{ description: "Score based on skepticism, acceptance, verification behavior.", parameterId: "EXP-STATE-TRUST", weight: 1.0 }],
    }],
  },

  // === MEASURE: Engagement ===
  {
    slug: "exp-measure-engage-active",
    name: "EXP: Measure Active Participation",
    description: "Score how actively the caller participates.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "engagement",
    priority: 10,
    triggers: [{
      name: "Participation Assessment",
      given: "A conversation transcript",
      when: "Analyzing participation signals",
      then: "Score active participation (0-1)",
      actions: [{ description: "Score based on questions asked, topics initiated, elaboration.", parameterId: "EXP-ENGAGE-ACTIVE", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-engage-invest",
    name: "EXP: Measure Investment Level",
    description: "Score caller's emotional investment.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "engagement",
    priority: 9,
    triggers: [{
      name: "Investment Assessment",
      given: "A conversation transcript",
      when: "Analyzing investment signals",
      then: "Score investment (0-1)",
      actions: [{ description: "Score based on effort, detail sharing, outcome concern.", parameterId: "EXP-ENGAGE-INVEST", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-engage-collab",
    name: "EXP: Measure Collaboration Willingness",
    description: "Score caller's willingness to collaborate.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "engagement",
    priority: 9,
    triggers: [{
      name: "Collaboration Assessment",
      given: "A conversation transcript",
      when: "Analyzing collaboration signals",
      then: "Score collaboration (0-1)",
      actions: [{ description: "Score based on solution co-creation, suggestion acceptance, partnership language.", parameterId: "EXP-ENGAGE-COLLAB", weight: 1.0 }],
    }],
  },

  // === MEASURE: Satisfaction ===
  {
    slug: "exp-measure-sat-overall",
    name: "EXP: Measure Overall Satisfaction",
    description: "Score caller's overall satisfaction.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "satisfaction",
    priority: 10,
    triggers: [{
      name: "Satisfaction Assessment",
      given: "A completed conversation",
      when: "Analyzing satisfaction signals",
      then: "Score satisfaction (0-1)",
      actions: [{ description: "Score based on thanks, positive feedback, closing tone.", parameterId: "EXP-SAT-OVERALL", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-sat-resolved",
    name: "EXP: Measure Issue Resolution",
    description: "Score how well the issue was resolved.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "satisfaction",
    priority: 10,
    triggers: [{
      name: "Resolution Assessment",
      given: "A completed conversation",
      when: "Analyzing resolution signals",
      then: "Score resolution (0-1)",
      actions: [{ description: "Score based on stated resolution, remaining questions, next steps clarity.", parameterId: "EXP-SAT-RESOLVED", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-sat-efficiency",
    name: "EXP: Measure Efficiency Perception",
    description: "Score caller's perception of time efficiency.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "satisfaction",
    priority: 8,
    triggers: [{
      name: "Efficiency Assessment",
      given: "A completed conversation",
      when: "Analyzing efficiency signals",
      then: "Score efficiency (0-1)",
      actions: [{ description: "Score based on frustration at delays, appreciation for speed, time comments.", parameterId: "EXP-SAT-EFFICIENCY", weight: 1.0 }],
    }],
  },

  // === LEARN: Memory Extraction ===
  {
    slug: "exp-learn-bio-facts",
    name: "EXP: Learn Biographical Facts",
    description: "Extract biographical information about the caller.",
    outputType: "LEARN" as AnalysisOutputType,
    domain: "memory",
    priority: 10,
    triggers: [{
      name: "Bio Extraction",
      given: "A conversation with personal information",
      when: "Caller shares biographical details",
      then: "Extract as persistent memories",
      actions: [
        { description: "Extract name, location, occupation, employer.", learnCategory: "FACT" as MemoryCategory, learnKeyPrefix: "bio_", weight: 1.0 },
      ],
    }],
  },
  {
    slug: "exp-learn-family",
    name: "EXP: Learn Family Information",
    description: "Extract family and relationship information.",
    outputType: "LEARN" as AnalysisOutputType,
    domain: "memory",
    priority: 9,
    triggers: [{
      name: "Family Extraction",
      given: "A conversation mentioning family",
      when: "Caller mentions family members or relationships",
      then: "Extract as relationship memories",
      actions: [
        { description: "Extract family members, pets, significant others.", learnCategory: "RELATIONSHIP" as MemoryCategory, learnKeyPrefix: "family_", weight: 1.0 },
      ],
    }],
  },
  {
    slug: "exp-learn-preferences",
    name: "EXP: Learn Communication Preferences",
    description: "Extract caller's communication preferences.",
    outputType: "LEARN" as AnalysisOutputType,
    domain: "memory",
    priority: 10,
    triggers: [{
      name: "Preference Extraction",
      given: "A conversation showing preferences",
      when: "Caller expresses preferences",
      then: "Extract as preference memories",
      actions: [
        { description: "Extract contact method, timing, style preferences.", learnCategory: "PREFERENCE" as MemoryCategory, learnKeyPrefix: "prefers_", weight: 1.0 },
      ],
    }],
  },
  {
    slug: "exp-learn-events",
    name: "EXP: Learn Upcoming Events",
    description: "Extract time-bound events and plans.",
    outputType: "LEARN" as AnalysisOutputType,
    domain: "memory",
    priority: 9,
    triggers: [{
      name: "Event Extraction",
      given: "A conversation mentioning events",
      when: "Caller mentions future plans or deadlines",
      then: "Extract as event memories",
      actions: [
        { description: "Extract appointments, travel, deadlines, life events.", learnCategory: "EVENT" as MemoryCategory, learnKeyPrefix: "event_", weight: 1.0 },
      ],
    }],
  },
  {
    slug: "exp-learn-context",
    name: "EXP: Learn Current Context",
    description: "Extract current situational context.",
    outputType: "LEARN" as AnalysisOutputType,
    domain: "memory",
    priority: 8,
    triggers: [{
      name: "Context Extraction",
      given: "A conversation with situational info",
      when: "Caller mentions current situation",
      then: "Extract as context memories",
      actions: [
        { description: "Extract traveling, busy period, stress factors.", learnCategory: "CONTEXT" as MemoryCategory, learnKeyPrefix: "context_", weight: 1.0 },
      ],
    }],
  },
  {
    slug: "exp-learn-topics",
    name: "EXP: Learn Topics of Interest",
    description: "Extract topics the caller is interested in.",
    outputType: "LEARN" as AnalysisOutputType,
    domain: "memory",
    priority: 7,
    triggers: [{
      name: "Topic Extraction",
      given: "A conversation with topic signals",
      when: "Caller shows interest in specific topics",
      then: "Extract as topic memories",
      actions: [
        { description: "Extract interests, hobbies, concerns, professional focus.", learnCategory: "TOPIC" as MemoryCategory, learnKeyPrefix: "topic_", weight: 1.0 },
      ],
    }],
  },
  {
    slug: "exp-learn-history",
    name: "EXP: Learn Interaction History",
    description: "Extract past interaction references.",
    outputType: "LEARN" as AnalysisOutputType,
    domain: "memory",
    priority: 6,
    triggers: [{
      name: "History Extraction",
      given: "A conversation referencing past interactions",
      when: "Caller references previous conversations or outcomes",
      then: "Extract as history memories",
      actions: [
        { description: "Extract past issues, resolutions, experiences.", learnCategory: "FACT" as MemoryCategory, learnKeyPrefix: "history_", weight: 1.0 },
      ],
    }],
  },

  // === ADAPT: Delta Calculations ===
  {
    slug: "exp-adapt-trust-delta",
    name: "EXP: Compute Trust Delta",
    description: "Compute change in trust from previous call.",
    outputType: "ADAPT" as AnalysisOutputType,
    domain: "adapt",
    priority: 8,
    triggers: [{
      name: "Trust Delta",
      given: "Current and previous trust scores",
      when: "Both scores available",
      then: "Compute delta",
      actions: [{ description: "Calculate trust change.", parameterId: "EXP-DELTA-TRUST", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-adapt-engage-delta",
    name: "EXP: Compute Engagement Delta",
    description: "Compute change in engagement from previous call.",
    outputType: "ADAPT" as AnalysisOutputType,
    domain: "adapt",
    priority: 8,
    triggers: [{
      name: "Engagement Delta",
      given: "Current and previous engagement scores",
      when: "Both scores available",
      then: "Compute delta",
      actions: [{ description: "Calculate engagement change.", parameterId: "EXP-DELTA-ENGAGE", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-adapt-sat-delta",
    name: "EXP: Compute Satisfaction Delta",
    description: "Compute change in satisfaction from previous call.",
    outputType: "ADAPT" as AnalysisOutputType,
    domain: "adapt",
    priority: 8,
    triggers: [{
      name: "Satisfaction Delta",
      given: "Current and previous satisfaction scores",
      when: "Both scores available",
      then: "Compute delta",
      actions: [{ description: "Calculate satisfaction change.", parameterId: "EXP-DELTA-SAT", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-adapt-trust-goal",
    name: "EXP: Compute Trust Goal Progress",
    description: "Compute progress toward trust target.",
    outputType: "ADAPT" as AnalysisOutputType,
    domain: "adapt",
    priority: 7,
    triggers: [{
      name: "Trust Goal",
      given: "Current trust and target",
      when: "Computing goal progress",
      then: "Store progress",
      actions: [{ description: "Calculate trust goal progress.", parameterId: "EXP-GOAL-TRUST", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-adapt-engage-goal",
    name: "EXP: Compute Engagement Goal Progress",
    description: "Compute progress toward engagement target.",
    outputType: "ADAPT" as AnalysisOutputType,
    domain: "adapt",
    priority: 7,
    triggers: [{
      name: "Engagement Goal",
      given: "Current engagement and target",
      when: "Computing goal progress",
      then: "Store progress",
      actions: [{ description: "Calculate engagement goal progress.", parameterId: "EXP-GOAL-ENGAGE", weight: 1.0 }],
    }],
  },

  // === MEASURE_AGENT: Agent Behavior ===
  {
    slug: "exp-measure-agent-warmth",
    name: "EXP: Measure Agent Warmth",
    description: "Score agent's warmth level.",
    outputType: "MEASURE_AGENT" as AnalysisOutputType,
    domain: "agent-behavior",
    priority: 10,
    triggers: [{
      name: "Agent Warmth Assessment",
      given: "Agent responses in transcript",
      when: "Analyzing agent communication",
      then: "Score warmth (0-1)",
      actions: [{ description: "Score agent warmth from language.", parameterId: "EXP-BEH-WARMTH", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-agent-pace",
    name: "EXP: Measure Agent Response Pace",
    description: "Score agent's conversation pace.",
    outputType: "MEASURE_AGENT" as AnalysisOutputType,
    domain: "agent-behavior",
    priority: 9,
    triggers: [{
      name: "Agent Pace Assessment",
      given: "Agent responses in transcript",
      when: "Analyzing response patterns",
      then: "Score pace (0-1)",
      actions: [{ description: "Score agent pace from response structure.", parameterId: "EXP-BEH-PACE", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-agent-detail",
    name: "EXP: Measure Agent Detail Level",
    description: "Score agent's detail level.",
    outputType: "MEASURE_AGENT" as AnalysisOutputType,
    domain: "agent-behavior",
    priority: 9,
    triggers: [{
      name: "Agent Detail Assessment",
      given: "Agent responses in transcript",
      when: "Analyzing detail level",
      then: "Score detail (0-1)",
      actions: [{ description: "Score agent detail from response content.", parameterId: "EXP-BEH-DETAIL", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-agent-formal",
    name: "EXP: Measure Agent Formality",
    description: "Score agent's formality level.",
    outputType: "MEASURE_AGENT" as AnalysisOutputType,
    domain: "agent-behavior",
    priority: 8,
    triggers: [{
      name: "Agent Formality Assessment",
      given: "Agent responses in transcript",
      when: "Analyzing language register",
      then: "Score formality (0-1)",
      actions: [{ description: "Score agent formality from language.", parameterId: "EXP-BEH-FORMAL", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-agent-empathy",
    name: "EXP: Measure Agent Empathy",
    description: "Score agent's empathy expression.",
    outputType: "MEASURE_AGENT" as AnalysisOutputType,
    domain: "agent-behavior",
    priority: 10,
    triggers: [{
      name: "Agent Empathy Assessment",
      given: "Agent responses in transcript",
      when: "Analyzing empathy markers",
      then: "Score empathy (0-1)",
      actions: [{ description: "Score agent empathy from emotional responses.", parameterId: "EXP-BEH-EMPATHY", weight: 1.0 }],
    }],
  },
  {
    slug: "exp-measure-agent-proactive",
    name: "EXP: Measure Agent Proactivity",
    description: "Score agent's proactivity level.",
    outputType: "MEASURE_AGENT" as AnalysisOutputType,
    domain: "agent-behavior",
    priority: 8,
    triggers: [{
      name: "Agent Proactivity Assessment",
      given: "Agent responses in transcript",
      when: "Analyzing anticipation behavior",
      then: "Score proactivity (0-1)",
      actions: [{ description: "Score agent proactivity from suggestions and anticipation.", parameterId: "EXP-BEH-PROACTIVE", weight: 1.0 }],
    }],
  },
];

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function seedExpandedSpecs() {
  console.log("\n========================================");
  console.log("EXPANDED SPECS SEED");
  console.log("========================================\n");

  // 1. Create parameters
  console.log("1. Creating expanded parameters...");
  for (const param of expandedParameters) {
    await prisma.parameter.upsert({
      where: { parameterId: param.parameterId },
      update: {
        name: param.name,
        definition: param.definition,
        parameterType: param.parameterType,
        scaleType: param.scaleType,
        directionality: param.directionality,
        interpretationLow: param.interpretationLow,
        interpretationHigh: param.interpretationHigh,
      },
      create: {
        ...param,
        sectionId: "EXP",
        domainGroup: param.parameterType,
      },
    });
  }
  console.log(`   Created ${expandedParameters.length} parameters.\n`);

  // 2. Create specs
  console.log("2. Creating expanded analysis specs...");
  const createdSpecIds: string[] = [];

  for (const spec of expandedSpecs) {
    // Delete existing
    const existing = await prisma.analysisSpec.findUnique({ where: { slug: spec.slug } });
    if (existing) {
      await prisma.analysisSpec.delete({ where: { slug: spec.slug } });
    }

    const specRecord = await prisma.analysisSpec.create({
      data: {
        slug: spec.slug,
        name: spec.name,
        description: spec.description,
        outputType: spec.outputType,
        domain: spec.domain,
        priority: spec.priority,
        isActive: true,
        compiledAt: new Date(),
        isDirty: false,
        dirtyReason: null,
        triggers: {
          create: spec.triggers.map((t, tIdx) => ({
            name: t.name,
            given: t.given,
            when: t.when,
            then: t.then,
            sortOrder: tIdx,
            actions: {
              create: t.actions.map((a: any, aIdx: number) => ({
                description: a.description,
                parameterId: a.parameterId || null,
                learnCategory: a.learnCategory || null,
                learnKeyPrefix: a.learnKeyPrefix || null,
                weight: a.weight,
                sortOrder: aIdx,
              })),
            },
          })),
        },
      },
    });
    createdSpecIds.push(specRecord.id);
  }

  const byType = {
    MEASURE: expandedSpecs.filter(s => s.outputType === "MEASURE").length,
    LEARN: expandedSpecs.filter(s => s.outputType === "LEARN").length,
    ADAPT: expandedSpecs.filter(s => s.outputType === "ADAPT").length,
    MEASURE_AGENT: expandedSpecs.filter(s => s.outputType === "MEASURE_AGENT").length,
  };

  console.log(`   Created ${expandedSpecs.length} analysis specs:`);
  console.log(`      ${byType.MEASURE} MEASURE`);
  console.log(`      ${byType.LEARN} LEARN`);
  console.log(`      ${byType.ADAPT} ADAPT`);
  console.log(`      ${byType.MEASURE_AGENT} MEASURE_AGENT`);

  // Summary
  console.log("\n========================================");
  console.log("EXPANDED SPECS SEED COMPLETE");
  console.log("========================================\n");
  console.log(`Total: ${expandedParameters.length} parameters, ${expandedSpecs.length} specs\n`);
}

seedExpandedSpecs()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
