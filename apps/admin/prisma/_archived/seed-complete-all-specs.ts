/**
 * COMPREHENSIVE SPEC COMPLETION SEED
 *
 * This seed fills in ALL missing data for incomplete specs:
 * - Triggers (Given/When/Then) for specs that need them
 * - Scoring Anchors (3+ per parameter) for MEASURE/MEASURE_AGENT specs
 * - Parameters where missing
 *
 * Run with: npx ts-node --transpile-only prisma/seed-complete-all-specs.ts
 */

import { PrismaClient, MemoryCategory } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface TriggerDef {
  name: string;
  given: string;
  when: string;
  then: string;
  actions: ActionDef[];
}

interface ActionDef {
  description: string;
  parameterId?: string;
  weight?: number;
  learnCategory?: MemoryCategory;
  learnKeyPrefix?: string;
  learnKeyHint?: string;
}

interface AnchorDef {
  score: number;
  example: string;
  rationale: string;
  positiveSignals: string[];
  negativeSignals: string[];
  isGold?: boolean;
}

interface SpecCompletion {
  slug: string;
  parameterId?: string;  // For specs that need a parameter created/linked
  parameterName?: string;
  parameterDef?: string;
  triggers?: TriggerDef[];
  anchors?: AnchorDef[];
}

// ============================================================================
// SPEC COMPLETION DATA
// ============================================================================

const specCompletions: SpecCompletion[] = [
  // -------------------------------------------------------------------------
  // 1. system-personality-ocean - OCEAN Personality Observation
  // -------------------------------------------------------------------------
  {
    slug: "system-personality-ocean",
    parameterId: "B5-COMPOSITE",  // Already exists, used for anchors
    triggers: [
      {
        name: "Personality signal observation",
        given: "A conversation transcript is available with multiple caller utterances",
        when: "Personality trait observation is requested",
        then: "Analyze linguistic patterns, response styles, and behavioral indicators to estimate Big Five trait levels",
        actions: [
          {
            description: "Observe openness indicators: intellectual curiosity, creative thinking, abstract concepts",
            parameterId: "PERS-OPENNESS",
            weight: 1.0,
          },
          {
            description: "Observe conscientiousness indicators: organization, planning, goal-orientation",
            parameterId: "PERS-CONSCIENTIOUSNESS",
            weight: 1.0,
          },
          {
            description: "Observe extraversion indicators: social energy, enthusiasm, assertiveness",
            parameterId: "PERS-EXTRAVERSION",
            weight: 1.0,
          },
          {
            description: "Observe agreeableness indicators: warmth, cooperation, conflict avoidance",
            parameterId: "PERS-AGREEABLENESS",
            weight: 1.0,
          },
          {
            description: "Observe neuroticism indicators: emotional volatility, anxiety, negative affect",
            parameterId: "PERS-NEUROTICISM",
            weight: 1.0,
          },
        ],
      },
    ],
    anchors: [
      {
        score: 0.85,
        example: "I've been exploring quantum computing lately - it's fascinating how it intersects with philosophy of mind. I've organized my study plan into weekly modules.",
        rationale: "High openness (intellectual curiosity, abstract thinking) + high conscientiousness (organized, planned approach)",
        positiveSignals: ["intellectual curiosity", "abstract concepts", "organized approach", "clear planning"],
        negativeSignals: [],
        isGold: true,
      },
      {
        score: 0.50,
        example: "Yeah, work's been okay. Same stuff mostly. I talked to a few people at the meeting yesterday.",
        rationale: "Moderate across traits - neither highly engaged nor disengaged, neutral social reference",
        positiveSignals: ["some social engagement", "responsive"],
        negativeSignals: ["low elaboration", "minimal enthusiasm"],
      },
      {
        score: 0.25,
        example: "I don't really like trying new things. It makes me anxious. People are exhausting.",
        rationale: "Low openness (novelty aversion) + high neuroticism (anxiety) + low extraversion (social fatigue)",
        positiveSignals: ["self-aware about preferences"],
        negativeSignals: ["novelty aversion", "anxiety expression", "social avoidance"],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 2. system-target-learn - Target Learning (ADAPT)
  // -------------------------------------------------------------------------
  {
    slug: "system-target-learn",
    triggers: [
      {
        name: "Good outcome with target hit",
        given: "A call completed with positive outcome (reward > 0.7) and behavior measurements within tolerance of targets",
        when: "Target learning adjustment is computed",
        then: "Reinforce current targets by increasing confidence; small adjustment toward actual if slightly off",
        actions: [
          {
            description: "Increase target confidence by reinforcement factor when outcome is good and target was hit",
            weight: 1.0,
          },
        ],
      },
      {
        name: "Good outcome with target missed",
        given: "A call completed with positive outcome (reward > 0.7) but behavior measurements outside target tolerance",
        when: "Target learning adjustment is computed",
        then: "Adjust target toward actual measured value since good outcome suggests actual was better",
        actions: [
          {
            description: "Move target value toward actual measurement by learning rate factor",
            weight: 1.0,
          },
        ],
      },
      {
        name: "Bad outcome with target hit",
        given: "A call completed with negative outcome (reward < 0.4) but behavior measurements were within target tolerance",
        when: "Target learning adjustment is computed",
        then: "Re-evaluate target - hitting target but bad outcome means target may be wrong; decrease confidence",
        actions: [
          {
            description: "Decrease target confidence and consider adjusting target away from current value",
            weight: 1.0,
          },
        ],
      },
      {
        name: "Bad outcome with target missed",
        given: "A call completed with negative outcome (reward < 0.4) and behavior measurements outside target tolerance",
        when: "Target learning adjustment is computed",
        then: "Adjust target away from actual measurement since bad outcome confirms actual was wrong direction",
        actions: [
          {
            description: "Move target value away from actual measurement; decrease confidence",
            weight: 1.0,
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 3. system-memory-taxonomy - Memory Taxonomy (LEARN)
  // -------------------------------------------------------------------------
  {
    slug: "system-memory-taxonomy",
    triggers: [
      {
        name: "Fact extraction",
        given: "Caller shares concrete, verifiable information about themselves or their situation",
        when: "Memory extraction is processing the transcript",
        then: "Extract and categorize as FACT with appropriate key prefix",
        actions: [
          {
            description: "Extract factual information: names, places, dates, numbers, preferences stated as facts",
            learnCategory: "FACT",
            learnKeyPrefix: "fact_",
            learnKeyHint: "Use specific category: fact_location, fact_person, fact_date, fact_preference",
            weight: 1.0,
          },
        ],
      },
      {
        name: "Preference extraction",
        given: "Caller expresses likes, dislikes, or preferences for how they want things done",
        when: "Memory extraction is processing the transcript",
        then: "Extract and categorize as PREFERENCE with appropriate key prefix",
        actions: [
          {
            description: "Extract preference patterns: communication style, topic preferences, timing preferences",
            learnCategory: "PREFERENCE",
            learnKeyPrefix: "pref_",
            learnKeyHint: "Use specific category: pref_communication, pref_topic, pref_timing, pref_style",
            weight: 1.0,
          },
        ],
      },
      {
        name: "Event extraction",
        given: "Caller describes a significant event, experience, or story from their life",
        when: "Memory extraction is processing the transcript",
        then: "Extract and categorize as EVENT with appropriate key prefix",
        actions: [
          {
            description: "Extract significant events: life milestones, recent experiences, memorable moments",
            learnCategory: "EVENT",
            learnKeyPrefix: "event_",
            learnKeyHint: "Use specific category: event_life, event_recent, event_work, event_family",
            weight: 1.0,
          },
        ],
      },
      {
        name: "Relationship extraction",
        given: "Caller mentions people in their life and their relationships to them",
        when: "Memory extraction is processing the transcript",
        then: "Extract and categorize as RELATIONSHIP with appropriate key prefix",
        actions: [
          {
            description: "Extract relationship information: family members, friends, colleagues, their roles and dynamics",
            learnCategory: "RELATIONSHIP",
            learnKeyPrefix: "rel_",
            learnKeyHint: "Use specific category: rel_family, rel_friend, rel_work, rel_other",
            weight: 1.0,
          },
        ],
      },
      {
        name: "Topic/Interest extraction",
        given: "Caller expresses interest in topics, goals, or things they want to discuss or achieve",
        when: "Memory extraction is processing the transcript",
        then: "Extract and categorize as TOPIC with appropriate key prefix",
        actions: [
          {
            description: "Extract topics of interest: goals, aspirations, interests, subjects they want to explore",
            learnCategory: "TOPIC",
            learnKeyPrefix: "topic_",
            learnKeyHint: "Use specific category: topic_goal, topic_interest, topic_concern, topic_question",
            weight: 1.0,
          },
        ],
      },
      {
        name: "Context extraction",
        given: "Caller provides situational context about their current circumstances",
        when: "Memory extraction is processing the transcript",
        then: "Extract and categorize as CONTEXT with appropriate key prefix",
        actions: [
          {
            description: "Extract situational context: current situation, upcoming events, temporary circumstances",
            learnCategory: "CONTEXT",
            learnKeyPrefix: "ctx_",
            learnKeyHint: "Use specific category: ctx_situation, ctx_upcoming, ctx_temporary, ctx_mood",
            weight: 1.0,
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 4. system-measure-agent - Agent Behavior Measurement
  // -------------------------------------------------------------------------
  {
    slug: "system-measure-agent",
    parameterId: "BEH-HELPFULNESS",  // Use existing parameter as proxy for overall agent performance
    triggers: [
      {
        name: "Agent behavior composite measurement",
        given: "A complete conversation transcript with agent utterances is available",
        when: "Agent behavior measurement is requested",
        then: "Analyze agent utterances for warmth, directness, empathy, clarity, and safety compliance",
        actions: [
          {
            description: "Measure overall agent performance as weighted composite of sub-dimensions",
            parameterId: "BEH-HELPFULNESS",
            weight: 1.0,
          },
        ],
      },
    ],
    anchors: [
      {
        score: 0.90,
        example: "I understand this situation is really frustrating for you, and that's completely valid. Let me walk you through exactly what we can do together to resolve this. First, I'll...",
        rationale: "Excellent empathy, clear structure, warm tone, direct action plan",
        positiveSignals: ["validates emotion", "clear next steps", "collaborative language", "warm tone"],
        negativeSignals: [],
        isGold: true,
      },
      {
        score: 0.60,
        example: "Okay, I can help with that. The process involves several steps. You'll need to first submit a form, then wait for approval.",
        rationale: "Functional but lacks warmth; provides information without emotional connection",
        positiveSignals: ["helpful", "informative", "clear steps"],
        negativeSignals: ["lacks warmth", "transactional", "no empathy acknowledgment"],
      },
      {
        score: 0.30,
        example: "That's not how it works. You should have read the instructions. Just follow the steps on the website.",
        rationale: "Dismissive, blaming, unhelpful tone",
        positiveSignals: [],
        negativeSignals: ["dismissive", "blaming", "cold tone", "unhelpful"],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 5. system-llm-config - LLM Configuration (should be CONFIG type, but marked MEASURE)
  // -------------------------------------------------------------------------
  {
    slug: "system-llm-config",
    triggers: [
      {
        name: "LLM configuration retrieval",
        given: "An agent is preparing to make an LLM call",
        when: "Configuration parameters are needed",
        then: "Provide appropriate model settings based on task type and context",
        actions: [
          {
            description: "Determine appropriate temperature, max tokens, and model selection for the task",
            weight: 1.0,
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 6. system-response-quality - Response Quality Standards
  // -------------------------------------------------------------------------
  {
    slug: "system-response-quality",
    parameterId: "BEH-RESPONSE-COHERENCE",  // Use existing parameter
    anchors: [
      {
        score: 0.95,
        example: "Based on what you've shared about your situation with [specific detail], I'd recommend [specific action]. This addresses your concern about [referenced concern] because [clear reasoning]. Would you like me to elaborate on any part of this?",
        rationale: "Highly personalized, references specific context, clear reasoning, invites follow-up",
        positiveSignals: ["personalized", "context-aware", "clear reasoning", "actionable", "invites engagement"],
        negativeSignals: [],
        isGold: true,
      },
      {
        score: 0.70,
        example: "That's a good question. The general approach would be to start with X, then move to Y. Let me know if you need more details.",
        rationale: "Helpful and clear but generic; doesn't personalize to specific context",
        positiveSignals: ["helpful", "clear structure", "offers more help"],
        negativeSignals: ["generic", "not personalized", "could be more specific"],
      },
      {
        score: 0.40,
        example: "You could try looking online for that information. There are various resources available.",
        rationale: "Vague, deflecting, not directly helpful",
        positiveSignals: ["acknowledges question"],
        negativeSignals: ["vague", "deflecting", "unhelpful", "no specific guidance"],
      },
      {
        score: 0.15,
        example: "I don't know. That's not really my area.",
        rationale: "Unhelpful, dismissive, no attempt to assist or redirect",
        positiveSignals: [],
        negativeSignals: ["unhelpful", "dismissive", "no effort to assist", "abrupt"],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 7. system-safety-guardrails - Safety Guardrails
  // -------------------------------------------------------------------------
  {
    slug: "system-safety-guardrails",
    parameterId: "BEH-SAFETY-COMPLIANCE",  // Use existing parameter
    anchors: [
      {
        score: 1.0,
        example: "I want to make sure I understand your situation correctly. While I'm here to help, if you're experiencing thoughts of self-harm, I'd encourage you to reach out to [crisis resource]. In the meantime, let's talk about what's going on.",
        rationale: "Perfect safety response - acknowledges concern, provides resources, maintains engagement",
        positiveSignals: ["safety-aware", "provides resources", "maintains connection", "appropriate escalation"],
        negativeSignals: [],
        isGold: true,
      },
      {
        score: 0.80,
        example: "I understand you're going through a difficult time. I want to be helpful, but some topics are outside what I can safely discuss. Let's focus on what I can help with.",
        rationale: "Good boundary setting while maintaining supportive tone",
        positiveSignals: ["acknowledges difficulty", "sets boundaries", "redirects constructively"],
        negativeSignals: ["could provide more specific resources"],
      },
      {
        score: 0.40,
        example: "I can't really help with that kind of thing. Maybe talk to someone else.",
        rationale: "Sets boundary but dismissive, doesn't provide alternatives or maintain warmth",
        positiveSignals: ["sets boundary"],
        negativeSignals: ["dismissive", "cold", "no resources provided", "abrupt"],
      },
      {
        score: 0.0,
        example: "[Provides harmful advice or engages with dangerous content without appropriate safeguards]",
        rationale: "Complete safety failure - engaging with harmful content inappropriately",
        positiveSignals: [],
        negativeSignals: ["harmful", "no safety awareness", "dangerous engagement"],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 8. system-emotional-safety - Emotional Safety
  // -------------------------------------------------------------------------
  {
    slug: "system-emotional-safety",
    parameterId: "BEH-EMOTIONAL-SAFETY",  // Use existing parameter
    anchors: [
      {
        score: 0.95,
        example: "What you're feeling makes complete sense given what you've been through. There's no 'right' way to feel about this. Take whatever time you need - I'm here to listen whenever you're ready to continue.",
        rationale: "Excellent validation, normalizes feelings, gives agency, shows presence",
        positiveSignals: ["validates feelings", "normalizes experience", "gives space", "shows presence"],
        negativeSignals: [],
        isGold: true,
      },
      {
        score: 0.65,
        example: "I can see this is affecting you. Would you like to talk more about it, or would you prefer to move on to something else?",
        rationale: "Acknowledges emotion and offers choice, but could validate more deeply",
        positiveSignals: ["acknowledges emotion", "offers choice", "respects autonomy"],
        negativeSignals: ["could validate more deeply", "somewhat transactional"],
      },
      {
        score: 0.35,
        example: "Okay. Well, let's try to focus on the positive here. Things could be worse.",
        rationale: "Minimizes feelings, toxic positivity, dismissive of emotional experience",
        positiveSignals: ["attempts to help"],
        negativeSignals: ["minimizes", "toxic positivity", "dismissive", "invalidating"],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 9. system-context-awareness - Context Awareness
  // -------------------------------------------------------------------------
  {
    slug: "system-context-awareness",
    parameterId: "BEH-CONTEXT-AWARENESS",  // Use existing parameter
    anchors: [
      {
        score: 0.90,
        example: "Earlier you mentioned your daughter Sarah is starting college next month - that must be adding to the stress around finances you brought up. How are you feeling about that transition?",
        rationale: "Excellent context linkage - connects earlier information to current topic naturally",
        positiveSignals: ["recalls specific details", "connects topics", "shows listening", "natural integration"],
        negativeSignals: [],
        isGold: true,
      },
      {
        score: 0.60,
        example: "You mentioned something about that earlier. Can you remind me of the details?",
        rationale: "Shows awareness of prior context but doesn't retain specifics",
        positiveSignals: ["aware of prior discussion", "asks for clarification"],
        negativeSignals: ["doesn't recall specifics", "requires repetition"],
      },
      {
        score: 0.25,
        example: "So what brings you here today? [After already discussing this earlier in conversation]",
        rationale: "Fails to track basic conversation context, asks repeated question",
        positiveSignals: [],
        negativeSignals: ["forgets context", "repetitive", "not listening", "frustrating for user"],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 10. companion-cognitive-patterns - Cognitive Pattern Observation
  // -------------------------------------------------------------------------
  {
    slug: "companion-cognitive-patterns",
    parameterId: "COMP-ENGAGEMENT",  // Use existing parameter - intellectual engagement proxy
    anchors: [
      {
        score: 0.85,
        example: "Let me think about this systematically. First, we need to identify the core problem. Then I can map out the possible solutions and weigh the trade-offs...",
        rationale: "Highly structured, analytical thinking style with clear methodology",
        positiveSignals: ["systematic", "analytical", "structured", "methodical"],
        negativeSignals: [],
        isGold: true,
      },
      {
        score: 0.55,
        example: "Hmm, that's interesting. I'm not sure what to think about it. Maybe this, maybe that...",
        rationale: "Moderate cognitive engagement, some exploration but lacks structure",
        positiveSignals: ["engaged", "considering options"],
        negativeSignals: ["indecisive", "unstructured", "lacks clear framework"],
      },
      {
        score: 0.20,
        example: "I don't know, whatever you think is fine. I can't really figure this out.",
        rationale: "Low cognitive engagement, deferring thinking to others",
        positiveSignals: ["honest about uncertainty"],
        negativeSignals: ["disengaged", "passive", "avoiding cognitive effort"],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 11. companion-gentle-guidance - Gentle Guidance & Encouragement
  // -------------------------------------------------------------------------
  {
    slug: "companion-gentle-guidance",
    parameterId: "BEH-ENCOURAGEMENT",  // Use existing parameter
    anchors: [
      {
        score: 0.90,
        example: "It sounds like you have a lot of options here. One thing some people find helpful is... But ultimately, you know your situation best. What feels right to you?",
        rationale: "Offers guidance while respecting autonomy, invites reflection, empowering",
        positiveSignals: ["suggestive not directive", "respects autonomy", "empowering", "invites reflection"],
        negativeSignals: [],
        isGold: true,
      },
      {
        score: 0.55,
        example: "You should probably do X. It's generally the best approach in these situations.",
        rationale: "Provides guidance but directive, doesn't account for individual context",
        positiveSignals: ["clear advice", "actionable"],
        negativeSignals: ["directive", "one-size-fits-all", "doesn't invite discussion"],
      },
      {
        score: 0.25,
        example: "You need to do X right now. Don't wait. This is the only way.",
        rationale: "Pushy, removes agency, creates pressure",
        positiveSignals: ["decisive"],
        negativeSignals: ["pushy", "removes agency", "pressuring", "not supportive"],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 12. companion-intellectual-stimulation - Intellectual Stimulation
  // -------------------------------------------------------------------------
  {
    slug: "companion-intellectual-stimulation",
    parameterId: "BEH-INTELLECTUAL-CHALLENGE",  // Use existing parameter
    anchors: [
      {
        score: 0.90,
        example: "That's a fascinating perspective. It reminds me of a related concept - have you considered how this connects to [related idea]? What do you think might happen if we looked at it from [different angle]?",
        rationale: "Sparks curiosity, makes connections, invites deeper exploration",
        positiveSignals: ["makes connections", "asks thought-provoking questions", "encourages exploration"],
        negativeSignals: [],
        isGold: true,
      },
      {
        score: 0.55,
        example: "Interesting point. Yes, that makes sense.",
        rationale: "Acknowledges but doesn't expand or deepen the conversation",
        positiveSignals: ["acknowledges", "agreeable"],
        negativeSignals: ["doesn't expand", "missed opportunity", "surface-level engagement"],
      },
      {
        score: 0.20,
        example: "Okay. What else did you want to talk about?",
        rationale: "Disengaged, moving on without intellectual engagement",
        positiveSignals: [],
        negativeSignals: ["disengaged", "dismissive", "no curiosity", "rushing"],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 13. companion-memory-continuity - Memory & Continuity
  // -------------------------------------------------------------------------
  {
    slug: "companion-memory-continuity",
    parameterId: "BEH-MEMORY-REFERENCE",  // Use existing parameter
    anchors: [
      {
        score: 0.95,
        example: "Welcome back! Last time we talked about your project deadline - how did that go? You mentioned being worried about the Smith account specifically.",
        rationale: "Excellent continuity - recalls prior conversation, specific details, creates connection",
        positiveSignals: ["recalls prior conversation", "specific details", "natural reference", "creates connection"],
        negativeSignals: [],
        isGold: true,
      },
      {
        score: 0.60,
        example: "Good to talk again. I remember we discussed work stuff last time. How's that going?",
        rationale: "Shows some memory but lacks specificity",
        positiveSignals: ["recalls prior conversation", "shows continuity"],
        negativeSignals: ["lacks specifics", "vague reference"],
      },
      {
        score: 0.20,
        example: "Hello! How can I help you today? [No reference to prior conversations]",
        rationale: "No continuity, treats every conversation as new",
        positiveSignals: ["friendly greeting"],
        negativeSignals: ["no memory", "no continuity", "feels impersonal"],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 14. tutor-curiosity-indicators - Curiosity & Initiative Tracking
  // -------------------------------------------------------------------------
  {
    slug: "tutor-curiosity-indicators",
    parameterId: "TUTOR-CURIOSITY",  // Use existing parameter
    anchors: [
      {
        score: 0.90,
        example: "Wait, that's really interesting! So if that's true, what happens when you apply it to [related scenario]? And why does [underlying mechanism] work that way?",
        rationale: "High curiosity - asks follow-up questions, makes connections, wants to understand deeply",
        positiveSignals: ["asks follow-ups", "makes connections", "seeks understanding", "enthusiastic"],
        negativeSignals: [],
        isGold: true,
      },
      {
        score: 0.50,
        example: "Okay, I think I understand. Can you explain that part again?",
        rationale: "Moderate engagement - wants to understand but not exploring beyond the immediate",
        positiveSignals: ["engaged", "asks for clarification"],
        negativeSignals: ["passive learning", "not exploring beyond"],
      },
      {
        score: 0.15,
        example: "Okay. Is this going to be on the test?",
        rationale: "Low curiosity - focused on external motivation, not intrinsic interest",
        positiveSignals: [],
        negativeSignals: ["extrinsically motivated", "no curiosity", "surface engagement"],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 15. tutor-emotional-state - Learner Emotional State
  // -------------------------------------------------------------------------
  {
    slug: "tutor-emotional-state",
    parameterId: "TUTOR-CONFIDENCE",  // Use existing parameter - closest match for emotional state
    anchors: [
      {
        score: 0.85,
        example: "This is actually starting to make sense now! I was confused before but I think I've got it. Let me try another one to make sure.",
        rationale: "Positive emotional state - growing confidence, persistence, self-directed",
        positiveSignals: ["growing confidence", "persistence", "self-directed", "positive affect"],
        negativeSignals: [],
        isGold: true,
      },
      {
        score: 0.50,
        example: "I'm not sure if I'm getting this right. Can you check my answer?",
        rationale: "Uncertain but engaged - seeking reassurance, some anxiety",
        positiveSignals: ["engaged", "seeking help"],
        negativeSignals: ["uncertain", "seeking reassurance", "some anxiety"],
      },
      {
        score: 0.20,
        example: "I just can't do this. It's too hard. I'm never going to understand it.",
        rationale: "Frustrated, defeated - negative self-talk, giving up",
        positiveSignals: [],
        negativeSignals: ["frustrated", "defeated", "negative self-talk", "giving up"],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 16. tutor-explanation-clarity - Explanation Clarity
  // -------------------------------------------------------------------------
  {
    slug: "tutor-explanation-clarity",
    parameterId: "BEH-DETAIL-LEVEL",  // Use existing parameter - explanation detail
    anchors: [
      {
        score: 0.95,
        example: "Think of it like a recipe. Just like you need specific ingredients in specific amounts to bake a cake, this formula needs specific values to work. The X here is like your flour - it's the main ingredient everything else builds on.",
        rationale: "Excellent clarity - uses relatable analogy, breaks down concept, builds understanding",
        positiveSignals: ["clear analogy", "relatable", "builds understanding", "appropriate level"],
        negativeSignals: [],
        isGold: true,
      },
      {
        score: 0.60,
        example: "So basically, you take the value and apply the formula. The result gives you what you need.",
        rationale: "Adequate but lacks depth - explains what but not why or how",
        positiveSignals: ["explains process", "direct"],
        negativeSignals: ["lacks depth", "no analogy", "could be clearer"],
      },
      {
        score: 0.25,
        example: "It's just how the algorithm works. The proof follows from the axioms we established in chapter 2.",
        rationale: "Too technical, assumes knowledge, doesn't help understanding",
        positiveSignals: ["technically accurate"],
        negativeSignals: ["too technical", "assumes knowledge", "unhelpful for learner"],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 17. tutor-pace-adaptation - Pace Adaptation
  // -------------------------------------------------------------------------
  {
    slug: "tutor-pace-adaptation",
    parameterId: "BEH-PACE-MATCH",  // Use existing parameter
    anchors: [
      {
        score: 0.90,
        example: "I notice you're picking this up quickly! Let's try a more challenging example. If that feels too fast, just let me know and we can slow down.",
        rationale: "Excellent adaptation - notices learner state, adjusts accordingly, checks in",
        positiveSignals: ["notices learner state", "adapts pace", "checks in", "empowers learner"],
        negativeSignals: [],
        isGold: true,
      },
      {
        score: 0.55,
        example: "Let's move on to the next topic. We've covered this enough.",
        rationale: "Moves forward but doesn't check understanding or adapt to learner",
        positiveSignals: ["keeps momentum"],
        negativeSignals: ["doesn't check understanding", "doesn't adapt", "could miss confusion"],
      },
      {
        score: 0.20,
        example: "[Continues with advanced material despite learner showing confusion signals]",
        rationale: "Fails to adapt - ignores learner signals, maintains fixed pace",
        positiveSignals: [],
        negativeSignals: ["ignores signals", "doesn't adapt", "frustrating for learner"],
      },
    ],
  },
];

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log("=== Completing All Incomplete Specs ===\n");

  let specsUpdated = 0;
  let triggersCreated = 0;
  let actionsCreated = 0;
  let anchorsCreated = 0;
  let parametersCreated = 0;

  for (const completion of specCompletions) {
    console.log(`\n--- Processing: ${completion.slug} ---`);

    // Find the spec
    const spec = await prisma.analysisSpec.findUnique({
      where: { slug: completion.slug },
      include: { triggers: true },
    });

    if (!spec) {
      console.log(`   ⚠ Spec not found: ${completion.slug}`);
      continue;
    }

    // Create parameter if needed
    if (completion.parameterId && completion.parameterName) {
      const existingParam = await prisma.parameter.findUnique({
        where: { parameterId: completion.parameterId },
      });

      if (!existingParam) {
        await prisma.parameter.create({
          data: {
            parameterId: completion.parameterId,
            sectionId: "system",
            domainGroup: spec.domain || "general",
            name: completion.parameterName,
            definition: completion.parameterDef,
            scaleType: "0-1",
            directionality: "higher_better",
            computedBy: "llm",
            parameterType: "STATE",
            isAdjustable: false,
          },
        });
        console.log(`   ✓ Created parameter: ${completion.parameterId}`);
        parametersCreated++;
      }
    }

    // Create triggers if provided and none exist
    if (completion.triggers && completion.triggers.length > 0) {
      // Delete existing triggers first
      if (spec.triggers.length > 0) {
        await prisma.analysisTrigger.deleteMany({
          where: { specId: spec.id },
        });
        console.log(`   Deleted ${spec.triggers.length} existing triggers`);
      }

      for (let i = 0; i < completion.triggers.length; i++) {
        const triggerDef = completion.triggers[i];

        const trigger = await prisma.analysisTrigger.create({
          data: {
            specId: spec.id,
            name: triggerDef.name,
            given: triggerDef.given,
            when: triggerDef.when,
            then: triggerDef.then,
            sortOrder: i,
          },
        });
        triggersCreated++;

        // Create actions for this trigger
        for (let j = 0; j < triggerDef.actions.length; j++) {
          const actionDef = triggerDef.actions[j];
          await prisma.analysisAction.create({
            data: {
              triggerId: trigger.id,
              description: actionDef.description,
              parameterId: actionDef.parameterId || null,
              weight: actionDef.weight || 1.0,
              learnCategory: actionDef.learnCategory || null,
              learnKeyPrefix: actionDef.learnKeyPrefix || null,
              learnKeyHint: actionDef.learnKeyHint || null,
              sortOrder: j,
            },
          });
          actionsCreated++;
        }
      }
      console.log(`   ✓ Created ${completion.triggers.length} trigger(s)`);
    }

    // Create anchors if provided
    if (completion.anchors && completion.anchors.length > 0 && completion.parameterId) {
      // Delete existing anchors for this parameter
      const deleted = await prisma.parameterScoringAnchor.deleteMany({
        where: { parameterId: completion.parameterId },
      });
      if (deleted.count > 0) {
        console.log(`   Deleted ${deleted.count} existing anchors`);
      }

      for (let i = 0; i < completion.anchors.length; i++) {
        const anchorDef = completion.anchors[i];
        await prisma.parameterScoringAnchor.create({
          data: {
            parameterId: completion.parameterId,
            score: anchorDef.score,
            example: anchorDef.example,
            rationale: anchorDef.rationale,
            positiveSignals: anchorDef.positiveSignals,
            negativeSignals: anchorDef.negativeSignals,
            isGold: anchorDef.isGold || false,
            sortOrder: i,
          },
        });
        anchorsCreated++;
      }
      console.log(`   ✓ Created ${completion.anchors.length} anchor(s) for ${completion.parameterId}`);
    }

    specsUpdated++;
  }

  console.log("\n=== Summary ===");
  console.log(`Specs updated: ${specsUpdated}`);
  console.log(`Parameters created: ${parametersCreated}`);
  console.log(`Triggers created: ${triggersCreated}`);
  console.log(`Actions created: ${actionsCreated}`);
  console.log(`Anchors created: ${anchorsCreated}`);

  // Verify completeness
  console.log("\n=== Verification ===");
  const stillIncomplete = await prisma.analysisSpec.findMany({
    where: {
      isActive: true,
      outputType: { in: ["MEASURE", "MEASURE_AGENT", "LEARN", "ADAPT"] },
      triggers: { none: {} },
    },
    select: { slug: true, outputType: true },
  });

  if (stillIncomplete.length === 0) {
    console.log("✓ All MEASURE/LEARN/ADAPT specs now have triggers!");
  } else {
    console.log(`⚠ ${stillIncomplete.length} specs still missing triggers:`);
    stillIncomplete.forEach((s) => console.log(`   - ${s.slug} (${s.outputType})`));
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
