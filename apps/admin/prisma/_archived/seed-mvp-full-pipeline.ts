/**
 * MVP Full Pipeline Seed
 *
 * Creates a complete end-to-end analysis pipeline with:
 * - MEASURE specs (score caller traits from transcript)
 * - LEARN specs (extract memories about caller)
 * - ADAPT specs (compute deltas and goal progress)
 * - MEASURE_AGENT specs (score agent behavior)
 * - REWARD specs (evaluate call outcomes)
 *
 * All items are prefixed with "MVP:" for easy identification.
 *
 * Run with: npx tsx prisma/seed-mvp-full-pipeline.ts
 */

import { PrismaClient, ParameterType, MemoryCategory, AnalysisOutputType, BehaviorTargetScope, BehaviorTargetSource, CompilationStatus } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================================
// MVP TAGS
// ============================================================================
const MVP_TAG = {
  id: "mvp-pipeline-tag",
  name: "MVP-Pipeline",
  slug: "mvp-pipeline",
  tone: "brand",
};

// ============================================================================
// MVP PARAMETERS
// ============================================================================
// These are the parameters we'll measure, learn from, and adapt

const mvpParameters = [
  // === TRAIT Parameters (stable over time) ===
  {
    parameterId: "MVP-ENGAGEMENT",
    sectionId: "MVP",
    domainGroup: "Caller State",
    name: "MVP: Engagement Level",
    definition: "How engaged and invested the caller is in the conversation. High engagement shows active participation, follow-up questions, and emotional investment.",
    measurementMvp: "Score 0-1 based on participation signals",
    interpretationHigh: "Highly engaged, asking questions, invested",
    interpretationLow: "Disengaged, passive, minimal participation",
    scaleType: "Percentage",
    directionality: "POSITIVE",
    computedBy: "MEASURE",
    parameterType: "STATE" as ParameterType,
  },
  {
    parameterId: "MVP-RAPPORT",
    sectionId: "MVP",
    domainGroup: "Relationship",
    name: "MVP: Rapport Level",
    definition: "The quality of connection and trust between caller and agent. High rapport shows comfort, openness, and mutual understanding.",
    measurementMvp: "Score 0-1 based on relationship signals",
    interpretationHigh: "Strong connection, open sharing, trust",
    interpretationLow: "Distant, guarded, transactional only",
    scaleType: "Percentage",
    directionality: "POSITIVE",
    computedBy: "MEASURE",
    parameterType: "TRAIT" as ParameterType,
  },
  {
    parameterId: "MVP-SATISFACTION",
    sectionId: "MVP",
    domainGroup: "Outcome",
    name: "MVP: Call Satisfaction",
    definition: "Caller's apparent satisfaction with the interaction. Inferred from tone, explicit feedback, and resolution signals.",
    measurementMvp: "Score 0-1 based on satisfaction indicators",
    interpretationHigh: "Very satisfied, positive feedback",
    interpretationLow: "Dissatisfied, frustrated, unresolved",
    scaleType: "Percentage",
    directionality: "POSITIVE",
    computedBy: "MEASURE",
    parameterType: "STATE" as ParameterType,
  },

  // === ADAPT Parameters (deltas between calls) ===
  {
    parameterId: "MVP-ENGAGEMENT-DELTA",
    sectionId: "MVP",
    domainGroup: "Caller State",
    name: "MVP: Engagement Change",
    definition: "Change in engagement from the previous call to this call. Positive means more engaged, negative means less engaged.",
    measurementMvp: "Computed from MVP-ENGAGEMENT delta",
    interpretationHigh: "Engagement improved significantly",
    interpretationLow: "Engagement declined",
    scaleType: "Delta",
    directionality: "POSITIVE",
    computedBy: "ADAPT",
    parameterType: "ADAPT" as ParameterType,
    baseParameterId: "MVP-ENGAGEMENT",
  },
  {
    parameterId: "MVP-RAPPORT-DELTA",
    sectionId: "MVP",
    domainGroup: "Relationship",
    name: "MVP: Rapport Change",
    definition: "Change in rapport level from previous interactions. Tracks relationship building over time.",
    measurementMvp: "Computed from MVP-RAPPORT delta",
    interpretationHigh: "Relationship strengthening",
    interpretationLow: "Relationship weakening",
    scaleType: "Delta",
    directionality: "POSITIVE",
    computedBy: "ADAPT",
    parameterType: "ADAPT" as ParameterType,
    baseParameterId: "MVP-RAPPORT",
  },

  // === GOAL Parameters (progress toward targets) ===
  {
    parameterId: "MVP-RAPPORT-GOAL",
    sectionId: "MVP",
    domainGroup: "Relationship",
    name: "MVP: Rapport Goal Progress",
    definition: "Progress toward achieving target rapport level (0.8) with this caller.",
    measurementMvp: "Current / Target ratio",
    interpretationHigh: "On track or exceeding goal",
    interpretationLow: "Below target, needs attention",
    scaleType: "Percentage",
    directionality: "POSITIVE",
    computedBy: "GOAL",
    parameterType: "GOAL" as ParameterType,
    goalTarget: 0.8,
    goalWindow: 5,
  },

  // === BEHAVIOR Parameters (agent communication targets) ===
  {
    parameterId: "MVP-BEH-WARMTH",
    sectionId: "MVP",
    domainGroup: "Agent Behavior",
    name: "MVP: Agent Warmth",
    definition: "How warm and friendly the agent's communication style is. Target adapts based on caller preferences and outcomes.",
    measurementMvp: "Score 0-1 from transcript analysis",
    interpretationHigh: "Very warm, friendly, personable",
    interpretationLow: "Cool, professional, distant",
    scaleType: "Percentage",
    directionality: "ADAPTIVE",
    computedBy: "MEASURE_AGENT",
    parameterType: "BEHAVIOR" as ParameterType,
  },
  {
    parameterId: "MVP-BEH-DIRECTNESS",
    sectionId: "MVP",
    domainGroup: "Agent Behavior",
    name: "MVP: Agent Directness",
    definition: "How directly the agent addresses questions and needs. Some callers prefer direct answers, others prefer exploration.",
    measurementMvp: "Score 0-1 from response structure",
    interpretationHigh: "Very direct, answers first",
    interpretationLow: "Exploratory, builds context first",
    scaleType: "Percentage",
    directionality: "ADAPTIVE",
    computedBy: "MEASURE_AGENT",
    parameterType: "BEHAVIOR" as ParameterType,
  },
  {
    parameterId: "MVP-BEH-EMPATHY",
    sectionId: "MVP",
    domainGroup: "Agent Behavior",
    name: "MVP: Agent Empathy Expression",
    definition: "Frequency and quality of empathetic responses from the agent. Validates emotions and shows understanding.",
    measurementMvp: "Score 0-1 based on empathy markers",
    interpretationHigh: "Highly empathetic, validates feelings",
    interpretationLow: "Task-focused, minimal emotional acknowledgment",
    scaleType: "Percentage",
    directionality: "ADAPTIVE",
    computedBy: "MEASURE_AGENT",
    parameterType: "BEHAVIOR" as ParameterType,
  },
];

// ============================================================================
// MVP SCORING ANCHORS
// ============================================================================
// Calibration examples that define what scores mean

const mvpScoringAnchors = [
  // Engagement anchors
  {
    parameterId: "MVP-ENGAGEMENT",
    anchors: [
      {
        score: 0.2,
        example: "Agent: How can I help today?\nCaller: Uh huh.\nAgent: Would you like to discuss your account?\nCaller: I guess.\nAgent: Any specific concerns?\nCaller: Not really.",
        rationale: "Minimal participation, one-word answers, no questions or elaboration. Caller shows low investment in the conversation.",
        positiveSignals: [],
        negativeSignals: ["one_word_answers", "no_questions", "passive_tone", "minimal_elaboration"],
        isGold: true,
      },
      {
        score: 0.5,
        example: "Agent: How can I help today?\nCaller: I wanted to check on something.\nAgent: Sure, what would you like to know?\nCaller: Well, I was looking at my account and noticed something. Can you explain it?\nAgent: Of course, which part?\nCaller: The charges from last month.",
        rationale: "Basic participation with some follow-up, but limited emotional investment. Functional but not highly engaged.",
        positiveSignals: ["follows_up", "asks_questions"],
        negativeSignals: ["limited_detail", "neutral_tone"],
        isGold: true,
      },
      {
        score: 0.9,
        example: "Agent: How can I help today?\nCaller: Oh, I'm so glad you asked! I've been thinking about this all week. So here's the situation - and please stop me if I'm going too fast - but I noticed these three things on my account and I have some ideas about what might be happening...\nAgent: I love that you've thought about this!\nCaller: Right? And then I also wanted to get your opinion on whether I should...",
        rationale: "High participation, emotional investment, multiple questions, sharing context proactively. Caller is fully engaged.",
        positiveSignals: ["proactive_sharing", "multiple_questions", "emotional_investment", "asks_opinions", "detailed_context"],
        negativeSignals: [],
        isGold: true,
      },
    ],
  },
  // Rapport anchors
  {
    parameterId: "MVP-RAPPORT",
    anchors: [
      {
        score: 0.2,
        example: "Agent: Before we begin, how was your weekend?\nCaller: Can we just get to the point? I don't have time for small talk.\nAgent: Of course. What do you need?\nCaller: Just fix the issue.",
        rationale: "Caller explicitly rejects relationship building. Transaction-focused, guarded, no personal sharing.",
        positiveSignals: [],
        negativeSignals: ["rejects_rapport", "transaction_only", "time_pressure", "no_personal"],
        isGold: true,
      },
      {
        score: 0.7,
        example: "Agent: Good to speak with you again!\nCaller: Oh hi! Yes, nice to hear from you too. So about that thing we discussed last time...\nAgent: Right, the project! How did it go?\nCaller: Pretty well actually, thanks for asking. But now I have a follow-up question...",
        rationale: "Warm greeting, acknowledges relationship history, shares outcomes, but stays relatively task-focused.",
        positiveSignals: ["warm_greeting", "acknowledges_history", "shares_outcomes", "thanks_agent"],
        negativeSignals: ["stays_task_focused"],
        isGold: true,
      },
      {
        score: 0.95,
        example: "Agent: Sarah! How are you doing?\nCaller: I'm good, thanks for asking! How was your vacation you mentioned?\nAgent: It was wonderful, thank you for remembering!\nCaller: Of course! You know, I was actually thinking about our conversation last time and it really helped me. I told my husband what you suggested and he thought it was brilliant.\nAgent: That makes my day to hear!",
        rationale: "Deep personal connection, remembers agent's life, shares personal impact, genuine warmth and trust.",
        positiveSignals: ["personal_questions", "remembers_agent_details", "shares_impact", "includes_family", "genuine_warmth"],
        negativeSignals: [],
        isGold: true,
      },
    ],
  },
  // Agent warmth anchors
  {
    parameterId: "MVP-BEH-WARMTH",
    anchors: [
      {
        score: 0.2,
        example: "Your account has been updated. The changes will take effect in 24 hours. Is there anything else?",
        rationale: "Purely informational, no personal touch, no emotional acknowledgment. Efficient but cold.",
        positiveSignals: ["efficient", "clear"],
        negativeSignals: ["no_greeting", "no_personalization", "no_warmth_markers"],
        isGold: true,
      },
      {
        score: 0.6,
        example: "Thanks for reaching out! I've updated your account and those changes should be live within 24 hours. Let me know if you have any other questions!",
        rationale: "Friendly bookends (thanks, let me know) but limited warmth in the middle. Pleasant but not deeply warm.",
        positiveSignals: ["thanks", "friendly_closing", "exclamation"],
        negativeSignals: ["limited_personalization"],
        isGold: true,
      },
      {
        score: 0.95,
        example: "Hi Sarah! So great to hear from you again - I hope you've been well! I just took care of that account update for you, and I'm really glad we could get that sorted out. Is there anything else I can help with? I'm always happy to chat!",
        rationale: "Personal greeting by name, expresses genuine care, emotional language, enthusiastic availability. Very warm.",
        positiveSignals: ["uses_name", "expresses_care", "glad_to_help", "always_happy", "remembers_relationship"],
        negativeSignals: [],
        isGold: true,
      },
    ],
  },
];

// ============================================================================
// MVP ANALYSIS SPECS
// ============================================================================

const mvpAnalysisSpecs = [
  // === MEASURE Specs (score caller from transcript) ===
  {
    slug: "mvp-measure-engagement",
    name: "MVP: Measure Caller Engagement",
    description: "Scores the caller's engagement level from transcript signals. Looks for participation, questions, emotional investment, and elaboration.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "mvp-measure",
    priority: 10,
    triggers: [
      {
        name: "Engagement Assessment",
        given: "A conversation transcript between agent and caller",
        when: "Analyzing caller participation and investment signals",
        then: "Produce an engagement score (0-1) with evidence",
        actions: [
          {
            description: "Score caller engagement based on: question frequency, response length, emotional language, proactive sharing, follow-up on topics. Higher = more engaged.",
            parameterId: "MVP-ENGAGEMENT",
            weight: 1.0,
          },
        ],
      },
    ],
  },
  {
    slug: "mvp-measure-rapport",
    name: "MVP: Measure Caller Rapport",
    description: "Scores the relationship quality and trust level between caller and agent. Looks for personal sharing, warmth, history acknowledgment.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "mvp-measure",
    priority: 10,
    triggers: [
      {
        name: "Rapport Assessment",
        given: "A conversation transcript with relationship context",
        when: "Analyzing relationship quality signals",
        then: "Produce a rapport score (0-1) with evidence",
        actions: [
          {
            description: "Score rapport based on: personal sharing depth, warmth in greetings, references to shared history, trust indicators, comfort level. Higher = stronger rapport.",
            parameterId: "MVP-RAPPORT",
            weight: 1.0,
          },
        ],
      },
    ],
  },
  {
    slug: "mvp-measure-satisfaction",
    name: "MVP: Measure Call Satisfaction",
    description: "Scores the caller's apparent satisfaction with the call. Looks for resolution signals, tone, explicit feedback, and closing sentiment.",
    outputType: "MEASURE" as AnalysisOutputType,
    domain: "mvp-measure",
    priority: 10,
    triggers: [
      {
        name: "Satisfaction Assessment",
        given: "A completed conversation transcript",
        when: "Analyzing outcome and satisfaction signals",
        then: "Produce a satisfaction score (0-1) with evidence",
        actions: [
          {
            description: "Score satisfaction based on: explicit thanks/feedback, resolution of stated needs, positive vs negative sentiment, closing tone, stated next steps. Higher = more satisfied.",
            parameterId: "MVP-SATISFACTION",
            weight: 1.0,
          },
        ],
      },
    ],
  },

  // === LEARN Specs (extract memories) ===
  {
    slug: "mvp-learn-personal-facts",
    name: "MVP: Learn Personal Facts",
    description: "Extracts factual information about the caller: name, location, occupation, family, preferences. Creates memories for personalization.",
    outputType: "LEARN" as AnalysisOutputType,
    domain: "mvp-learn",
    priority: 10,
    triggers: [
      {
        name: "Personal Fact Extraction",
        given: "A conversation where the caller shares personal information",
        when: "The caller mentions facts about themselves, their life, or their situation",
        then: "Extract and store as persistent memories for future personalization",
        actions: [
          {
            description: "Extract biographical facts: name, location, occupation, employer, family members mentioned. Each fact becomes a separate memory.",
            learnCategory: "FACT" as MemoryCategory,
            learnKeyPrefix: "bio_",
            learnKeyHint: "Use keys like bio_location, bio_occupation, bio_family_spouse. Value should be the specific fact.",
            weight: 1.0,
          },
          {
            description: "Extract stated preferences: communication style preferences, product preferences, timing preferences. Things the caller explicitly prefers.",
            learnCategory: "PREFERENCE" as MemoryCategory,
            learnKeyPrefix: "prefers_",
            learnKeyHint: "Use keys like prefers_email, prefers_morning_calls, prefers_detailed_explanations. Value describes the preference.",
            weight: 0.9,
          },
        ],
      },
    ],
  },
  {
    slug: "mvp-learn-events",
    name: "MVP: Learn Upcoming Events",
    description: "Extracts time-bound events and plans the caller mentions. Enables contextual follow-up in future calls.",
    outputType: "LEARN" as AnalysisOutputType,
    domain: "mvp-learn",
    priority: 9,
    triggers: [
      {
        name: "Event Extraction",
        given: "A conversation where the caller mentions future plans or past events",
        when: "The caller references specific events, deadlines, or time-bound situations",
        then: "Extract as temporal memories with appropriate expiration",
        actions: [
          {
            description: "Extract future events: appointments, deadlines, travel plans, life events. Include timeframe when mentioned.",
            learnCategory: "EVENT" as MemoryCategory,
            learnKeyPrefix: "event_",
            learnKeyHint: "Use keys like event_vacation_march, event_job_interview, event_surgery. Value includes date/timeframe and context.",
            weight: 1.0,
          },
          {
            description: "Extract context that affects current situation: traveling, busy period, stress factors. These may expire after relevant period.",
            learnCategory: "CONTEXT" as MemoryCategory,
            learnKeyPrefix: "situation_",
            learnKeyHint: "Use keys like situation_traveling, situation_work_deadline. Include duration if known.",
            weight: 0.8,
          },
        ],
      },
    ],
  },

  // === ADAPT Specs (compute deltas) ===
  {
    slug: "mvp-adapt-engagement-delta",
    name: "MVP: Compute Engagement Delta",
    description: "Computes the change in engagement from the previous call. Enables tracking whether the relationship is improving.",
    outputType: "ADAPT" as AnalysisOutputType,
    domain: "mvp-adapt",
    priority: 8,
    triggers: [
      {
        name: "Engagement Delta Calculation",
        given: "Current call engagement score AND previous call engagement score available",
        when: "Both scores are present for the same caller",
        then: "Compute delta (current - previous) and store as ADAPT parameter",
        actions: [
          {
            description: "Calculate engagement_delta = current_engagement - previous_engagement. Normalize to -1 to +1 range. Positive = improving, negative = declining.",
            parameterId: "MVP-ENGAGEMENT-DELTA",
            weight: 1.0,
          },
        ],
      },
    ],
  },
  {
    slug: "mvp-adapt-rapport-delta",
    name: "MVP: Compute Rapport Delta",
    description: "Computes the change in rapport from previous interactions. Tracks relationship building over time.",
    outputType: "ADAPT" as AnalysisOutputType,
    domain: "mvp-adapt",
    priority: 8,
    triggers: [
      {
        name: "Rapport Delta Calculation",
        given: "Current call rapport score AND previous rapport score available",
        when: "Both scores are present for the same caller",
        then: "Compute delta and store as ADAPT parameter",
        actions: [
          {
            description: "Calculate rapport_delta = current_rapport - previous_rapport. Normalize to -1 to +1 range. Positive = relationship strengthening.",
            parameterId: "MVP-RAPPORT-DELTA",
            weight: 1.0,
          },
        ],
      },
    ],
  },
  {
    slug: "mvp-adapt-rapport-goal",
    name: "MVP: Compute Rapport Goal Progress",
    description: "Computes progress toward the rapport goal (target: 0.8) over a rolling window of calls.",
    outputType: "ADAPT" as AnalysisOutputType,
    domain: "mvp-adapt",
    priority: 7,
    triggers: [
      {
        name: "Goal Progress Calculation",
        given: "Current rapport score and goal target (0.8)",
        when: "Computing goal progress for this caller",
        then: "Store goal progress as ratio and trend",
        actions: [
          {
            description: "Calculate goal_progress = current_rapport / target_rapport. Also compute trend over last 5 calls. Store both values.",
            parameterId: "MVP-RAPPORT-GOAL",
            weight: 1.0,
          },
        ],
      },
    ],
  },

  // === MEASURE_AGENT Specs (score agent behavior) ===
  {
    slug: "mvp-measure-agent-warmth",
    name: "MVP: Measure Agent Warmth",
    description: "Scores how warm and friendly the agent's communication was. Used to compare against behavior targets.",
    outputType: "MEASURE_AGENT" as AnalysisOutputType,
    domain: "mvp-measure-agent",
    priority: 10,
    triggers: [
      {
        name: "Agent Warmth Assessment",
        given: "A conversation transcript with agent responses",
        when: "Analyzing agent communication style",
        then: "Produce a warmth score (0-1) with evidence",
        actions: [
          {
            description: "Score agent warmth based on: greeting personalization, emotional language, enthusiasm, care expressions, friendly closings. Higher = warmer.",
            parameterId: "MVP-BEH-WARMTH",
            weight: 1.0,
          },
        ],
      },
    ],
  },
  {
    slug: "mvp-measure-agent-directness",
    name: "MVP: Measure Agent Directness",
    description: "Scores how directly the agent addressed caller needs. Some contexts benefit from exploration, others from direct answers.",
    outputType: "MEASURE_AGENT" as AnalysisOutputType,
    domain: "mvp-measure-agent",
    priority: 10,
    triggers: [
      {
        name: "Agent Directness Assessment",
        given: "A conversation transcript with agent responses",
        when: "Analyzing agent response structure",
        then: "Produce a directness score (0-1) with evidence",
        actions: [
          {
            description: "Score agent directness based on: answer position (first vs after context), sentence structure, information density per response. Higher = more direct.",
            parameterId: "MVP-BEH-DIRECTNESS",
            weight: 1.0,
          },
        ],
      },
    ],
  },
  {
    slug: "mvp-measure-agent-empathy",
    name: "MVP: Measure Agent Empathy",
    description: "Scores how well the agent expressed empathy and emotional understanding.",
    outputType: "MEASURE_AGENT" as AnalysisOutputType,
    domain: "mvp-measure-agent",
    priority: 10,
    triggers: [
      {
        name: "Agent Empathy Assessment",
        given: "A conversation transcript with emotional content",
        when: "Analyzing agent emotional intelligence",
        then: "Produce an empathy score (0-1) with evidence",
        actions: [
          {
            description: "Score agent empathy based on: emotional acknowledgment, validation phrases, mirroring feelings, timing of empathy expressions. Higher = more empathetic.",
            parameterId: "MVP-BEH-EMPATHY",
            weight: 1.0,
          },
        ],
      },
    ],
  },
];

// ============================================================================
// MVP BEHAVIOR TARGETS
// ============================================================================
// System-level defaults for agent behavior (can be overridden per-segment or caller)

const mvpBehaviorTargets = [
  {
    parameterId: "MVP-BEH-WARMTH",
    scope: "SYSTEM" as BehaviorTargetScope,
    targetValue: 0.7, // Default to fairly warm
    confidence: 0.5,
    source: "SEED" as BehaviorTargetSource,
  },
  {
    parameterId: "MVP-BEH-DIRECTNESS",
    scope: "SYSTEM" as BehaviorTargetScope,
    targetValue: 0.6, // Lean slightly direct
    confidence: 0.5,
    source: "SEED" as BehaviorTargetSource,
  },
  {
    parameterId: "MVP-BEH-EMPATHY",
    scope: "SYSTEM" as BehaviorTargetScope,
    targetValue: 0.7, // Default to fairly empathetic
    confidence: 0.5,
    source: "SEED" as BehaviorTargetSource,
  },
];

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function seedMvpFullPipeline() {
  console.log("\n========================================");
  console.log("MVP FULL PIPELINE SEED");
  console.log("========================================\n");

  // 1. Ensure MVP tags exist
  console.log("1. Creating MVP tags...");
  await prisma.tag.upsert({
    where: { id: MVP_TAG.id },
    update: {},
    create: MVP_TAG,
  });
  // Find or create Active tag
  let activeTag = await prisma.tag.findFirst({ where: { name: { equals: "Active", mode: "insensitive" } } });
  if (!activeTag) {
    activeTag = await prisma.tag.create({
      data: { id: "active-tag-seed", name: "Active", slug: "active", tone: "success" },
    });
  }
  const ACTIVE_TAG_ID = activeTag.id;
  console.log("   Tags ready.\n");

  // 2. Create MVP Parameters
  console.log("2. Creating MVP Parameters...");
  for (const param of mvpParameters) {
    const { baseParameterId, ...paramData } = param;

    await prisma.parameter.upsert({
      where: { parameterId: param.parameterId },
      update: {
        name: param.name,
        definition: param.definition,
        parameterType: param.parameterType,
        baseParameterId: baseParameterId || null,
        goalTarget: (param as any).goalTarget || null,
        goalWindow: (param as any).goalWindow || null,
      },
      create: {
        ...paramData,
        baseParameterId: baseParameterId || null,
        goalTarget: (param as any).goalTarget || null,
        goalWindow: (param as any).goalWindow || null,
      },
    });

    // Tag as MVP-Pipeline and Active
    const paramRecord = await prisma.parameter.findUnique({ where: { parameterId: param.parameterId } });
    if (paramRecord) {
      await prisma.parameterTag.upsert({
        where: { parameterId_tagId: { parameterId: param.parameterId, tagId: MVP_TAG.id } },
        update: {},
        create: { id: `${param.parameterId}-mvp-tag`, parameterId: param.parameterId, tagId: MVP_TAG.id },
      });
      await prisma.parameterTag.upsert({
        where: { parameterId_tagId: { parameterId: param.parameterId, tagId: ACTIVE_TAG_ID } },
        update: {},
        create: { id: `${param.parameterId}-active-tag`, parameterId: param.parameterId, tagId: ACTIVE_TAG_ID },
      });
    }
    console.log(`   ✓ ${param.parameterId}: ${param.name}`);
  }
  console.log(`   Created ${mvpParameters.length} parameters.\n`);

  // 3. Create Scoring Anchors
  console.log("3. Creating Scoring Anchors...");
  let anchorCount = 0;
  for (const paramAnchors of mvpScoringAnchors) {
    for (let i = 0; i < paramAnchors.anchors.length; i++) {
      const anchor = paramAnchors.anchors[i];
      await prisma.parameterScoringAnchor.create({
        data: {
          parameterId: paramAnchors.parameterId,
          example: anchor.example,
          score: anchor.score,
          rationale: anchor.rationale,
          positiveSignals: anchor.positiveSignals,
          negativeSignals: anchor.negativeSignals,
          isGold: anchor.isGold,
          sortOrder: i,
          source: "mvp_seed",
        },
      });
      anchorCount++;
    }
    console.log(`   ✓ ${paramAnchors.parameterId}: ${paramAnchors.anchors.length} anchors`);
  }
  console.log(`   Created ${anchorCount} scoring anchors.\n`);

  // 4. Create Analysis Specs
  console.log("4. Creating Analysis Specs...");
  const createdSpecIds: string[] = [];
  for (const spec of mvpAnalysisSpecs) {
    // Delete existing if present
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
        // Mark as compiled from the start
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
              create: t.actions.map((a: any, aIdx) => ({
                description: a.description,
                parameterId: a.parameterId || null,
                learnCategory: a.learnCategory || null,
                learnKeyPrefix: a.learnKeyPrefix || null,
                learnKeyHint: a.learnKeyHint || null,
                weight: a.weight,
                sortOrder: aIdx,
              })),
            },
          })),
        },
      },
    });
    createdSpecIds.push(specRecord.id);
    console.log(`   ✓ ${spec.slug} (${spec.outputType}) [COMPILED]`);
  }
  console.log(`   Created ${mvpAnalysisSpecs.length} analysis specs.\n`);

  // 5. Create Behavior Targets
  console.log("5. Creating Behavior Targets...");
  for (const target of mvpBehaviorTargets) {
    // Delete existing system-level targets for this parameter
    await prisma.behaviorTarget.deleteMany({
      where: {
        parameterId: target.parameterId,
        scope: "SYSTEM",
      },
    });

    await prisma.behaviorTarget.create({
      data: {
        parameterId: target.parameterId,
        scope: target.scope,
        targetValue: target.targetValue,
        confidence: target.confidence,
        source: target.source,
      },
    });
    console.log(`   ✓ ${target.parameterId}: target=${target.targetValue}`);
  }
  console.log(`   Created ${mvpBehaviorTargets.length} behavior targets.\n`);

  // 6. Create Analysis Profile
  console.log("6. Creating MVP Analysis Profile...");
  const profileName = "MVP: Full Pipeline Profile";
  const compiledSetName = "MVP: Full Pipeline v1.0";

  // Delete existing compiled set first (due to FK constraint)
  const existingSet = await prisma.compiledAnalysisSet.findFirst({ where: { name: compiledSetName } });
  if (existingSet) {
    await prisma.compiledAnalysisSet.delete({ where: { id: existingSet.id } });
    console.log("   (deleted existing compiled set)");
  }

  // Delete existing profile if present
  const existingProfile = await prisma.analysisProfile.findFirst({ where: { name: profileName } });
  if (existingProfile) {
    await prisma.analysisProfile.delete({ where: { id: existingProfile.id } });
    console.log("   (deleted existing profile)");
  }

  const profile = await prisma.analysisProfile.create({
    data: {
      name: profileName,
      description: "Complete MVP analysis profile with MEASURE, LEARN, ADAPT, and MEASURE_AGENT specs. Ready for production use.",
      parameters: {
        create: mvpParameters
          .filter(p => p.parameterType !== "BEHAVIOR") // Behavior params are targets, not profile params
          .map(p => ({
            parameterId: p.parameterId,
            definition: p.definition,
            scaleType: p.scaleType,
            directionality: p.directionality,
            interpretationLow: p.interpretationLow,
            interpretationHigh: p.interpretationHigh,
            enabled: true,
            weight: 1.0,
          })),
      },
    },
  });
  console.log(`   ✓ Created profile: ${profile.name}\n`);

  // 7. Create Compiled Analysis Set
  console.log("7. Creating Compiled Analysis Set...");

  const compiledSet = await prisma.compiledAnalysisSet.create({
    data: {
      name: compiledSetName,
      description: "Compiled MVP analysis set ready for production. Includes all MEASURE, LEARN, ADAPT, and MEASURE_AGENT specs with calibration anchors.",
      version: "1.0",
      analysisProfileId: profile.id,
      status: "READY" as CompilationStatus,
      compiledAt: new Date(),
      compiledBy: "seed-mvp-full-pipeline",
      validationPassed: true,
      specIds: createdSpecIds,
      measureSpecCount: mvpAnalysisSpecs.filter(s => s.outputType === "MEASURE").length,
      learnSpecCount: mvpAnalysisSpecs.filter(s => s.outputType === "LEARN").length,
      parameterCount: mvpParameters.length,
      anchorCount: anchorCount,
    },
  });
  console.log(`   ✓ Created compiled set: ${compiledSet.name}\n`);

  // Summary
  console.log("========================================");
  console.log("MVP FULL PIPELINE SEED COMPLETE");
  console.log("========================================\n");
  console.log("Created:");
  console.log(`  - ${mvpParameters.length} MVP Parameters`);
  console.log(`  - ${anchorCount} Scoring Anchors`);
  console.log(`  - ${mvpAnalysisSpecs.length} Analysis Specs:`);
  console.log(`      ${mvpAnalysisSpecs.filter(s => s.outputType === "MEASURE").length} MEASURE`);
  console.log(`      ${mvpAnalysisSpecs.filter(s => s.outputType === "LEARN").length} LEARN`);
  console.log(`      ${mvpAnalysisSpecs.filter(s => s.outputType === "ADAPT").length} ADAPT`);
  console.log(`      ${mvpAnalysisSpecs.filter(s => s.outputType === "MEASURE_AGENT").length} MEASURE_AGENT`);
  console.log(`  - ${mvpBehaviorTargets.length} Behavior Targets`);
  console.log(`  - 1 Analysis Profile`);
  console.log(`  - 1 Compiled Analysis Set (READY)`);
  console.log("\nPipeline is ready to run!");
  console.log("\nNext steps:");
  console.log("  1. Process transcripts: POST /api/ops { opid: 'transcripts:process' }");
  console.log("  2. Run analysis: POST /api/ops { opid: 'analyze:full-pipeline' }");
  console.log("  3. View results: /analysis-runs\n");
}

// Run
seedMvpFullPipeline()
  .catch((e) => {
    console.error("Error seeding MVP pipeline:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
