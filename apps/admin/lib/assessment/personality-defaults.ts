import type { SurveyStepConfig } from "@/lib/types/json-fields";

/** Default personality profiling questions — used when no playbook override exists. */
export const DEFAULT_PERSONALITY_QUESTIONS: SurveyStepConfig[] = [
  {
    id: "learning_style",
    type: "options",
    prompt: "How do you prefer to learn?",
    options: [
      { value: "visual", label: "Pictures and diagrams" },
      { value: "auditory", label: "Listening and discussing" },
      { value: "reading", label: "Reading and writing" },
      { value: "kinesthetic", label: "Hands-on practice" },
    ],
  },
  {
    id: "pace_preference",
    type: "options",
    prompt: "What pace works best for you?",
    options: [
      { value: "fast", label: "Move quickly through material" },
      { value: "moderate", label: "Steady pace with time to think" },
      { value: "slow", label: "Take it slow, lots of examples" },
    ],
  },
  {
    id: "interaction_style",
    type: "options",
    prompt: "How do you like to be taught?",
    options: [
      { value: "conversational", label: "Chat naturally" },
      { value: "direct", label: "Straight to the point" },
      { value: "exploratory", label: "Let me figure things out" },
      { value: "guided", label: "Step-by-step guidance" },
    ],
  },
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
