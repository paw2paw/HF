/**
 * MVP: Cognitive Activation - Seed File
 *
 * Seeds the Cognitive Activation BDD story parameters, specs, and anchors.
 * User Story: "As a user, I want to be mentally active and involved as the
 * conversation advances, so that the session feels participatory rather than
 * like a lecture."
 *
 * Story ID: STORY-COG-ACT-001
 * Time Window: mid_session
 *
 * Parameters:
 * - MVP-ENGAGE (CP-004): Engagement Level - outcome measure
 * - MVP-CONV-DOM (CONV_DOM): Conversation Dominance - turn-taking balance
 * - MVP-TONE-ASSERT (TONE_ASSERT): Assertiveness - prompt style
 * - MVP-CONV-PACE (CONV_PACE): Conversation Pace - timing control
 */

import { PrismaClient, ParameterType, AnalysisOutputType, SpecificationScope } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================
// 1. MVP PARAMETERS
// ============================================

const mvpParameters = [
  // === CP-004: ENGAGEMENT LEVEL ===
  {
    parameterId: "MVP-ENGAGE",
    sectionId: "mvp-cognitive-activation",
    domainGroup: "conversational-purpose",
    name: "MVP: Engagement Level",
    definition: `Strength and persistence of user involvement in the conversation, evidenced by
turn-taking behaviour, elaboration depth, and follow-up contributions.

Calculated as weighted sum of submetrics:
- Response Rate (0.30): Proportion of prompts receiving substantive responses
- Elaboration Score (0.25): Mean word count of responses, normalized
- Follow-up Rate (0.25): Proportion of turns with unsolicited expansions
- Latency Score (0.20): Responsiveness based on response delay`,
    measurementMvp: `Formula: CP-004 = (0.30 × Response_Rate) + (0.25 × Elaboration_Score) + (0.25 × Follow_up_Rate) + (0.20 × Latency_Score)

Submetric calculations:
- Response_Rate = Substantive_Responses (>=8 words) / Total_System_Prompts
- Elaboration_Score = min(Mean_Word_Count / 40, 1.0)
- Follow_up_Rate = User_Initiated_Contributions / Total_Substantive_User_Turns
- Latency_Score = max(1.0 - (Mean_Latency_Seconds / 8), 0)

Fallback when timestamps unavailable: reweight to (0.375 × Response_Rate) + (0.3125 × Elaboration_Score) + (0.3125 × Follow_up_Rate)`,
    interpretationHigh: "User is highly engaged - responds substantively, elaborates, asks questions, responds quickly. Session feels participatory.",
    interpretationLow: "User is passive - minimal responses, little elaboration, no follow-up questions. Session feels like a lecture.",
    scaleType: "continuous",
    directionality: "positive",
    computedBy: "formula:weighted_submetrics",
    parameterType: "BEHAVIOR" as ParameterType,
    isAdjustable: true,
  },

  // === CONV_DOM: CONVERSATION DOMINANCE ===
  {
    parameterId: "MVP-CONV-DOM",
    sectionId: "mvp-cognitive-activation",
    domainGroup: "conversation-dynamics",
    name: "MVP: Conversation Dominance",
    definition: `Balance of conversational control between system and user.
Lower = user dominance; higher = system dominance.
Target reflects tutoring context where system leads but user participates.

Calculated as weighted sum:
- Word Share (0.40): Proportion of total words spoken by system
- Turn Share (0.30): Proportion of turns taken by system
- Initiative Share (0.30): Proportion of topic initiations by system`,
    measurementMvp: `Formula: CONV_DOM = (0.40 × Word_Share) + (0.30 × Turn_Share) + (0.30 × Initiative_Share)

Submetric calculations:
- Word_Share = System_Word_Count / Total_Word_Count
- Turn_Share = System_Turn_Count / Total_Turn_Count (exclude turns <5 words)
- Initiative_Share = System_Initiatives / Total_Initiatives

Initiative event = introducing topics, asking substantive questions, proposing progression`,
    interpretationHigh: "System dominated - lecture mode, agent talks too much, user is passive recipient. Risk: disengagement.",
    interpretationLow: "User dominated - agent provides minimal guidance, may lack structure or direction.",
    scaleType: "continuous",
    directionality: "neutral", // Target is balanced, not high or low
    computedBy: "formula:weighted_submetrics",
    parameterType: "BEHAVIOR" as ParameterType,
    isAdjustable: true,
  },

  // === TONE_ASSERT: ASSERTIVENESS ===
  {
    parameterId: "MVP-TONE-ASSERT",
    sectionId: "mvp-cognitive-activation",
    domainGroup: "persona-tone",
    name: "MVP: Assertiveness",
    definition: `Directiveness of system communication.
Lower = invitational/tentative; higher = directive/authoritative.
Target favours invitational tone to encourage participation.

CRITICAL LIMITATION: Measures linguistic markers only. Voice prosody not captured.

Calculated as weighted sum:
- Directive Ratio (0.40): Proportion of directive vs invitational sentences
- Hedge Inverse (0.30): Inverse of hedging language density
- Question Softness Inverse (0.30): Closed/directed vs open/soft questions`,
    measurementMvp: `Formula: TONE_ASSERT = (0.40 × Directive_Ratio) + (0.30 × Hedge_Inverse) + (0.30 × Question_Softness_Inverse)

Submetric calculations:
- Directive_Ratio = (Directive_Count + 0.5 × Neutral_Count) / Total_Sentences
  - Directive markers: imperatives, "you need to", "you should", leading questions
  - Invitational markers: open questions, "you could", "you might", "let's explore"
- Hedge_Inverse = 1.0 - min(Hedge_Density × 50, 1.0)
  - Hedge markers: "maybe", "perhaps", "sort of", "I think"
- Question_Softness_Inverse = 1.0 - (Soft_Questions / Total_Questions)
  - Softness scale: 1.0 (open) → 0.0 (leading)`,
    interpretationHigh: "Agent is directive/authoritative - may suppress user participation, create testing frame.",
    interpretationLow: "Agent is invitational/tentative - encourages participation but may lack clarity if too tentative.",
    scaleType: "continuous",
    directionality: "neutral", // Target is balanced
    computedBy: "formula:weighted_submetrics",
    parameterType: "BEHAVIOR" as ParameterType,
    isAdjustable: true,
  },

  // === CONV_PACE: CONVERSATION PACE ===
  {
    parameterId: "MVP-CONV-PACE",
    sectionId: "mvp-cognitive-activation",
    domainGroup: "conversation-dynamics",
    name: "MVP: Conversation Pace",
    definition: `Timing control for cognitive activation prompts.
Controls the cadence of system prompts that activate user thinking.

Used to determine:
- When to insert cognitive prompts (target: every 120-180 seconds)
- Maximum gap between prompts (240 seconds hard limit)
- Adjustment for content complexity`,
    measurementMvp: `Measure average gap between cognitive prompts in seconds.
Normalize to 0-1 scale where:
- 0.0 = very fast pace (prompts every <60 seconds)
- 0.5 = target pace (prompts every 120-180 seconds)
- 1.0 = very slow pace (prompts >300 seconds apart)

Formula: CONV_PACE = normalize(Mean_Prompt_Gap_Seconds, 60, 300, 0, 1)`,
    interpretationHigh: "Slow pace - long gaps between prompts, risk of user becoming passive.",
    interpretationLow: "Fast pace - frequent prompts, risk of overwhelming or interrupting user.",
    scaleType: "continuous",
    directionality: "neutral", // Target is balanced
    computedBy: "formula:prompt_cadence",
    parameterType: "BEHAVIOR" as ParameterType,
    isAdjustable: true,
  },
];

// ============================================
// 2. BDD STORY SPEC - Main Story Definition
// ============================================

const bddStorySpec = {
  slug: "mvp-story-cognitive-activation",
  name: "MVP: Mid-session Cognitive Activation",
  description: `BDD Story: Mid-session activates user thinking and participation

AS A user
I WANT to be mentally active and involved as the conversation advances
SO THAT the session feels participatory rather than like a lecture

Story ID: STORY-COG-ACT-001
Time Window: mid_session (after explicit topic framing, before session nearing completion)

MVP Parameters:
- MVP-ENGAGE (0.65-0.85): Engagement level - outcome measure
- MVP-CONV-DOM (0.40-0.55): Conversation dominance - turn-taking balance
- MVP-TONE-ASSERT (0.35-0.50): Assertiveness - invitation vs dictation
- MVP-CONV-PACE (0.40-0.60): Conversation pace - prompt timing control

Acceptance Criteria (MVP):
- AC-1: Cognitive activation cadence (prompt every 120-180s, max 240s gap)
- AC-2: Prompt quality constraints (open-ended, not yes/no)
- AC-3: Turn-taking constraints (max 2 consecutive system turns, max 120 words)
- AC-4: Advancement requires user input (no content progression without user response)
- AC-5: Non-lecture delivery (explanations interleaved with prompts)

Constraints:
- C-1: MUST NOT deliver >2 consecutive turns without user response
- C-2: MUST NOT deliver monologues >120 words (text) or 40 seconds (voice)
- C-3: MUST introduce cognitive prompt every 120-180 seconds (max 240s gap)
- C-4: All cognitive prompts MUST be open-ended
- C-5: MUST prompt for user input before advancing to next learning unit`,
  scope: "SYSTEM" as SpecificationScope,
  outputType: "MEASURE_AGENT" as AnalysisOutputType,
  domain: "mvp-cognitive-activation",
  priority: 100,
  isActive: true,
  config: {
    storyId: "STORY-COG-ACT-001",
    status: "draft",
    mvpScope: true,
    timeWindow: {
      name: "mid_session",
      startCondition: "After explicit topic framing by system",
      endCondition: "Before system signals session is nearing completion",
      exclusions: ["Minimal acknowledgements (mm-hmm, okay) do not count as turns"],
    },
    parameterTargets: {
      "MVP-ENGAGE": { min: 0.65, max: 0.85, role: "outcome_measure" },
      "MVP-CONV-DOM": { min: 0.40, max: 0.55, role: "turn_taking_balance" },
      "MVP-TONE-ASSERT": { min: 0.35, max: 0.50, role: "invitation_vs_dictation" },
      "MVP-CONV-PACE": { min: 0.40, max: 0.60, role: "prompt_timing_control" },
    },
    acceptanceCriteria: [
      {
        id: "AC-1",
        title: "Cognitive activation cadence",
        priority: "must",
        parameters: ["MVP-CONV-PACE", "MVP-ENGAGE"],
        given: "The user is mid-session",
        when: "The system advances the conversation",
        then: "The system introduces at least one cognitively activating prompt every 120-180 seconds",
        thresholds: {
          max_prompt_gap_seconds: { operator: "lte", value: 240 },
          min_engagement_level: { operator: "gte", value: 0.65 },
        },
      },
      {
        id: "AC-2",
        title: "Prompt quality constraints",
        priority: "must",
        parameters: ["MVP-TONE-ASSERT"],
        given: "The system introduces a cognitively activating prompt",
        when: "The user is invited to respond",
        then: "The prompt requires explanation, reflection, imagination, or opinion; is not answerable with yes/no",
        thresholds: {
          min_user_response_words: { operator: "gte", value: 15 },
        },
      },
      {
        id: "AC-3",
        title: "Turn-taking constraints",
        priority: "must",
        parameters: ["MVP-CONV-DOM", "MVP-CONV-PACE"],
        given: "The session is mid-session",
        when: "The system communicates",
        then: "System does not deliver >2 consecutive turns without user response; does not deliver explanations >120 words (text) or 40 seconds (voice)",
        thresholds: {
          max_consecutive_system_turns: { operator: "lte", value: 2 },
          max_monologue_words: { operator: "lte", value: 120 },
          max_monologue_seconds: { operator: "lte", value: 40 },
          conv_dom_min: { operator: "gte", value: 0.40 },
          conv_dom_max: { operator: "lte", value: 0.55 },
        },
      },
      {
        id: "AC-4",
        title: "Advancement requires user input",
        priority: "must",
        parameters: ["MVP-CONV-DOM", "MVP-ENGAGE"],
        given: "The system is about to introduce the next idea or example",
        when: "Advancing content",
        then: "System first asks for user input related to current idea and waits for response before proceeding",
      },
      {
        id: "AC-5",
        title: "Non-lecture delivery constraint",
        priority: "must",
        parameters: ["MVP-CONV-DOM", "MVP-TONE-ASSERT"],
        given: "The session is mid-session",
        when: "The system explains concepts",
        then: "Explanations are interleaved with user prompts; each explanation followed by participation opportunity within ≤2 system turns",
        thresholds: {
          min_interleaving_ratio: { operator: "gte", value: 1.0 },
          max_explanation_span: { operator: "lte", value: 2 },
        },
      },
    ],
    constraints: [
      { id: "C-1", type: "must_not", description: "System must not deliver more than 2 consecutive turns without user response" },
      { id: "C-2", type: "must_not", description: "System must not deliver monologues exceeding 120 words (text) or 40 seconds (voice)" },
      { id: "C-3", type: "must", description: "System must introduce cognitive prompt every 120-180 seconds (maximum gap: 240 seconds)" },
      { id: "C-4", type: "must", description: "All cognitive prompts must be open-ended (not answerable with yes/no)" },
      { id: "C-5", type: "must", description: "System must prompt for user input before advancing to next learning unit" },
    ],
    failureConditions: [
      { id: "F-1", severity: "critical", trigger: "MVP-ENGAGE below 0.50", action: "Investigate prompt quality and cadence" },
      { id: "F-2", severity: "critical", trigger: "MVP-CONV-DOM above 0.65", action: "Reduce turn length; increase prompts" },
      { id: "F-3", severity: "violation", trigger: "Consecutive system turns exceed 3", action: "Immediate intervention required" },
      { id: "F-4", severity: "warning", trigger: "User yes/no responses exceed 50%", action: "Review prompt formulation" },
    ],
    calibrationStatus: "provisional",
    assumptions: [
      { id: "A-1", status: "untested", description: "Cognitive activation is inferred from interaction patterns, not self-reported feelings" },
      { id: "A-2", status: "validated", description: "Mid-session operationally defined as: after topic framing, before completion signal" },
      { id: "A-3", status: "validated", description: "Turn counting excludes minimal acknowledgements (mm-hmm, okay)" },
      { id: "A-4", status: "provisional", description: "Timing references are approximate (±20% based on content complexity)" },
    ],
    deferredCriteria: [
      { id: "AC-6", reason: "Requires B5-A, TONE_WARM", dependency: "personality_layer" },
      { id: "AC-7", reason: "Requires B5-O", dependency: "personalisation_layer" },
      { id: "AC-8", reason: "Requires SAFE_CHALL", dependency: "quiet_user_story" },
    ],
  },
};

// ============================================
// 3. MEASUREMENT SPECS - Per-Parameter Analysis
// ============================================

const measurementSpecs = [
  {
    slug: "mvp-measure-engagement",
    name: "MVP: Measure Engagement Level",
    description: `Measures user engagement (MVP-ENGAGE) using weighted submetrics.

Submetrics with weights:
- Response Rate (0.30): substantive_responses / total_prompts
- Elaboration Score (0.25): normalized mean word count
- Follow-up Rate (0.25): user_initiated / total_substantive_turns
- Latency Score (0.20): responsiveness (optional if timestamps available)

Thresholds (provisional - require calibration):
- Substantive response: >=8 words
- Elaboration ceiling: 40 words
- Latency ceiling: 8 seconds`,
    scope: "SYSTEM" as SpecificationScope,
    outputType: "MEASURE_AGENT" as AnalysisOutputType,
    domain: "mvp-cognitive-activation",
    priority: 90,
    isActive: true,
    config: {
      parameterId: "MVP-ENGAGE",
      measurementType: "weighted_submetrics",
      submetrics: {
        response_rate: {
          weight: 0.30,
          formula: "substantive_responses / total_system_prompts",
          thresholds: { substantive_word_minimum: 8 },
        },
        elaboration_score: {
          weight: 0.25,
          formula: "min(mean_word_count / normalisation_ceiling, 1.0)",
          thresholds: { normalisation_ceiling: 40 },
        },
        follow_up_rate: {
          weight: 0.25,
          formula: "user_initiated_contributions / total_substantive_user_turns",
        },
        latency_score: {
          weight: 0.20,
          formula: "max(1.0 - (mean_latency_seconds / latency_ceiling), 0)",
          thresholds: { latency_ceiling_seconds: 8 },
          optional: true,
        },
      },
      fallbackFormula: "(0.375 × response_rate) + (0.3125 × elaboration_score) + (0.3125 × follow_up_rate)",
      fallbackCondition: "timestamps_unavailable",
      targetRange: { min: 0.65, max: 0.85 },
      actionThresholds: {
        exceeds: { min: 0.85, action: "Maintain approach" },
        on_target: { min: 0.65, max: 0.84, action: "No intervention" },
        below_target: { min: 0.50, max: 0.64, action: "Review prompt quality" },
        critical: { max: 0.49, action: "Investigate root cause" },
      },
    },
    promptTemplate: `Analyze the transcript to measure user engagement level.

Count the following:
1. Total system prompts (questions or invitations to respond)
2. Substantive user responses (>=8 words, excluding "mm-hmm", "okay", "yes", etc.)
3. User-initiated contributions (questions asked, examples offered, topic extensions)
4. Mean word count of substantive responses

Calculate:
- Response Rate = Substantive Responses / Total Prompts
- Elaboration Score = min(Mean Word Count / 40, 1.0)
- Follow-up Rate = User-Initiated / Total Substantive Turns

Output engagement score as: (0.30 × Response_Rate) + (0.25 × Elaboration_Score) + (0.25 × Follow_up_Rate) + (0.20 × 0.5)

Note: Use 0.5 as default latency score if timestamps unavailable.`,
  },
  {
    slug: "mvp-measure-conversation-dominance",
    name: "MVP: Measure Conversation Dominance",
    description: `Measures system vs user dominance (MVP-CONV-DOM).

Submetrics with weights:
- Word Share (0.40): system_words / total_words
- Turn Share (0.30): system_turns / total_turns (exclude <5 word turns)
- Initiative Share (0.30): system_initiatives / total_initiatives

Target: 0.40-0.55 (balanced, system slightly leading)
Above 0.65: Lecture mode risk
Below 0.35: Insufficient guidance risk`,
    scope: "SYSTEM" as SpecificationScope,
    outputType: "MEASURE_AGENT" as AnalysisOutputType,
    domain: "mvp-cognitive-activation",
    priority: 90,
    isActive: true,
    config: {
      parameterId: "MVP-CONV-DOM",
      measurementType: "weighted_submetrics",
      submetrics: {
        word_share: {
          weight: 0.40,
          formula: "system_word_count / total_word_count",
        },
        turn_share: {
          weight: 0.30,
          formula: "system_turn_count / total_turn_count",
          note: "Exclude turns under 5 words to filter back-channel",
        },
        initiative_share: {
          weight: 0.30,
          formula: "system_initiatives / total_initiatives",
          definition: "Initiative = introducing topics, asking substantive questions, proposing progression",
        },
      },
      targetRange: { min: 0.40, max: 0.55 },
      actionThresholds: {
        user_dominated: { max: 0.30, action: "Ensure adequate guidance" },
        lower_bound: { min: 0.30, max: 0.45, action: "Acceptable; monitor" },
        on_target: { min: 0.45, max: 0.55, action: "Optimal balance" },
        above_target: { min: 0.55, max: 0.65, action: "Reduce turn length; add prompts" },
        lecture_mode: { min: 0.65, action: "Critical: restructure delivery" },
      },
    },
    promptTemplate: `Analyze the transcript to measure conversation dominance.

Count:
1. System word count (all words in system turns)
2. User word count (all words in user turns)
3. System turns (exclude turns <5 words)
4. User turns (exclude turns <5 words)
5. System initiatives (topic introductions, substantive questions, progression proposals)
6. User initiatives (questions asked, topics raised)

Calculate:
- Word Share = System Words / (System Words + User Words)
- Turn Share = System Turns / (System Turns + User Turns)
- Initiative Share = System Initiatives / (System Initiatives + User Initiatives)

Output dominance score as: (0.40 × Word_Share) + (0.30 × Turn_Share) + (0.30 × Initiative_Share)`,
  },
  {
    slug: "mvp-measure-assertiveness",
    name: "MVP: Measure Assertiveness",
    description: `Measures directive vs invitational tone (MVP-TONE-ASSERT).

Submetrics with weights:
- Directive Ratio (0.40): proportion of directive sentences
- Hedge Inverse (0.30): inverse of hedging language density
- Question Softness Inverse (0.30): closed vs open question ratio

Target: 0.35-0.50 (invitational, encouraging participation)
Above 0.65: May suppress participation
Below 0.25: May lack clarity`,
    scope: "SYSTEM" as SpecificationScope,
    outputType: "MEASURE_AGENT" as AnalysisOutputType,
    domain: "mvp-cognitive-activation",
    priority: 90,
    isActive: true,
    config: {
      parameterId: "MVP-TONE-ASSERT",
      measurementType: "weighted_submetrics",
      submetrics: {
        directive_ratio: {
          weight: 0.40,
          formula: "(directive_count + 0.5 × neutral_count) / total_sentences",
          markers: {
            directive: ["imperatives", "you need to", "you should", "you must", "leading questions"],
            invitational: ["open questions", "you could", "you might", "let's explore", "what if we"],
            lets_framing: "Classified as mildly directive (0.3)",
          },
        },
        hedge_inverse: {
          weight: 0.30,
          formula: "1.0 - min(hedge_density × 50, 1.0)",
          markers: ["maybe", "perhaps", "sort of", "kind of", "I think", "sometimes", "possibly", "might", "could be"],
        },
        question_softness_inverse: {
          weight: 0.30,
          formula: "1.0 - (soft_questions / total_questions)",
          softnessScale: {
            1.0: "open_ended (What do you think? How would you describe...?)",
            0.8: "exploratory (What might happen if...?)",
            0.4: "guided (What's the relationship between X and Y?)",
            0.2: "closed (Is that correct? Was it helpful?)",
            0.1: "yes_no (Did you...? Are you...?)",
            0.0: "leading (Don't you agree that...?)",
          },
        },
      },
      targetRange: { min: 0.35, max: 0.50 },
      actionThresholds: {
        too_tentative: { max: 0.25, action: "May lack clarity" },
        lower_bound: { min: 0.25, max: 0.35, action: "Acceptable if engagement high" },
        on_target: { min: 0.35, max: 0.50, action: "Optimal for participation" },
        above_target: { min: 0.50, max: 0.65, action: "Reduce directive framing" },
        too_assertive: { min: 0.65, action: "Risk of suppressing participation" },
      },
    },
    promptTemplate: `Analyze the transcript to measure assertiveness level.

For system turns only, classify each sentence:
1. Directive: imperatives, "you need to", "you should", "you must", leading questions
2. Invitational: open questions, "you could", "you might", "let's explore", collaborative framing
3. Neutral: statements that are neither

Count hedge markers: "maybe", "perhaps", "sort of", "kind of", "I think", "sometimes"

Classify each system question by softness:
- Open-ended (1.0): "What do you think?"
- Exploratory (0.8): "What might happen if...?"
- Guided (0.4): "What's the relationship between X and Y?"
- Closed (0.2): "Is that correct?"
- Yes/No (0.1): "Did you...?"
- Leading (0.0): "Don't you agree that...?"

Calculate:
- Directive Ratio = (Directive + 0.5 × Neutral) / Total Sentences
- Hedge Density = Hedge Markers / Total System Words
- Hedge Inverse = 1.0 - min(Hedge Density × 50, 1.0)
- Question Softness = Mean(question softness scores)
- Question Softness Inverse = 1.0 - Question Softness

Output assertiveness as: (0.40 × Directive_Ratio) + (0.30 × Hedge_Inverse) + (0.30 × Question_Softness_Inverse)`,
  },
  {
    slug: "mvp-measure-conversation-pace",
    name: "MVP: Measure Conversation Pace",
    description: `Measures prompt cadence timing (MVP-CONV-PACE).

Calculates average gap between cognitive prompts.
Target: prompts every 120-180 seconds (0.40-0.60 normalized)
Maximum gap: 240 seconds (constraint violation)

Normalization: 60s=0.0, 180s=0.5, 300s=1.0`,
    scope: "SYSTEM" as SpecificationScope,
    outputType: "MEASURE_AGENT" as AnalysisOutputType,
    domain: "mvp-cognitive-activation",
    priority: 90,
    isActive: true,
    config: {
      parameterId: "MVP-CONV-PACE",
      measurementType: "timing_analysis",
      calculation: {
        metric: "mean_prompt_gap_seconds",
        normalization: { min_seconds: 60, max_seconds: 300, min_score: 0.0, max_score: 1.0 },
      },
      targetRange: { min: 0.40, max: 0.60 },
      constraints: {
        max_gap_seconds: 240,
        target_gap_seconds: { min: 120, max: 180 },
      },
      cognitivePromptDefinition: "A prompt requiring explanation, reflection, imagination, or opinion - not answerable with yes/no",
    },
    promptTemplate: `Analyze the transcript to measure conversation pace.

Identify cognitive prompts: system turns that invite substantive user response.
A cognitive prompt:
- Requires explanation, reflection, imagination, or opinion
- Cannot be answered with "yes" or "no" alone
- Examples: "What do you think about...?", "How would you describe...?", "Tell me about..."

If timestamps available:
1. Note timestamp of each cognitive prompt
2. Calculate gaps between consecutive prompts (in seconds)
3. Compute mean gap

If timestamps unavailable:
1. Count cognitive prompts
2. Estimate session duration from word count (assume ~150 words/minute)
3. Calculate estimated mean gap

Normalize: score = (mean_gap - 60) / (300 - 60)
Clamp to 0.0-1.0 range.

Flag if any gap exceeds 240 seconds (constraint violation).`,
  },
];

// ============================================
// 4. SCORING ANCHORS - Calibration Examples
// ============================================

const scoringAnchors = [
  // Engagement Level anchors
  {
    parameterId: "MVP-ENGAGE",
    score: 0.85,
    example: `System: "What strategies have you tried so far to address this?"
User: "Well, I've been trying to use the Pomodoro technique but I keep getting distracted by my phone. I've also tried putting it in another room but then I worry I'll miss something important. Maybe I need to find some kind of middle ground? What do you think about app blockers - have those worked for other people?"`,
    rationale: "High engagement: substantive response (50+ words), elaboration with specific examples, asks follow-up question unprompted",
    positiveSignals: ["Long response", "Specific examples", "Self-reflection", "Follow-up question", "Asks for input"],
    negativeSignals: [],
  },
  {
    parameterId: "MVP-ENGAGE",
    score: 0.65,
    example: `System: "What strategies have you tried so far to address this?"
User: "I've tried the Pomodoro technique but it doesn't really work for me. I get distracted too easily I think."`,
    rationale: "Target engagement: substantive response (20 words), some elaboration, basic self-reflection but no follow-up",
    positiveSignals: ["Substantive response", "Some detail", "Self-awareness"],
    negativeSignals: ["No follow-up question", "Limited elaboration"],
  },
  {
    parameterId: "MVP-ENGAGE",
    score: 0.40,
    example: `System: "What strategies have you tried so far to address this?"
User: "Not really anything specific."`,
    rationale: "Low engagement: minimal response (5 words), no elaboration, no follow-up",
    positiveSignals: ["Did respond"],
    negativeSignals: ["Very brief", "No detail", "No engagement with question"],
  },

  // Conversation Dominance anchors
  {
    parameterId: "MVP-CONV-DOM",
    score: 0.50,
    example: `System: "Let's explore that further. What aspects interest you most?" (10 words)
User: "I'm really curious about how the feedback loops work in practice." (12 words)
System: "Great question. The feedback loops..." (brief explanation, 40 words)
User: "That makes sense. So if I apply that to my situation..." (continues, 25 words)`,
    rationale: "Balanced dominance: roughly equal word counts, both parties initiating, natural back-and-forth",
    positiveSignals: ["Balanced word count", "User initiates ideas", "System asks questions"],
    negativeSignals: [],
  },
  {
    parameterId: "MVP-CONV-DOM",
    score: 0.70,
    example: `System: "The key concept here is that cognitive load affects learning in three ways. First, intrinsic load relates to the complexity of the material itself. Second, extraneous load comes from poor instructional design. Third, germane load is the productive effort of schema construction. When we combine these..." (continues for 150 words)
User: "Okay."
System: "Now, let me explain how this applies..." (another 100 words)`,
    rationale: "System dominated: long monologues, minimal user contribution, lecture pattern",
    positiveSignals: [],
    negativeSignals: ["Long system turns", "Minimal user response", "No user questions", "Lecture pattern"],
  },

  // Assertiveness anchors
  {
    parameterId: "MVP-TONE-ASSERT",
    score: 0.42,
    example: `System: "What's your sense of how that might work in your situation? I'm curious what aspects seem most relevant to you."`,
    rationale: "Target assertiveness: invitational framing, open question, hedged with 'might' and 'I'm curious'",
    positiveSignals: ["Open question", "Invitational", "Hedge words", "Curiosity framing"],
    negativeSignals: [],
  },
  {
    parameterId: "MVP-TONE-ASSERT",
    score: 0.70,
    example: `System: "You need to focus on the three main principles I explained. Make sure you understand each one before moving on. Do you understand?"`,
    rationale: "High assertiveness: directive language ('you need to', 'make sure'), closed question at end",
    positiveSignals: [],
    negativeSignals: ["Directive language", "Imperative", "Closed question", "Testing frame"],
  },
];

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function main() {
  console.log("🌱 Seeding MVP: Cognitive Activation Story...\n");

  // 1. Create Parameters
  console.log("📐 Creating MVP Parameters...");
  for (const param of mvpParameters) {
    await prisma.parameter.upsert({
      where: { parameterId: param.parameterId },
      update: {
        name: param.name,
        definition: param.definition,
        measurementMvp: param.measurementMvp,
        interpretationHigh: param.interpretationHigh,
        interpretationLow: param.interpretationLow,
        scaleType: param.scaleType,
        directionality: param.directionality,
        computedBy: param.computedBy,
        parameterType: param.parameterType,
        isAdjustable: param.isAdjustable,
      },
      create: {
        parameterId: param.parameterId,
        sectionId: param.sectionId,
        domainGroup: param.domainGroup,
        name: param.name,
        definition: param.definition,
        measurementMvp: param.measurementMvp,
        interpretationHigh: param.interpretationHigh,
        interpretationLow: param.interpretationLow,
        scaleType: param.scaleType,
        directionality: param.directionality,
        computedBy: param.computedBy,
        parameterType: param.parameterType,
        isAdjustable: param.isAdjustable,
      },
    });
    console.log(`   ✓ ${param.parameterId}: ${param.name}`);
  }

  // 2. Create MVP Tag
  console.log("\n🏷️  Creating MVP tag...");
  await prisma.tag.upsert({
    where: { id: "mvp" },
    update: { name: "MVP", tone: "brand" },
    create: { id: "mvp", name: "MVP", slug: "mvp", tone: "brand" },
  });

  // Tag all MVP parameters
  for (const param of mvpParameters) {
    await prisma.parameterTag.upsert({
      where: {
        parameterId_tagId: {
          parameterId: param.parameterId,
          tagId: "mvp",
        },
      },
      update: {},
      create: {
        id: `${param.parameterId}-mvp`,
        parameterId: param.parameterId,
        tagId: "mvp",
      },
    });
  }
  console.log("   ✓ Tagged all MVP parameters");

  // 3. Create BDD Story Spec
  console.log("\n📖 Creating BDD Story Spec...");
  await prisma.analysisSpec.upsert({
    where: { slug: bddStorySpec.slug },
    update: {
      name: bddStorySpec.name,
      description: bddStorySpec.description,
      scope: bddStorySpec.scope,
      outputType: bddStorySpec.outputType,
      domain: bddStorySpec.domain,
      priority: bddStorySpec.priority,
      isActive: bddStorySpec.isActive,
      config: bddStorySpec.config,
    },
    create: {
      slug: bddStorySpec.slug,
      name: bddStorySpec.name,
      description: bddStorySpec.description,
      scope: bddStorySpec.scope,
      outputType: bddStorySpec.outputType,
      domain: bddStorySpec.domain,
      priority: bddStorySpec.priority,
      isActive: bddStorySpec.isActive,
      isDirty: false,
      config: bddStorySpec.config,
    },
  });
  console.log(`   ✓ ${bddStorySpec.slug}`);

  // 4. Create Measurement Specs
  console.log("\n📊 Creating Measurement Specs...");
  for (const spec of measurementSpecs) {
    await prisma.analysisSpec.upsert({
      where: { slug: spec.slug },
      update: {
        name: spec.name,
        description: spec.description,
        scope: spec.scope,
        outputType: spec.outputType,
        domain: spec.domain,
        priority: spec.priority,
        isActive: spec.isActive,
        config: spec.config,
        promptTemplate: spec.promptTemplate,
      },
      create: {
        slug: spec.slug,
        name: spec.name,
        description: spec.description,
        scope: spec.scope,
        outputType: spec.outputType,
        domain: spec.domain,
        priority: spec.priority,
        isActive: spec.isActive,
        isDirty: false,
        config: spec.config,
        promptTemplate: spec.promptTemplate,
      },
    });
    console.log(`   ✓ ${spec.slug}`);
  }

  // 5. Create Scoring Anchors
  console.log("\n⚓ Creating Scoring Anchors...");
  for (const anchor of scoringAnchors) {
    // Find the parameter
    const param = await prisma.parameter.findUnique({
      where: { parameterId: anchor.parameterId },
    });

    if (!param) {
      console.log(`   ⚠ Skipping anchor for ${anchor.parameterId} - parameter not found`);
      continue;
    }

    // Find existing anchor for this parameter/score combo
    const existingAnchor = await prisma.parameterScoringAnchor.findFirst({
      where: {
        parameterId: anchor.parameterId,
        score: anchor.score,
      },
    });

    if (existingAnchor) {
      await prisma.parameterScoringAnchor.update({
        where: { id: existingAnchor.id },
        data: {
          example: anchor.example,
          rationale: anchor.rationale,
          positiveSignals: anchor.positiveSignals,
          negativeSignals: anchor.negativeSignals,
        },
      });
    } else {
      await prisma.parameterScoringAnchor.create({
        data: {
          parameterId: anchor.parameterId,
          score: anchor.score,
          example: anchor.example,
          rationale: anchor.rationale,
          positiveSignals: anchor.positiveSignals,
          negativeSignals: anchor.negativeSignals,
          source: "seed",
        },
      });
    }
    console.log(`   ✓ ${anchor.parameterId} @ ${anchor.score}`);
  }

  // 6. Create default BehaviorTargets at SYSTEM scope
  console.log("\n🎯 Creating default BehaviorTargets...");
  const defaultTargets = [
    { parameterId: "MVP-ENGAGE", targetValue: 0.75, min: 0.65, max: 0.85 },
    { parameterId: "MVP-CONV-DOM", targetValue: 0.475, min: 0.40, max: 0.55 },
    { parameterId: "MVP-TONE-ASSERT", targetValue: 0.425, min: 0.35, max: 0.50 },
    { parameterId: "MVP-CONV-PACE", targetValue: 0.50, min: 0.40, max: 0.60 },
  ];

  for (const target of defaultTargets) {
    // Find existing SYSTEM-scope target for this parameter
    const existingTarget = await prisma.behaviorTarget.findFirst({
      where: {
        parameterId: target.parameterId,
        scope: "SYSTEM",
        playbookId: null,
        segmentId: null,
        callerIdentityId: null,
        effectiveUntil: null, // Only active targets
      },
    });

    if (existingTarget) {
      await prisma.behaviorTarget.update({
        where: { id: existingTarget.id },
        data: {
          targetValue: target.targetValue,
          confidence: 0.7, // Provisional
        },
      });
    } else {
      await prisma.behaviorTarget.create({
        data: {
          parameterId: target.parameterId,
          scope: "SYSTEM",
          targetValue: target.targetValue,
          confidence: 0.7,
          source: "MANUAL",
        },
      });
    }
    console.log(`   ✓ ${target.parameterId}: ${target.targetValue} (${target.min}-${target.max})`);
  }

  console.log("\n✅ MVP: Cognitive Activation seeding complete!\n");
  console.log("Created:");
  console.log(`  - ${mvpParameters.length} Parameters (tagged as MVP)`);
  console.log(`  - 1 BDD Story Spec`);
  console.log(`  - ${measurementSpecs.length} Measurement Specs`);
  console.log(`  - ${scoringAnchors.length} Scoring Anchors`);
  console.log(`  - ${defaultTargets.length} Default BehaviorTargets (SYSTEM scope)`);
}

main()
  .catch((e) => {
    console.error("Error seeding MVP Cognitive Activation:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
