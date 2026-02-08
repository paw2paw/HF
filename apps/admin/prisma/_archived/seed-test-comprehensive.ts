/**
 * Comprehensive Test Seed
 *
 * Creates a complete test dataset covering ALL spec types:
 * - MEASURE: Score caller traits (personality, engagement, satisfaction)
 * - LEARN: Extract memories (facts, preferences, relationships, events)
 * - ADAPT: Track changes over time (deltas, goal progress)
 * - MEASURE_AGENT: Score agent behavior (warmth, directness, empathy)
 *
 * Also includes:
 * - ~20 parameters with scoring anchors
 * - Sample transcripts for testing
 * - An analysis profile ready to compile
 *
 * Run: npx tsx prisma/seed-test-comprehensive.ts
 */

import { PrismaClient, ParameterType, MemoryCategory } from "@prisma/client";

const prisma = new PrismaClient();

// ===========================================
// PARAMETERS (~20 total)
// ===========================================

const PARAMETERS = {
  // === TRAIT Parameters (Stable personality - Big Five) ===
  traits: [
    {
      parameterId: "B5-O",
      name: "Openness",
      definition: "Caller's openness to new ideas, creativity, and abstract thinking",
      parameterType: "TRAIT" as ParameterType,
      sectionId: "personality",
      domainGroup: "big-five",
      scaleType: "0-1",
      directionality: "positive",
      computedBy: "llm",
      interpretationHigh: "Curious, creative, open to new experiences",
      interpretationLow: "Practical, conventional, prefers routine",
    },
    {
      parameterId: "B5-C",
      name: "Conscientiousness",
      definition: "Caller's level of organization, dependability, and self-discipline",
      parameterType: "TRAIT" as ParameterType,
      sectionId: "personality",
      domainGroup: "big-five",
      scaleType: "0-1",
      directionality: "positive",
      computedBy: "llm",
      interpretationHigh: "Organized, reliable, detail-oriented",
      interpretationLow: "Flexible, spontaneous, less structured",
    },
    {
      parameterId: "B5-E",
      name: "Extraversion",
      definition: "Caller's sociability, talkativeness, and energy in conversation",
      parameterType: "TRAIT" as ParameterType,
      sectionId: "personality",
      domainGroup: "big-five",
      scaleType: "0-1",
      directionality: "positive",
      computedBy: "llm",
      interpretationHigh: "Outgoing, talkative, energetic",
      interpretationLow: "Reserved, quiet, prefers listening",
    },
    {
      parameterId: "B5-A",
      name: "Agreeableness",
      definition: "Caller's cooperation, trust, and consideration for others",
      parameterType: "TRAIT" as ParameterType,
      sectionId: "personality",
      domainGroup: "big-five",
      scaleType: "0-1",
      directionality: "positive",
      computedBy: "llm",
      interpretationHigh: "Cooperative, trusting, helpful",
      interpretationLow: "Competitive, skeptical, challenging",
    },
    {
      parameterId: "B5-N",
      name: "Neuroticism",
      definition: "Caller's emotional reactivity and tendency toward negative emotions",
      parameterType: "TRAIT" as ParameterType,
      sectionId: "personality",
      domainGroup: "big-five",
      scaleType: "0-1",
      directionality: "negative",
      computedBy: "llm",
      interpretationHigh: "Anxious, easily stressed, emotionally reactive",
      interpretationLow: "Calm, emotionally stable, resilient",
    },
  ],

  // === STATE Parameters (Per-call metrics) ===
  states: [
    {
      parameterId: "engagement",
      name: "Engagement",
      definition: "Caller's active participation and interest in the conversation",
      parameterType: "STATE" as ParameterType,
      sectionId: "interaction",
      domainGroup: "engagement",
      scaleType: "0-1",
      directionality: "positive",
      computedBy: "llm",
      interpretationHigh: "Highly engaged, asks questions, provides details",
      interpretationLow: "Minimal responses, seems distracted or disinterested",
    },
    {
      parameterId: "rapport",
      name: "Rapport",
      definition: "Quality of connection and mutual understanding between caller and agent",
      parameterType: "STATE" as ParameterType,
      sectionId: "interaction",
      domainGroup: "engagement",
      scaleType: "0-1",
      directionality: "positive",
      computedBy: "llm",
      interpretationHigh: "Strong connection, natural flow, mutual respect",
      interpretationLow: "Distant, transactional, lacking warmth",
    },
    {
      parameterId: "satisfaction",
      name: "Satisfaction",
      definition: "Caller's apparent satisfaction with the interaction",
      parameterType: "STATE" as ParameterType,
      sectionId: "outcome",
      domainGroup: "engagement",
      scaleType: "0-1",
      directionality: "positive",
      computedBy: "llm",
      interpretationHigh: "Expresses gratitude, positive tone, issue resolved",
      interpretationLow: "Frustrated, unresolved issues, negative tone",
    },
    {
      parameterId: "clarity",
      name: "Clarity",
      definition: "How clearly the caller communicates their needs and questions",
      parameterType: "STATE" as ParameterType,
      sectionId: "communication",
      domainGroup: "conversation",
      scaleType: "0-1",
      directionality: "positive",
      computedBy: "llm",
      interpretationHigh: "Clear, specific, well-articulated requests",
      interpretationLow: "Vague, confused, unclear about what they need",
    },
  ],

  // === BEHAVIOR Parameters (Agent behavior targets) ===
  behaviors: [
    {
      parameterId: "agent-warmth",
      name: "Agent Warmth",
      definition: "How warm, friendly, and personable the agent is in conversation",
      parameterType: "BEHAVIOR" as ParameterType,
      sectionId: "agent-behavior",
      domainGroup: "agent",
      scaleType: "0-1",
      directionality: "positive",
      computedBy: "llm",
      interpretationHigh: "Warm greeting, uses name, shows genuine interest",
      interpretationLow: "Cold, robotic, purely transactional",
    },
    {
      parameterId: "agent-directness",
      name: "Agent Directness",
      definition: "How direct and to-the-point the agent is in responses",
      parameterType: "BEHAVIOR" as ParameterType,
      sectionId: "agent-behavior",
      domainGroup: "agent",
      scaleType: "0-1",
      directionality: "positive",
      computedBy: "llm",
      interpretationHigh: "Concise, gets to the point quickly",
      interpretationLow: "Verbose, takes a long time to answer",
    },
    {
      parameterId: "agent-empathy",
      name: "Agent Empathy",
      definition: "How well the agent acknowledges and validates caller emotions",
      parameterType: "BEHAVIOR" as ParameterType,
      sectionId: "agent-behavior",
      domainGroup: "agent",
      scaleType: "0-1",
      directionality: "positive",
      computedBy: "llm",
      interpretationHigh: "Validates feelings, shows understanding, supportive",
      interpretationLow: "Dismissive, ignores emotional cues",
    },
    {
      parameterId: "agent-memory-use",
      name: "Agent Memory Use",
      definition: "How well the agent references previous conversations and caller context",
      parameterType: "BEHAVIOR" as ParameterType,
      sectionId: "agent-behavior",
      domainGroup: "agent",
      scaleType: "0-1",
      directionality: "positive",
      computedBy: "llm",
      interpretationHigh: "References past calls, remembers details, builds on history",
      interpretationLow: "Treats every call as new, no memory reference",
    },
  ],

  // === ADAPT Parameters (Delta/change tracking) ===
  adapt: [
    {
      parameterId: "engagement-delta",
      name: "Engagement Change",
      definition: "Change in engagement from previous call to current call",
      parameterType: "ADAPT" as ParameterType,
      baseParameterId: "engagement",
      sectionId: "deltas",
      domainGroup: "engagement",
      scaleType: "-1-1",
      directionality: "positive",
      computedBy: "computed",
      interpretationHigh: "Engagement increased significantly",
      interpretationLow: "Engagement decreased significantly",
    },
    {
      parameterId: "rapport-delta",
      name: "Rapport Change",
      definition: "Change in rapport from previous call to current call",
      parameterType: "ADAPT" as ParameterType,
      baseParameterId: "rapport",
      sectionId: "deltas",
      domainGroup: "engagement",
      scaleType: "-1-1",
      directionality: "positive",
      computedBy: "computed",
      interpretationHigh: "Rapport improved",
      interpretationLow: "Rapport declined",
    },
  ],

  // === GOAL Parameters (Progress toward target) ===
  goals: [
    {
      parameterId: "rapport-goal",
      name: "Rapport Goal Progress",
      definition: "Progress toward target rapport level (0.8)",
      parameterType: "GOAL" as ParameterType,
      baseParameterId: "rapport",
      goalTarget: 0.8,
      goalWindow: 5,
      sectionId: "goals",
      domainGroup: "engagement",
      scaleType: "0-1",
      directionality: "positive",
      computedBy: "computed",
      interpretationHigh: "Close to or exceeding target",
      interpretationLow: "Far from target",
    },
    {
      parameterId: "satisfaction-goal",
      name: "Satisfaction Goal Progress",
      definition: "Progress toward target satisfaction level (0.85)",
      parameterType: "GOAL" as ParameterType,
      baseParameterId: "satisfaction",
      goalTarget: 0.85,
      goalWindow: 5,
      sectionId: "goals",
      domainGroup: "engagement",
      scaleType: "0-1",
      directionality: "positive",
      computedBy: "computed",
      interpretationHigh: "Meeting satisfaction targets",
      interpretationLow: "Below satisfaction targets",
    },
  ],
};

// ===========================================
// SCORING ANCHORS (Calibration examples)
// ===========================================

const SCORING_ANCHORS = {
  "B5-E": [
    {
      score: 0.9,
      example: "Oh wow, that's so interesting! I love talking about this stuff. Actually, let me tell you about something similar that happened to me last week - it was hilarious! So anyway, what do you think about...",
      rationale: "Very talkative, shares personal stories, high energy, lots of exclamation marks",
      positiveSignals: ["volunteering_info", "personal_stories", "enthusiasm", "extended_responses"],
      negativeSignals: [],
    },
    {
      score: 0.5,
      example: "Yes, that sounds fine. I understand. Is there anything else I need to do?",
      rationale: "Balanced - engages appropriately but doesn't over-share or drive the conversation",
      positiveSignals: ["appropriate_responses"],
      negativeSignals: [],
    },
    {
      score: 0.2,
      example: "Okay. Yes. Fine.",
      rationale: "Minimal responses, doesn't elaborate, seems to prefer listening",
      positiveSignals: [],
      negativeSignals: ["minimal_responses", "no_elaboration", "short_answers"],
    },
  ],
  engagement: [
    {
      score: 0.95,
      example: "That's a great question! I've been thinking about this a lot actually. Can you tell me more about how that feature works? And what about the pricing tiers - do they include support?",
      rationale: "Asks follow-up questions, shows deep interest, drives the conversation forward",
      positiveSignals: ["asks_questions", "shows_interest", "drives_conversation", "detailed_responses"],
      negativeSignals: [],
    },
    {
      score: 0.6,
      example: "Okay, I see. That makes sense. What's the next step then?",
      rationale: "Engaged enough to continue but not driving the conversation",
      positiveSignals: ["following_along", "asks_next_steps"],
      negativeSignals: [],
    },
    {
      score: 0.2,
      example: "Uh huh. Okay. Sure. Whatever works.",
      rationale: "Minimal engagement, seems distracted or disinterested",
      positiveSignals: [],
      negativeSignals: ["minimal_responses", "seems_distracted", "noncommittal"],
    },
  ],
  rapport: [
    {
      score: 0.9,
      example: "Haha, that's exactly what I was thinking! You really get it. I feel like we're on the same page here. Thanks for being so helpful - you've made this whole process much less stressful.",
      rationale: "Strong connection, mutual understanding, expresses appreciation",
      positiveSignals: ["mutual_understanding", "appreciation", "relaxed_tone", "humor"],
      negativeSignals: [],
    },
    {
      score: 0.5,
      example: "Okay, thanks for explaining that. I think I understand now.",
      rationale: "Professional but not particularly warm connection",
      positiveSignals: ["polite", "professional"],
      negativeSignals: ["no_warmth", "transactional"],
    },
    {
      score: 0.2,
      example: "Look, I just need this fixed. Can you stop explaining and just do it? This is taking forever.",
      rationale: "Frustrated, no connection, adversarial tone",
      positiveSignals: [],
      negativeSignals: ["frustrated", "adversarial", "impatient", "no_connection"],
    },
  ],
  "agent-warmth": [
    {
      score: 0.95,
      example: "Hi Sarah! So great to hear from you again. I remember we were working on that tricky integration last time - how did that go? I hope it's all running smoothly now!",
      rationale: "Uses name, references history, shows genuine interest, warm greeting",
      positiveSignals: ["uses_name", "references_history", "genuine_interest", "warm_greeting"],
      negativeSignals: [],
    },
    {
      score: 0.5,
      example: "Hello, how can I help you today?",
      rationale: "Professional but generic - not cold but not particularly warm",
      positiveSignals: ["polite"],
      negativeSignals: ["generic", "no_personalization"],
    },
    {
      score: 0.15,
      example: "Please state your issue.",
      rationale: "Cold, robotic, no warmth or personality",
      positiveSignals: [],
      negativeSignals: ["cold", "robotic", "impersonal", "no_greeting"],
    },
  ],
  "agent-empathy": [
    {
      score: 0.9,
      example: "I can really hear how frustrating this has been for you, and I'm sorry you've had to deal with it. That's not the experience we want you to have. Let me make this right for you.",
      rationale: "Validates feelings, apologizes, commits to resolution",
      positiveSignals: ["validates_feelings", "apologizes", "commits_to_resolution", "empathetic_language"],
      negativeSignals: [],
    },
    {
      score: 0.5,
      example: "I understand. Let me look into that for you.",
      rationale: "Acknowledges but doesn't deeply validate emotions",
      positiveSignals: ["acknowledges"],
      negativeSignals: ["surface_level", "no_validation"],
    },
    {
      score: 0.1,
      example: "That's not how the system works. You need to follow the correct procedure.",
      rationale: "Dismissive, ignores emotional component, focuses only on process",
      positiveSignals: [],
      negativeSignals: ["dismissive", "ignores_emotions", "process_focused", "blaming"],
    },
  ],
};

// ===========================================
// ANALYSIS SPECS (All types)
// ===========================================

const ANALYSIS_SPECS = {
  // === MEASURE Specs (Score caller traits) ===
  measure: [
    {
      slug: "personality-extraversion",
      name: "Personality: Extraversion",
      description: "Measures caller's sociability, talkativeness, and energy level from conversation patterns",
      outputType: "MEASURE",
      domain: "personality",
      priority: 10,
      triggers: [
        {
          name: "Analyze Extraversion",
          given: "A call transcript is available for analysis",
          when: "The analysis pipeline processes the call",
          then: "Score the caller's extraversion level",
          actions: [
            {
              description: "Analyze response length and elaboration patterns",
              parameterId: "B5-E",
              weight: 0.4,
            },
            {
              description: "Evaluate volunteered personal information and stories",
              parameterId: "B5-E",
              weight: 0.3,
            },
            {
              description: "Assess energy level and enthusiasm indicators",
              parameterId: "B5-E",
              weight: 0.3,
            },
          ],
        },
      ],
      promptTemplate: `Based on the caller's extraversion score of {{value}} ({{label}}):
{{#if high}}This caller is outgoing and talkative. Engage in friendly conversation, share relevant stories, and match their energy level.{{/if}}
{{#if medium}}This caller has balanced social energy. Maintain professional warmth while staying focused on their needs.{{/if}}
{{#if low}}This caller prefers listening and shorter exchanges. Be concise, ask direct questions, and avoid excessive small talk.{{/if}}`,
    },
    {
      slug: "caller-engagement",
      name: "Caller Engagement Level",
      description: "Measures how actively engaged the caller is in the conversation",
      outputType: "MEASURE",
      domain: "engagement",
      priority: 15,
      triggers: [
        {
          name: "Measure Engagement",
          given: "A call transcript is being analyzed",
          when: "The caller shows varying levels of participation",
          then: "Score their engagement level",
          actions: [
            {
              description: "Count questions asked by the caller",
              parameterId: "engagement",
              weight: 0.3,
            },
            {
              description: "Evaluate response detail and elaboration",
              parameterId: "engagement",
              weight: 0.35,
            },
            {
              description: "Assess follow-up and clarifying behaviors",
              parameterId: "engagement",
              weight: 0.35,
            },
          ],
        },
      ],
      promptTemplate: `Caller engagement is {{label}} ({{value}}).
{{#if high}}Caller is highly engaged - explore topics deeper, offer additional insights.{{/if}}
{{#if low}}Caller seems disengaged - simplify, ask what would help, check if timing is bad.{{/if}}`,
    },
    {
      slug: "caller-rapport",
      name: "Caller Rapport",
      description: "Measures the quality of connection between caller and agent",
      outputType: "MEASURE",
      domain: "engagement",
      priority: 14,
      triggers: [
        {
          name: "Assess Rapport",
          given: "A conversation has occurred",
          when: "Analyzing interaction quality",
          then: "Score the rapport level",
          actions: [
            {
              description: "Evaluate mutual understanding indicators",
              parameterId: "rapport",
              weight: 0.4,
            },
            {
              description: "Assess warmth and friendliness signals",
              parameterId: "rapport",
              weight: 0.3,
            },
            {
              description: "Check for humor, appreciation, and positive acknowledgments",
              parameterId: "rapport",
              weight: 0.3,
            },
          ],
        },
      ],
    },
    {
      slug: "caller-satisfaction",
      name: "Caller Satisfaction",
      description: "Measures apparent caller satisfaction with the interaction",
      outputType: "MEASURE",
      domain: "outcome",
      priority: 20,
      triggers: [
        {
          name: "Evaluate Satisfaction",
          given: "A call has been completed",
          when: "Analyzing call outcome",
          then: "Score caller satisfaction",
          actions: [
            {
              description: "Check for gratitude expressions and positive closing",
              parameterId: "satisfaction",
              weight: 0.4,
            },
            {
              description: "Assess issue resolution status",
              parameterId: "satisfaction",
              weight: 0.35,
            },
            {
              description: "Evaluate tone throughout conversation",
              parameterId: "satisfaction",
              weight: 0.25,
            },
          ],
        },
      ],
    },
  ],

  // === LEARN Specs (Extract memories) ===
  learn: [
    {
      slug: "memory-personal-facts",
      name: "Extract Personal Facts",
      description: "Extracts factual information about the caller (location, job, company)",
      outputType: "LEARN",
      domain: "memory",
      priority: 12,
      triggers: [
        {
          name: "Extract Location",
          given: "The caller mentions where they are located",
          when: "Location information is stated or implied",
          then: "Extract and store the location fact",
          actions: [
            {
              description: "Extract city, state, country, or timezone information",
              learnCategory: "FACT" as MemoryCategory,
              learnKeyPrefix: "location",
              learnKeyHint: "Extract the specific location name (city, region, country)",
            },
          ],
        },
        {
          name: "Extract Job Info",
          given: "The caller mentions their work",
          when: "Job title, role, or company is mentioned",
          then: "Extract employment information",
          actions: [
            {
              description: "Extract job title or role",
              learnCategory: "FACT" as MemoryCategory,
              learnKeyPrefix: "job_title",
              learnKeyHint: "Extract their job title or role description",
            },
            {
              description: "Extract company or organization name",
              learnCategory: "FACT" as MemoryCategory,
              learnKeyPrefix: "company",
              learnKeyHint: "Extract the company or organization they work for",
            },
          ],
        },
      ],
      promptTemplate: `{{#if hasMemories}}Known facts about this caller:
{{#each memories.facts}}- {{this.key}}: {{this.value}}
{{/each}}{{/if}}`,
    },
    {
      slug: "memory-preferences",
      name: "Extract Caller Preferences",
      description: "Extracts stated preferences about communication, timing, and style",
      outputType: "LEARN",
      domain: "memory",
      priority: 11,
      triggers: [
        {
          name: "Extract Communication Preferences",
          given: "The caller expresses preferences about how to communicate",
          when: "They mention preferred contact method, timing, or style",
          then: "Store the preference",
          actions: [
            {
              description: "Extract preferred contact method (email, phone, chat)",
              learnCategory: "PREFERENCE" as MemoryCategory,
              learnKeyPrefix: "prefers_contact",
              learnKeyHint: "How they prefer to be contacted",
            },
            {
              description: "Extract preferred communication style (detailed, brief)",
              learnCategory: "PREFERENCE" as MemoryCategory,
              learnKeyPrefix: "prefers_style",
              learnKeyHint: "Their preferred communication style",
            },
            {
              description: "Extract preferred timing (morning, evening, weekday)",
              learnCategory: "PREFERENCE" as MemoryCategory,
              learnKeyPrefix: "prefers_timing",
              learnKeyHint: "When they prefer to be contacted",
            },
          ],
        },
      ],
      promptTemplate: `{{#if memories.preferences}}Caller preferences:
{{#each memories.preferences}}- {{this.key}}: {{this.value}}
{{/each}}{{/if}}`,
    },
    {
      slug: "memory-relationships",
      name: "Extract Relationships",
      description: "Extracts information about people the caller mentions (family, colleagues)",
      outputType: "LEARN",
      domain: "memory",
      priority: 10,
      triggers: [
        {
          name: "Extract Family Members",
          given: "The caller mentions family members",
          when: "They reference spouse, children, parents, siblings",
          then: "Store the relationship information",
          actions: [
            {
              description: "Extract family member name and relationship",
              learnCategory: "RELATIONSHIP" as MemoryCategory,
              learnKeyPrefix: "family",
              learnKeyHint: "Name and relationship (e.g., 'wife Sarah', 'son Jake')",
            },
          ],
        },
        {
          name: "Extract Colleagues",
          given: "The caller mentions work colleagues",
          when: "They reference coworkers, managers, or team members",
          then: "Store the professional relationship",
          actions: [
            {
              description: "Extract colleague name and role",
              learnCategory: "RELATIONSHIP" as MemoryCategory,
              learnKeyPrefix: "colleague",
              learnKeyHint: "Name and role (e.g., 'manager Tom', 'teammate Lisa')",
            },
          ],
        },
      ],
    },
    {
      slug: "memory-events",
      name: "Extract Events & Plans",
      description: "Extracts time-bound events, appointments, or plans the caller mentions",
      outputType: "LEARN",
      domain: "memory",
      priority: 9,
      triggers: [
        {
          name: "Extract Upcoming Events",
          given: "The caller mentions future events or plans",
          when: "They reference meetings, trips, deadlines, or appointments",
          then: "Store the event with timing",
          actions: [
            {
              description: "Extract the event and its timing",
              learnCategory: "EVENT" as MemoryCategory,
              learnKeyPrefix: "upcoming",
              learnKeyHint: "Event description and when (e.g., 'vacation next week', 'deadline Friday')",
            },
          ],
        },
        {
          name: "Extract Past Events",
          given: "The caller references something that happened",
          when: "They mention past meetings, calls, or incidents",
          then: "Store for context in future calls",
          actions: [
            {
              description: "Extract the past event reference",
              learnCategory: "EVENT" as MemoryCategory,
              learnKeyPrefix: "past",
              learnKeyHint: "What happened and approximately when",
            },
          ],
        },
      ],
    },
    {
      slug: "memory-topics",
      name: "Extract Discussion Topics",
      description: "Tracks topics the caller is interested in or frequently discusses",
      outputType: "LEARN",
      domain: "memory",
      priority: 8,
      triggers: [
        {
          name: "Extract Interest Topics",
          given: "The caller shows interest in specific topics",
          when: "They ask questions or discuss particular subjects",
          then: "Store the topic interest",
          actions: [
            {
              description: "Extract the topic of interest",
              learnCategory: "TOPIC" as MemoryCategory,
              learnKeyPrefix: "interested_in",
              learnKeyHint: "The topic they're interested in (e.g., 'pricing', 'integrations')",
            },
          ],
        },
      ],
    },
  ],

  // === ADAPT Specs (Track changes over time) ===
  adapt: [
    {
      slug: "adapt-engagement-delta",
      name: "Engagement Change Tracking",
      description: "Computes how engagement changed from the previous call",
      outputType: "ADAPT",
      domain: "engagement",
      priority: 5,
      triggers: [
        {
          name: "Calculate Engagement Delta",
          given: "This caller has had previous calls",
          when: "Current engagement score is available",
          then: "Compute the change from previous call",
          actions: [
            {
              description: "Calculate engagement delta (current - previous)",
              parameterId: "engagement-delta",
              weight: 1.0,
            },
          ],
        },
      ],
      promptTemplate: `Engagement trend: {{label}}
{{#if high}}Engagement is increasing - continue current approach, caller is more invested.{{/if}}
{{#if low}}Engagement is declining - investigate what's changed, adjust approach.{{/if}}`,
    },
    {
      slug: "adapt-rapport-delta",
      name: "Rapport Change Tracking",
      description: "Computes how rapport changed from the previous call",
      outputType: "ADAPT",
      domain: "engagement",
      priority: 5,
      triggers: [
        {
          name: "Calculate Rapport Delta",
          given: "This caller has had previous calls",
          when: "Current rapport score is available",
          then: "Compute the change from previous call",
          actions: [
            {
              description: "Calculate rapport delta (current - previous)",
              parameterId: "rapport-delta",
              weight: 1.0,
            },
          ],
        },
      ],
    },
    {
      slug: "adapt-rapport-goal",
      name: "Rapport Goal Progress",
      description: "Tracks progress toward the rapport goal of 0.8",
      outputType: "ADAPT",
      domain: "engagement",
      priority: 6,
      triggers: [
        {
          name: "Evaluate Rapport Goal",
          given: "A rapport goal is set for this caller",
          when: "Rapport has been measured",
          then: "Calculate progress toward goal",
          actions: [
            {
              description: "Calculate goal progress (current/target)",
              parameterId: "rapport-goal",
              weight: 1.0,
            },
          ],
        },
      ],
      promptTemplate: `Rapport goal progress: {{value}} (target: 0.8)
{{#if high}}Great progress! Maintain current approach.{{/if}}
{{#if low}}Below target - focus on building connection.{{/if}}`,
    },
  ],

  // === MEASURE_AGENT Specs (Score agent behavior) ===
  measureAgent: [
    {
      slug: "agent-warmth-measure",
      name: "Agent Warmth Assessment",
      description: "Measures how warm and friendly the agent was in the conversation",
      outputType: "MEASURE_AGENT",
      domain: "agent",
      priority: 8,
      triggers: [
        {
          name: "Assess Agent Warmth",
          given: "An agent-caller conversation has occurred",
          when: "Evaluating agent communication style",
          then: "Score the agent's warmth level",
          actions: [
            {
              description: "Evaluate greeting warmth and personalization",
              parameterId: "agent-warmth",
              weight: 0.35,
            },
            {
              description: "Check for name usage and personal references",
              parameterId: "agent-warmth",
              weight: 0.35,
            },
            {
              description: "Assess overall friendly tone throughout",
              parameterId: "agent-warmth",
              weight: 0.3,
            },
          ],
        },
      ],
    },
    {
      slug: "agent-empathy-measure",
      name: "Agent Empathy Assessment",
      description: "Measures how well the agent acknowledged and validated caller emotions",
      outputType: "MEASURE_AGENT",
      domain: "agent",
      priority: 9,
      triggers: [
        {
          name: "Assess Agent Empathy",
          given: "The caller expressed emotions or frustrations",
          when: "Evaluating agent emotional intelligence",
          then: "Score the agent's empathy demonstration",
          actions: [
            {
              description: "Check for emotional validation and acknowledgment",
              parameterId: "agent-empathy",
              weight: 0.4,
            },
            {
              description: "Evaluate supportive and understanding language",
              parameterId: "agent-empathy",
              weight: 0.35,
            },
            {
              description: "Assess follow-through on emotional concerns",
              parameterId: "agent-empathy",
              weight: 0.25,
            },
          ],
        },
      ],
    },
    {
      slug: "agent-directness-measure",
      name: "Agent Directness Assessment",
      description: "Measures how concise and direct the agent's responses were",
      outputType: "MEASURE_AGENT",
      domain: "agent",
      priority: 7,
      triggers: [
        {
          name: "Assess Agent Directness",
          given: "Agent provided responses during the call",
          when: "Evaluating response efficiency",
          then: "Score the agent's directness",
          actions: [
            {
              description: "Evaluate response conciseness and clarity",
              parameterId: "agent-directness",
              weight: 0.5,
            },
            {
              description: "Check for unnecessary filler or tangents",
              parameterId: "agent-directness",
              weight: 0.5,
            },
          ],
        },
      ],
    },
    {
      slug: "agent-memory-use-measure",
      name: "Agent Memory Utilization",
      description: "Measures how well the agent used caller history and memory",
      outputType: "MEASURE_AGENT",
      domain: "agent",
      priority: 10,
      triggers: [
        {
          name: "Assess Memory Usage",
          given: "The caller has previous interaction history",
          when: "Evaluating agent use of context",
          then: "Score how well agent leveraged memory",
          actions: [
            {
              description: "Check for references to previous conversations",
              parameterId: "agent-memory-use",
              weight: 0.4,
            },
            {
              description: "Evaluate use of known caller facts",
              parameterId: "agent-memory-use",
              weight: 0.35,
            },
            {
              description: "Assess continuity and context awareness",
              parameterId: "agent-memory-use",
              weight: 0.25,
            },
          ],
        },
      ],
    },
  ],
};

// ===========================================
// SAMPLE TRANSCRIPTS
// ===========================================

const SAMPLE_TRANSCRIPTS = [
  {
    source: "test-seed",
    externalId: "test-call-001",
    callerName: "Sarah Johnson",
    callerEmail: "sarah.j@example.com",
    transcript: `Agent: Hi Sarah! Great to hear from you again. I remember we were setting up that integration last time - how did that go?

Sarah: Oh hi! Yes, it went really well actually, thanks for remembering! The team loved it. I'm calling because we want to expand to more departments now. We're based in Austin, by the way, if that helps with timezone stuff.

Agent: That's fantastic news! Austin - great city. I'll note that down. So you're looking to roll this out to more teams?

Sarah: Exactly! My manager Tom thinks we should do the marketing team first. They're always asking about it. Oh, and I should mention - I'll be on vacation next week, so if we need to schedule anything, the week after would be better.

Agent: Perfect, I'll make a note about your vacation. Let me pull up some options for expanding your account. Do you prefer email updates or would you rather I call you with details?

Sarah: Email is best for me - I can review it with Tom before we commit to anything. This is so exciting! I really appreciate how easy you all make this process.

Agent: Happy to help, Sarah! I'll send over some expansion options by end of day. Have a wonderful vacation next week!`,
  },
  {
    source: "test-seed",
    externalId: "test-call-002",
    callerName: "Mike Chen",
    callerEmail: "mchen@techcorp.io",
    transcript: `Agent: Hello, how can I help you today?

Mike: Yeah, I need help with my account.

Agent: Of course. What seems to be the issue?

Mike: The billing is wrong. Again.

Agent: I'm sorry to hear that. Let me look into your billing right away. Can you tell me what you're seeing?

Mike: It's showing double charges. This is the third time this has happened.

Agent: I completely understand how frustrating that must be, especially dealing with this repeatedly. You shouldn't have to keep calling about this. Let me check your account and get this sorted out permanently.

Mike: Fine. I work at TechCorp and I don't have time to keep dealing with this.

Agent: I hear you, Mike. I can see the duplicate charges here. I'm going to fix this now and also set up a flag on your account so this doesn't happen again. Give me just a moment.

Mike: Okay.

Agent: Done - I've removed the duplicate charges and added a credit for the inconvenience. You should see the refund in 2-3 business days. Is there anything else I can help with today?

Mike: No, that's it. Thanks.`,
  },
  {
    source: "test-seed",
    externalId: "test-call-003",
    callerName: "Emily Rodriguez",
    callerEmail: "emily.r@startup.co",
    transcript: `Agent: Welcome! How can I assist you today?

Emily: Hi! I'm Emily from a small startup in San Francisco. We're looking at your enterprise plan and I have SO many questions!

Agent: Hi Emily! Great to meet you. I love the enthusiasm - startups are always exciting to work with. What would you like to know?

Emily: Okay so first - the API limits. We're a dev-heavy team, like 15 engineers, and we'd probably hit those limits pretty fast. Is there flexibility there? Also, my CTO wants to know about the security certifications. Oh! And can we get a trial for the whole team to try it out? We have a board meeting next month and I want to present some results.

Agent: Great questions! Let me take those one by one. For API limits, we definitely have flexibility for high-usage teams. On security, we're SOC 2 Type II certified which should cover your CTO's concerns. And yes, we can absolutely set up a team trial - especially with your board meeting timeline. Would two weeks be enough time to evaluate?

Emily: That would be perfect! My colleague Jake in engineering will probably be the main user during the trial. Can I add him?

Agent: Absolutely! I'll set up the trial now and you can add Jake directly. I'll also send over our security documentation for your CTO. Is there a specific integration you're most interested in testing?

Emily: We use a lot of different tools - mainly interested in the Slack integration and the API webhooks.

Agent: Perfect - those are popular choices. I'll make sure those are enabled on your trial. I'll follow up mid-trial to see how things are going with the board meeting coming up. Good luck with the presentation!

Emily: Thank you so much! This has been really helpful!`,
  },
];

// ===========================================
// MAIN SEED FUNCTION
// ===========================================

async function main() {
  console.log("🌱 Starting comprehensive test seed...\n");

  // 1. Create Tags
  console.log("📌 Creating tags...");
  const tags = ["Active", "MVP", "Test", "Big-Five"];
  for (const tagName of tags) {
    await prisma.tag.upsert({
      where: { id: tagName.toLowerCase() },
      update: {},
      create: {
        id: tagName.toLowerCase(),
        name: tagName,
        slug: tagName.toLowerCase(),
      },
    });
  }
  console.log(`   ✓ Created ${tags.length} tags`);

  // 2. Create Parameters
  console.log("\n📊 Creating parameters...");
  const allParams = [
    ...PARAMETERS.traits,
    ...PARAMETERS.states,
    ...PARAMETERS.behaviors,
    ...PARAMETERS.adapt,
    ...PARAMETERS.goals,
  ];

  for (const param of allParams) {
    await prisma.parameter.upsert({
      where: { parameterId: param.parameterId },
      update: param,
      create: param,
    });
  }
  console.log(`   ✓ Created ${allParams.length} parameters`);

  // 3. Add Scoring Anchors
  console.log("\n🎯 Creating scoring anchors...");
  let anchorCount = 0;
  for (const [parameterId, anchors] of Object.entries(SCORING_ANCHORS)) {
    // Delete existing anchors first
    await prisma.parameterScoringAnchor.deleteMany({
      where: { parameterId },
    });

    for (const anchor of anchors) {
      await prisma.parameterScoringAnchor.create({
        data: {
          parameterId,
          ...anchor,
        },
      });
      anchorCount++;
    }
  }
  console.log(`   ✓ Created ${anchorCount} scoring anchors`);

  // 4. Create Analysis Specs
  console.log("\n📋 Creating analysis specs...");
  const allSpecs = [
    ...ANALYSIS_SPECS.measure.map(s => ({ ...s, outputType: "MEASURE" })),
    ...ANALYSIS_SPECS.learn.map(s => ({ ...s, outputType: "LEARN" })),
    ...ANALYSIS_SPECS.adapt.map(s => ({ ...s, outputType: "ADAPT" })),
    ...ANALYSIS_SPECS.measureAgent.map(s => ({ ...s, outputType: "MEASURE_AGENT" })),
  ];

  let specCount = { MEASURE: 0, LEARN: 0, ADAPT: 0, MEASURE_AGENT: 0 };

  for (const specData of allSpecs) {
    const { triggers, ...specFields } = specData;

    // Upsert the spec
    const spec = await prisma.analysisSpec.upsert({
      where: { slug: specFields.slug },
      update: {
        name: specFields.name,
        description: specFields.description,
        domain: specFields.domain,
        priority: specFields.priority,
        promptTemplate: (specFields as any).promptTemplate,
        isActive: true,
        isDirty: true,
      },
      create: {
        slug: specFields.slug,
        name: specFields.name,
        description: specFields.description,
        outputType: specFields.outputType as any,
        domain: specFields.domain,
        priority: specFields.priority,
        promptTemplate: (specFields as any).promptTemplate,
        isActive: true,
        isDirty: true,
      },
    });

    specCount[specFields.outputType as keyof typeof specCount]++;

    // Delete existing triggers for clean recreation
    await prisma.analysisTrigger.deleteMany({
      where: { specId: spec.id },
    });

    // Create triggers and actions
    for (let i = 0; i < (triggers || []).length; i++) {
      const trigger = triggers![i];
      const createdTrigger = await prisma.analysisTrigger.create({
        data: {
          specId: spec.id,
          name: trigger.name,
          given: trigger.given,
          when: trigger.when,
          then: trigger.then,
          sortOrder: i,
        },
      });

      // Create actions
      for (let j = 0; j < (trigger.actions || []).length; j++) {
        const action = trigger.actions![j] as any;
        await prisma.analysisAction.create({
          data: {
            triggerId: createdTrigger.id,
            description: action.description,
            weight: action.weight || 1.0,
            parameterId: action.parameterId,
            learnCategory: action.learnCategory,
            learnKeyPrefix: action.learnKeyPrefix,
            learnKeyHint: action.learnKeyHint,
            sortOrder: j,
          },
        });
      }
    }
  }

  console.log(`   ✓ Created specs: ${specCount.MEASURE} MEASURE, ${specCount.LEARN} LEARN, ${specCount.ADAPT} ADAPT, ${specCount.MEASURE_AGENT} MEASURE_AGENT`);

  // 5. Create Sample Callers and Calls
  console.log("\n📞 Creating sample callers and calls...");
  for (const sample of SAMPLE_TRANSCRIPTS) {
    // Create or find caller
    let caller = await prisma.caller.findFirst({
      where: { email: sample.callerEmail },
    });

    if (!caller) {
      caller = await prisma.caller.create({
        data: {
          name: sample.callerName,
          email: sample.callerEmail,
          externalId: sample.callerEmail.split("@")[0],
        },
      });
    }

    // Create call if it doesn't exist
    const existingCall = await prisma.call.findFirst({
      where: { externalId: sample.externalId },
    });

    if (!existingCall) {
      await prisma.call.create({
        data: {
          source: sample.source,
          externalId: sample.externalId,
          transcript: sample.transcript,
          callerId: caller.id,
        },
      });
    }
  }
  console.log(`   ✓ Created ${SAMPLE_TRANSCRIPTS.length} sample calls with callers`);

  // 6. Create Analysis Profile
  console.log("\n📁 Creating analysis profile...");
  const profile = await prisma.analysisProfile.upsert({
    where: { id: "test-profile-comprehensive" },
    update: {
      name: "Comprehensive Test Profile",
      description: "Full test profile with MEASURE, LEARN, ADAPT, and MEASURE_AGENT specs",
    },
    create: {
      id: "test-profile-comprehensive",
      name: "Comprehensive Test Profile",
      description: "Full test profile with MEASURE, LEARN, ADAPT, and MEASURE_AGENT specs",
    },
  });
  console.log(`   ✓ Created analysis profile: "${profile.name}"`);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("✅ COMPREHENSIVE TEST SEED COMPLETE");
  console.log("=".repeat(60));
  console.log(`
📊 Parameters: ${allParams.length} total
   - TRAIT: 5 (Big Five)
   - STATE: 4 (engagement, rapport, satisfaction, clarity)
   - BEHAVIOR: 4 (warmth, directness, empathy, memory-use)
   - ADAPT: 2 (engagement-delta, rapport-delta)
   - GOAL: 2 (rapport-goal, satisfaction-goal)

🎯 Scoring Anchors: ${anchorCount} calibration examples

📋 Analysis Specs: ${Object.values(specCount).reduce((a, b) => a + b, 0)} total
   - MEASURE: ${specCount.MEASURE} (score caller traits)
   - LEARN: ${specCount.LEARN} (extract memories)
   - ADAPT: ${specCount.ADAPT} (track changes)
   - MEASURE_AGENT: ${specCount.MEASURE_AGENT} (score agent)

📞 Sample Data:
   - Callers: ${SAMPLE_TRANSCRIPTS.length}
   - Calls: ${SAMPLE_TRANSCRIPTS.length}

⚡ NEXT STEPS:
   1. Go to Analysis Specs page
   2. Click "Compile" on each spec (or "Compile All Active")
   3. Create a Compiled Set from the profile
   4. Run analysis on sample calls
  `);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
