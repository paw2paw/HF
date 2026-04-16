import type { SurveyStepConfig } from "@/lib/types/json-fields";

/**
 * Default personality profiling questions — used when no playbook override exists.
 *
 * Trimmed to questions that actually feed prompt composition:
 * - confidence → quickstart.ts baseline hint
 * - goal_text → quickstart.ts personalisation
 * - motivation → quickstart.ts personalisation
 *
 * Removed: learning_style, pace_preference, interaction_style — these were
 * collected but never consumed by prompt composition (the pipeline infers
 * personality traits from conversation via PERS-001/VARK-001 instead).
 */
export const DEFAULT_PERSONALITY_QUESTIONS: SurveyStepConfig[] = [
  {
    id: "confidence",
    type: "stars",
    prompt: "How confident are you in {subject} right now?",
  },
  {
    id: "goal_text",
    type: "text",
    prompt: "What's your main goal for this course?",
    placeholder: "e.g. Pass my exam, understand the fundamentals...",
    maxLength: 200,
  },
  {
    id: "motivation",
    type: "text",
    prompt: "Why are you here? What do you want to get out of this course?",
    placeholder: "e.g. Pass my exam, switch careers, satisfy curiosity...",
    maxLength: 300,
  },
];
