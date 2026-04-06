/**
 * Lesson Plan Model Definitions
 *
 * Five pedagogical models, each defining session patterns, phase templates,
 * and TP distribution hints. Used by generate-plan AI prompt and runtime
 * phase rendering.
 */

import type { LessonPlanModel, LessonPlanModelDefinition, PhaseTemplate } from "./types";

// ---------------------------------------------------------------------------
// Shared phase building blocks
// ---------------------------------------------------------------------------

const HOOK: PhaseTemplate = {
  id: "hook",
  label: "Hook",
  durationFraction: 0.1,
  suitableTeachMethods: ["guided_discussion", "close_reading"],
  defaultGuidance: "Start with a real-world scenario or question that connects to today's topic.",
};

const DIRECT_INSTRUCTION: PhaseTemplate = {
  id: "direct_instruction",
  label: "Direct Instruction",
  durationFraction: 0.35,
  suitableTeachMethods: ["definition_matching", "recall_quiz", "close_reading"],
  defaultGuidance: "Present new concepts clearly. Define key terms. Use examples to illustrate.",
};

const GUIDED_PRACTICE: PhaseTemplate = {
  id: "guided_practice",
  label: "Guided Practice",
  durationFraction: 0.3,
  suitableTeachMethods: ["worked_example", "problem_solving", "guided_discussion"],
  defaultGuidance: "Work through problems together. Offer hints, not answers. Reduce scaffolding gradually.",
};

const CHECK: PhaseTemplate = {
  id: "check",
  label: "Comprehension Check",
  durationFraction: 0.15,
  suitableTeachMethods: ["recall_quiz", "definition_matching"],
  defaultGuidance: "Ask targeted questions to verify understanding. Note gaps for next session.",
};

const CLOSURE: PhaseTemplate = {
  id: "closure",
  label: "Closure",
  durationFraction: 0.1,
  suitableTeachMethods: [],
  defaultGuidance: "Summarize key takeaways. Preview next session.",
};

const RECALL: PhaseTemplate = {
  id: "recall",
  label: "Spaced Recall",
  durationFraction: 0.2,
  suitableTeachMethods: ["recall_quiz", "definition_matching"],
  defaultGuidance: "Quiz on previously covered material. Wait for learner's attempt before confirming.",
};

const CONNECT: PhaseTemplate = {
  id: "connect",
  label: "Connect & Integrate",
  durationFraction: 0.2,
  suitableTeachMethods: ["guided_discussion"],
  defaultGuidance: "Help learner see connections between today's material and previous sessions.",
};

const REFLECT: PhaseTemplate = {
  id: "reflect",
  label: "Reflect",
  durationFraction: 0.15,
  suitableTeachMethods: ["guided_discussion"],
  defaultGuidance: "Ask learner to articulate what they learned and how it connects to their experience.",
};

// ---------------------------------------------------------------------------
// Model definitions
// ---------------------------------------------------------------------------

const DIRECT_INSTRUCTION_MODEL: LessonPlanModelDefinition = {
  id: "direct_instruction",
  label: "Direct Instruction",
  description: "Linear progression: introduce → practice → assess. Clear, structured, teacher-led.",
  suitableFor: "Structured, sequential content. Best when facts and procedures need to be learned in order.",
  defaults: { maxTpsPerSession: 10, reviewFrequency: 3, assessmentStyle: "light" },
  sessionPatternRules: [
    "Start with onboarding session.",
    "Each module gets an 'introduce' session (new concepts + guided practice).",
    "Larger modules (>10 TPs) get a follow-up 'deepen' session.",
    "Insert a 'review' session every 3 modules to consolidate.",
    "End with 'consolidate' session synthesizing all modules.",
    "If formal assessment requested, add 'assess' before final consolidate.",
  ].join("\n"),
  phaseTemplates: {
    introduce: [HOOK, DIRECT_INSTRUCTION, GUIDED_PRACTICE, CHECK, CLOSURE],
    deepen: [RECALL, { ...DIRECT_INSTRUCTION, id: "extend", label: "Extend & Apply", durationFraction: 0.35, defaultGuidance: "Push beyond basics into edge cases, applications, and integration with prior concepts." }, GUIDED_PRACTICE, CHECK, CLOSURE],
    review: [RECALL, { ...GUIDED_PRACTICE, id: "integrate", label: "Integrate Concepts", durationFraction: 0.35, defaultGuidance: "Use questions that require combining knowledge from multiple modules." }, CHECK, CLOSURE],
    assess: [{ ...CHECK, id: "diagnostic", label: "Diagnostic Questions", durationFraction: 0.6, defaultGuidance: "Gauge mastery across covered modules. Note strengths and gaps." }, { ...CLOSURE, id: "feedback", label: "Feedback", durationFraction: 0.4, defaultGuidance: "Summarize strengths and areas for growth." }],
    consolidate: [RECALL, CONNECT, REFLECT, CLOSURE],
  },
  tpDistributionHints: [
    "Definitions and rules → Direct Instruction phase.",
    "Examples and processes → Guided Practice phase.",
    "Key facts → Comprehension Check phase (as quiz questions).",
  ].join("\n"),
};

const FIVE_E_MODEL: LessonPlanModelDefinition = {
  id: "5e",
  label: "Discover & Explain (5E)",
  description: "Engage → Explore → Explain → Elaborate → Evaluate. Inquiry-driven, student-centred.",
  suitableFor: "Science, investigation-based learning. Best when learners should discover concepts through exploration.",
  defaults: { maxTpsPerSession: 8, reviewFrequency: 4, assessmentStyle: "light" },
  sessionPatternRules: [
    "Start with onboarding session.",
    "Each module follows the 5E cycle — may span 2-3 sessions for larger modules:",
    "  Session A: Engage + Explore (activate curiosity, investigate the topic)",
    "  Session B: Explain + Elaborate (formalise understanding, apply to new contexts)",
    "  Session C (if module is large): Evaluate (assess understanding, remediate)",
    "Smaller modules can compress into 2 sessions (Engage+Explore+Explain, Elaborate+Evaluate).",
    "Insert 'review' sessions to connect themes across modules.",
    "End with 'consolidate' session.",
  ].join("\n"),
  phaseTemplates: {
    introduce: [
      { id: "engage", label: "Engage", durationFraction: 0.25, suitableTeachMethods: ["guided_discussion"], defaultGuidance: "Pose a thought-provoking question or scenario. Activate prior knowledge and curiosity." },
      { id: "explore", label: "Explore", durationFraction: 0.5, suitableTeachMethods: ["problem_solving", "worked_example", "close_reading"], defaultGuidance: "Let learner investigate and discover. Guide with questions, don't give answers yet." },
      { id: "bridge", label: "Bridge to Next Session", durationFraction: 0.25, suitableTeachMethods: [], defaultGuidance: "Capture learner's initial hypotheses. Preview that next session will formalise understanding." },
    ],
    deepen: [
      { id: "explain", label: "Explain", durationFraction: 0.35, suitableTeachMethods: ["definition_matching", "recall_quiz", "close_reading"], defaultGuidance: "Formalise what was explored. Introduce proper terminology and definitions." },
      { id: "elaborate", label: "Elaborate", durationFraction: 0.45, suitableTeachMethods: ["worked_example", "problem_solving", "guided_discussion"], defaultGuidance: "Apply concepts to new contexts. Challenge with harder scenarios." },
      CLOSURE,
    ],
    review: [
      { id: "evaluate", label: "Evaluate", durationFraction: 0.5, suitableTeachMethods: ["recall_quiz", "problem_solving"], defaultGuidance: "Assess understanding of covered modules. Identify gaps for re-teaching." },
      CONNECT,
      CLOSURE,
    ],
    assess: [
      { id: "evaluate_formal", label: "Formal Evaluation", durationFraction: 0.7, suitableTeachMethods: ["recall_quiz", "problem_solving"], defaultGuidance: "Comprehensive assessment across all 5E cycles completed so far." },
      { ...CLOSURE, id: "feedback", label: "Feedback & Next Steps", durationFraction: 0.3 },
    ],
    consolidate: [RECALL, CONNECT, REFLECT, CLOSURE],
  },
  tpDistributionHints: [
    "Definitions → Explain phase (NOT Engage — let learner discover first).",
    "Examples and processes → Explore phase (as investigation material).",
    "Facts and rules → Explain phase (formalise after exploration).",
    "Application scenarios → Elaborate phase.",
  ].join("\n"),
};

const SPIRAL_MODEL: LessonPlanModelDefinition = {
  id: "spiral",
  label: "Revisit & Deepen",
  description: "Multiple passes: preview all topics → deepen subsets → mastery. Revisit concepts with increasing depth.",
  suitableFor: "Broad curricula where topics interconnect. Best when learners need repeated exposure at increasing depth.",
  defaults: { maxTpsPerSession: 8, reviewFrequency: 0, assessmentStyle: "light" },
  sessionPatternRules: [
    "Start with onboarding session.",
    "PASS 1 (Preview): Introduce each module at surface level — 1 session per module, covering key definitions and overview TPs only (depth 0-1).",
    "PASS 2 (Deepen): Revisit each module with deeper TPs — facts, rules, processes (depth 2-3). 1 session per module.",
    "PASS 3 (Mastery): Focus on modules where gaps remain — application and edge cases.",
    "Insert 'review' sessions between passes to connect themes.",
    "End with 'consolidate' session that synthesizes across all passes.",
  ].join("\n"),
  phaseTemplates: {
    introduce: [
      { id: "preview", label: "Preview", durationFraction: 0.15, suitableTeachMethods: [], defaultGuidance: "Orient to today's topic. Reference where it fits in the bigger picture." },
      DIRECT_INSTRUCTION,
      CHECK,
      CLOSURE,
    ],
    deepen: [
      RECALL,
      { id: "extend", label: "Extend Understanding", durationFraction: 0.4, suitableTeachMethods: ["worked_example", "problem_solving", "close_reading"], defaultGuidance: "Go deeper into the topic. Cover edge cases, exceptions, and applications." },
      CONNECT,
      CLOSURE,
    ],
    review: [RECALL, CONNECT, CHECK, CLOSURE],
    assess: [
      { id: "diagnostic", label: "Diagnostic", durationFraction: 0.6, suitableTeachMethods: ["recall_quiz", "problem_solving"], defaultGuidance: "Assess breadth AND depth across spiral passes." },
      { ...CLOSURE, id: "feedback", label: "Feedback", durationFraction: 0.4 },
    ],
    consolidate: [RECALL, CONNECT, REFLECT, CLOSURE],
  },
  tpDistributionHints: [
    "Pass 1 sessions: overview + definition TPs only (depth 0-1).",
    "Pass 2 sessions: facts, rules, processes (depth 2-3).",
    "Pass 3 sessions: application scenarios and edge cases.",
    "Each pass revisits the same module but at increasing depth.",
  ].join("\n"),
};

const MASTERY_MODEL: LessonPlanModelDefinition = {
  id: "mastery",
  label: "Mastery-Based",
  description: "Teach → Assess → Remediate-or-Advance. No new material until current module is mastered.",
  suitableFor: "Skills-based subjects, maths, language learning. Best when mastery of each topic is prerequisite for the next.",
  defaults: { maxTpsPerSession: 8, reviewFrequency: 0, assessmentStyle: "formal" },
  sessionPatternRules: [
    "Start with onboarding session.",
    "For each module: 'introduce' session → 'assess' session.",
    "If assessment reveals gaps: insert 'deepen' session (remediation) then re-assess.",
    "If mastery confirmed: advance to next module.",
    "Do NOT skip assessment — every module must have at least one assess session.",
    "End with 'consolidate' session only when all modules are mastered.",
    "Note: In practice, the voice AI adapts dynamically — this plan provides the intended sequence.",
  ].join("\n"),
  phaseTemplates: {
    introduce: [
      { id: "teach", label: "Teach", durationFraction: 0.45, suitableTeachMethods: ["definition_matching", "recall_quiz", "close_reading", "worked_example"], defaultGuidance: "Present the concept clearly. Break into small steps. Check understanding at each step." },
      { id: "practice", label: "Practice", durationFraction: 0.35, suitableTeachMethods: ["worked_example", "problem_solving"], defaultGuidance: "Guided practice with immediate feedback. Correct misconceptions as they arise." },
      CHECK,
    ],
    deepen: [
      { id: "remediate", label: "Remediate", durationFraction: 0.5, suitableTeachMethods: ["definition_matching", "worked_example", "close_reading"], defaultGuidance: "Re-teach using different examples and explanations. Address specific misconceptions from assessment." },
      { id: "practice", label: "Practice Again", durationFraction: 0.35, suitableTeachMethods: ["worked_example", "problem_solving"], defaultGuidance: "More practice with scaffolding. Build confidence before re-assessment." },
      CHECK,
    ],
    assess: [
      { id: "assess", label: "Mastery Check", durationFraction: 0.7, suitableTeachMethods: ["recall_quiz", "problem_solving"], defaultGuidance: "Test each learning outcome. Record which are mastered and which need remediation." },
      { ...CLOSURE, id: "verdict", label: "Verdict & Path", durationFraction: 0.3, defaultGuidance: "Tell learner which outcomes they've mastered and what comes next (advance or remediate)." },
    ],
    review: [RECALL, CHECK, CLOSURE],
    consolidate: [RECALL, CONNECT, REFLECT, CLOSURE],
  },
  tpDistributionHints: [
    "All TPs for a module go into the introduce session (up to maxTpsPerSession).",
    "Assess sessions test the same TPs — no new content.",
    "Deepen/remediate sessions re-use the same TPs with different examples.",
    "Do not distribute TPs across introduce and deepen — deepen revisits, not extends.",
  ].join("\n"),
};

const PROJECT_MODEL: LessonPlanModelDefinition = {
  id: "project",
  label: "Project-Based",
  description: "Brief → Investigate → Build → Present → Reflect. Learning through authentic projects.",
  suitableFor: "Creative, applied, and vocational subjects. Best when learners should produce something tangible.",
  defaults: { maxTpsPerSession: 12, reviewFrequency: 0, assessmentStyle: "none" },
  sessionPatternRules: [
    "Start with onboarding session.",
    "Group modules into 2-3 project themes (the AI should identify natural groupings).",
    "For each project theme:",
    "  1. 'introduce' session: Brief — present the project challenge and required knowledge",
    "  2. 'deepen' session(s): Investigate — research phase, gather knowledge needed",
    "  3. 'review' session: Build — apply knowledge to create something",
    "  4. 'assess' session: Present — learner explains/defends their work",
    "End with 'consolidate' session: Reflect — what was learned across all projects.",
    "TPs are distributed across Brief and Investigate phases — Build phase is application-only.",
  ].join("\n"),
  phaseTemplates: {
    introduce: [
      { id: "brief", label: "Project Brief", durationFraction: 0.3, suitableTeachMethods: ["guided_discussion"], defaultGuidance: "Present the project challenge. What will they create? What knowledge do they need?" },
      { id: "foundations", label: "Foundation Knowledge", durationFraction: 0.5, suitableTeachMethods: ["definition_matching", "recall_quiz", "close_reading"], defaultGuidance: "Teach essential concepts needed for the project. Focus on what's immediately applicable." },
      CLOSURE,
    ],
    deepen: [
      { id: "investigate", label: "Investigate", durationFraction: 0.5, suitableTeachMethods: ["close_reading", "problem_solving", "worked_example"], defaultGuidance: "Research phase — deeper knowledge needed for the project. Work through examples." },
      { id: "plan", label: "Plan Application", durationFraction: 0.3, suitableTeachMethods: ["guided_discussion"], defaultGuidance: "How will learner apply what they've learned? Talk through their approach." },
      CLOSURE,
    ],
    review: [
      { id: "build", label: "Build & Apply", durationFraction: 0.7, suitableTeachMethods: ["problem_solving", "worked_example"], defaultGuidance: "Learner works on their project. Coach and guide but let them lead." },
      { id: "checkpoint", label: "Checkpoint", durationFraction: 0.2, suitableTeachMethods: [], defaultGuidance: "Check progress. Is the learner on track? Any blockers?" },
      CLOSURE,
    ],
    assess: [
      { id: "present", label: "Present & Explain", durationFraction: 0.5, suitableTeachMethods: ["guided_discussion"], defaultGuidance: "Learner presents their work. Ask probing questions about their process and decisions." },
      REFLECT,
      CLOSURE,
    ],
    consolidate: [
      { id: "showcase", label: "Project Showcase", durationFraction: 0.3, suitableTeachMethods: ["guided_discussion"], defaultGuidance: "Review all projects. What was the learner's favourite? What challenged them most?" },
      CONNECT,
      REFLECT,
      CLOSURE,
    ],
  },
  tpDistributionHints: [
    "Definitions and rules → Brief phase (foundation knowledge).",
    "Processes and worked examples → Investigate phase.",
    "No new TPs in Build or Present phases — those are application-only.",
    "Group related TPs by project theme, not by module order.",
  ].join("\n"),
};

// ---------------------------------------------------------------------------
// Profile-specific models (comprehension, discussion, coaching)
// ---------------------------------------------------------------------------

const RETENTION_CHECK: PhaseTemplate = {
  id: "retention_check",
  label: "Retention Check",
  durationFraction: 0.15,
  suitableTeachMethods: ["recall_quiz", "open_question"],
  defaultGuidance: "Ask what they remember from last session's passage or discussion. Score unaided recall before teaching.",
};

const COMPREHENSION_CHECKPOINT: PhaseTemplate = {
  id: "comprehension_checkpoint",
  label: "Comprehension Checkpoint",
  durationFraction: 0.15,
  suitableTeachMethods: ["open_question", "close_reading"],
  defaultGuidance: "Ask student to articulate the main theme in their own words. Note whether they use textual evidence.",
};

const POSITION_CHECK: PhaseTemplate = {
  id: "position_check",
  label: "Position Check",
  durationFraction: 0.15,
  suitableTeachMethods: ["open_question"],
  defaultGuidance: "Before we start: 'What's your current view on [topic]?' Record their starting position for comparison at close.",
};

const REFLECTION_CHECKPOINT: PhaseTemplate = {
  id: "reflection_checkpoint",
  label: "Reflection Checkpoint",
  durationFraction: 0.15,
  suitableTeachMethods: ["guided_discussion"],
  defaultGuidance: "Has your thinking shifted? In what way? What caused the shift?",
};

const ACCOUNTABILITY_CHECK: PhaseTemplate = {
  id: "accountability_check",
  label: "Accountability Check",
  durationFraction: 0.15,
  suitableTeachMethods: ["open_question"],
  defaultGuidance: "Last time you committed to [X]. How did that go? What did you learn?",
};

const ACTION_CHECKPOINT: PhaseTemplate = {
  id: "action_checkpoint",
  label: "Action Checkpoint",
  durationFraction: 0.15,
  suitableTeachMethods: ["open_question"],
  defaultGuidance: "What's one concrete thing you'll do before next session? When exactly?",
};

const GUIDED_EXPLORATION: PhaseTemplate = {
  id: "guided_exploration",
  label: "Guided Exploration",
  durationFraction: 0.55,
  suitableTeachMethods: ["close_reading", "guided_discussion", "open_question"],
  defaultGuidance: "Conversation-led thematic discovery. Ask questions, don't explain. One question at a time.",
};

const DIALOGUE: PhaseTemplate = {
  id: "dialogue",
  label: "Dialogue",
  durationFraction: 0.55,
  suitableTeachMethods: ["guided_discussion", "open_question"],
  defaultGuidance: "Open-ended discussion. Present competing perspectives. Probe reasoning, don't judge conclusions.",
};

const COACHING_EXPLORATION: PhaseTemplate = {
  id: "coaching_exploration",
  label: "Exploration",
  durationFraction: 0.55,
  suitableTeachMethods: ["open_question", "guided_discussion"],
  defaultGuidance: "Start from their goals. Ask questions that sharpen thinking. Reflect, don't advise.",
};

const OPENING: PhaseTemplate = {
  id: "opening",
  label: "Opening",
  durationFraction: 0.1,
  suitableTeachMethods: [],
  defaultGuidance: "Warm greeting. Set context for today's session.",
};

const CLOSE: PhaseTemplate = {
  id: "close",
  label: "Close",
  durationFraction: 0.05,
  suitableTeachMethods: [],
  defaultGuidance: "Warm closing. Preview next session.",
};

const COMPREHENSION_GUIDED_MODEL: LessonPlanModelDefinition = {
  id: "comprehension_guided",
  label: "Comprehension-Guided",
  description: "Read, analyse & discuss. Socratic questioning, close reading, vocabulary in context. Session structure: retention check → guided exploration → comprehension checkpoint.",
  suitableFor: "English, Literature, Languages — passage-based comprehension courses",
  defaults: {
    maxTpsPerSession: 6,
    reviewFrequency: 0,
    assessmentStyle: "light",
  },
  sessionPatternRules: [
    "Session 1: Opening → Guided Exploration → Comprehension Checkpoint → Close (skip retention check — nothing to recall yet).",
    "Session 2+: Retention Check → Opening → Guided Exploration → Comprehension Checkpoint → Close.",
    "Guided Exploration is the core — Socratic questioning about the passage. One question at a time. Never stack questions.",
    "Comprehension Checkpoint: student articulates the main theme in own words. Note if they use textual evidence vs parroting.",
    "Retention Check tests recall of prior session themes — 'What do you remember from last time?'",
    "Build from literal (what does it say?) to inferential (what does it imply?) to evaluative (do you agree?).",
  ].join("\n"),
  phaseTemplates: {
    introduce: [OPENING, GUIDED_EXPLORATION, COMPREHENSION_CHECKPOINT, CLOSE],
    deepen: [RETENTION_CHECK, OPENING, GUIDED_EXPLORATION, COMPREHENSION_CHECKPOINT, CLOSE],
    review: [RETENTION_CHECK, OPENING, GUIDED_EXPLORATION, COMPREHENSION_CHECKPOINT, CLOSE],
    assess: [RETENTION_CHECK, OPENING, GUIDED_EXPLORATION, COMPREHENSION_CHECKPOINT, CLOSE],
    consolidate: [RETENTION_CHECK, OPENING, GUIDED_EXPLORATION, COMPREHENSION_CHECKPOINT, CLOSE],
  },
  tpDistributionHints: [
    "Distribute teaching points across guided exploration phases.",
    "Each TP maps to a theme or passage section the student should discover through questioning.",
    "Don't front-load — spread discovery across the session so the student builds understanding incrementally.",
  ].join("\n"),
};

const DISCUSSION_SOCRATIC_MODEL: LessonPlanModelDefinition = {
  id: "discussion_socratic",
  label: "Discussion-Socratic",
  description: "Explore ideas through dialogue. Open questions, multiple perspectives, meaning-making. Session structure: position check → dialogue → reflection checkpoint.",
  suitableFor: "Philosophy, Ethics, PSHE, Religious Studies — no right answers, reasoning matters",
  defaults: {
    maxTpsPerSession: 4,
    reviewFrequency: 0,
    assessmentStyle: "none",
  },
  sessionPatternRules: [
    "Every session: Position Check → Opening → Dialogue → Reflection Checkpoint → Close.",
    "Position Check captures the student's starting view on today's topic — this is compared against their position at close.",
    "Dialogue is the core — present competing perspectives, probe reasoning, never shut down opinions.",
    "Reflection Checkpoint: 'Has your thinking shifted? In what way?' Track position evolution across sessions.",
    "The value is in the reasoning process, not the conclusion. Celebrate uncertainty and nuance.",
    "Use thought experiments and hypotheticals to test positions.",
  ].join("\n"),
  phaseTemplates: {
    introduce: [POSITION_CHECK, OPENING, DIALOGUE, REFLECTION_CHECKPOINT, CLOSE],
    deepen: [POSITION_CHECK, OPENING, DIALOGUE, REFLECTION_CHECKPOINT, CLOSE],
    review: [POSITION_CHECK, OPENING, DIALOGUE, REFLECTION_CHECKPOINT, CLOSE],
    assess: [POSITION_CHECK, OPENING, DIALOGUE, REFLECTION_CHECKPOINT, CLOSE],
    consolidate: [POSITION_CHECK, OPENING, DIALOGUE, REFLECTION_CHECKPOINT, CLOSE],
  },
  tpDistributionHints: [
    "Each TP is a discussion prompt or ethical scenario, not a fact to teach.",
    "Fewer TPs per session — depth over breadth. 2-3 substantial prompts is better than 6 surface-level ones.",
    "Order prompts from accessible to challenging — build confidence before introducing harder dilemmas.",
  ].join("\n"),
};

const COACHING_STRUCTURED_MODEL: LessonPlanModelDefinition = {
  id: "coaching_structured",
  label: "Coaching-Structured",
  description: "Goal-focused development. Reflective practice, action planning, accountability. Session structure: accountability check → exploration → action checkpoint.",
  suitableFor: "Career, Leadership, Performance, Personal Development — goal-directed, not knowledge-based",
  defaults: {
    maxTpsPerSession: 3,
    reviewFrequency: 0,
    assessmentStyle: "none",
  },
  sessionPatternRules: [
    "Session 1: Opening → Exploration → Action Checkpoint → Close (skip accountability — no prior commitments).",
    "Session 2+: Accountability Check → Opening → Exploration → Action Checkpoint → Close.",
    "Accountability Check: 'Last time you committed to X. How did it go?' Score follow-through honestly.",
    "Exploration is the core — start from their goals, not your agenda. Ask questions that sharpen thinking.",
    "Action Checkpoint: every session ends with a concrete, time-bound commitment. 'What will you do? By when?'",
    "Never give advice directly — reflect questions back: 'What feels right to you?'",
  ].join("\n"),
  phaseTemplates: {
    introduce: [OPENING, COACHING_EXPLORATION, ACTION_CHECKPOINT, CLOSE],
    deepen: [ACCOUNTABILITY_CHECK, OPENING, COACHING_EXPLORATION, ACTION_CHECKPOINT, CLOSE],
    review: [ACCOUNTABILITY_CHECK, OPENING, COACHING_EXPLORATION, ACTION_CHECKPOINT, CLOSE],
    assess: [ACCOUNTABILITY_CHECK, OPENING, COACHING_EXPLORATION, ACTION_CHECKPOINT, CLOSE],
    consolidate: [ACCOUNTABILITY_CHECK, OPENING, COACHING_EXPLORATION, ACTION_CHECKPOINT, CLOSE],
  },
  tpDistributionHints: [
    "TPs are goal-related themes or skill areas, not content to teach.",
    "Each TP should be explorable through reflective questions, not instruction.",
    "Fewer TPs — 2-3 per session. Coaching goes deep on one theme rather than covering many.",
  ].join("\n"),
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const LESSON_PLAN_MODELS: Record<LessonPlanModel, LessonPlanModelDefinition> = {
  direct_instruction: DIRECT_INSTRUCTION_MODEL,
  "5e": FIVE_E_MODEL,
  spiral: SPIRAL_MODEL,
  mastery: MASTERY_MODEL,
  project: PROJECT_MODEL,
  comprehension_guided: COMPREHENSION_GUIDED_MODEL,
  discussion_socratic: DISCUSSION_SOCRATIC_MODEL,
  coaching_structured: COACHING_STRUCTURED_MODEL,
};

/** Ordered array for UI rendering */
export const LESSON_PLAN_MODEL_LIST: LessonPlanModelDefinition[] = [
  DIRECT_INSTRUCTION_MODEL,
  FIVE_E_MODEL,
  SPIRAL_MODEL,
  MASTERY_MODEL,
  PROJECT_MODEL,
  COMPREHENSION_GUIDED_MODEL,
  DISCUSSION_SOCRATIC_MODEL,
  COACHING_STRUCTURED_MODEL,
];

/** Get model definition, defaulting to direct_instruction */
export function getLessonPlanModel(id: string | null | undefined): LessonPlanModelDefinition {
  return LESSON_PLAN_MODELS[(id as LessonPlanModel)] ?? DIRECT_INSTRUCTION_MODEL;
}
