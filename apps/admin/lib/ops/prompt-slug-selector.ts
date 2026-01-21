/**
 * prompt-slug-selector.ts
 *
 * Selects appropriate prompt slugs based on user personality and conversation context.
 *
 * MVP uses rule-based selection mapping personality traits to prompt categories.
 * Future versions may use ML models or more sophisticated selection algorithms.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Prompt slug taxonomy from docs/taxonomy/prompt-slugs.md
const PROMPT_SLUGS = {
  emotion: [
    "emotion.soothing",
    "emotion.validating",
    "emotion.reassuring",
    "emotion.deescalate",
    "emotion.grounding",
  ],
  control: [
    "control.redirect",
    "control.clarify",
    "control.summarise",
    "control.slow_down",
    "control.close_topic",
  ],
  memory: [
    "memory.elicit_story",
    "memory.anchor_identity",
    "memory.reflect_past",
    "memory.link_events",
  ],
  engage: [
    "engage.encourage",
    "engage.prompt_action",
    "engage.curiosity",
    "engage.future_oriented",
  ],
} as const;

interface PersonalityScores {
  openness: number | null;
  conscientiousness: number | null;
  extraversion: number | null;
  agreeableness: number | null;
  neuroticism: number | null;
}

interface SelectionContext {
  callId?: string;
  userId?: string;
  recentSlugs?: string[];
  maxRecent?: number; // How many recent slugs to avoid (default 3)
}

interface SelectionResult {
  promptSlug: string;
  confidence: number;
  reasoning: string;
  personalitySnapshot: PersonalityScores;
  recentSlugs: string[];
}

/**
 * Main entry point: Select a prompt slug for a given user/call
 */
export async function selectPromptSlug(
  context: SelectionContext
): Promise<SelectionResult> {
  const { callId, userId, maxRecent = 3 } = context;

  if (!userId && !callId) {
    throw new Error("Either userId or callId must be provided");
  }

  // Get user ID from call if not provided
  let effectiveUserId = userId;
  if (!effectiveUserId && callId) {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: { userId: true },
    });
    effectiveUserId = call?.userId ?? undefined;
  }

  if (!effectiveUserId) {
    throw new Error("Could not determine userId from context");
  }

  // Get personality profile
  const personality = await prisma.userPersonality.findUnique({
    where: { userId: effectiveUserId },
  });

  if (!personality) {
    throw new Error(
      `No personality profile found for user ${effectiveUserId}. Run personality analysis first.`
    );
  }

  // Get recent prompt slugs to avoid repetition
  const recentSelections = await prisma.promptSlugSelection.findMany({
    where: { userId: effectiveUserId },
    orderBy: { selectedAt: "desc" },
    take: maxRecent,
    select: { promptSlug: true },
  });

  const recentSlugs =
    context.recentSlugs ?? recentSelections.map((s) => s.promptSlug);

  // Select prompt slug using rule-based logic
  const selection = selectSlugByRules(
    {
      openness: personality.openness,
      conscientiousness: personality.conscientiousness,
      extraversion: personality.extraversion,
      agreeableness: personality.agreeableness,
      neuroticism: personality.neuroticism,
    },
    recentSlugs
  );

  return {
    ...selection,
    recentSlugs,
  };
}

/**
 * Rule-based selection logic
 *
 * Maps Big 5 personality traits to appropriate prompt slug categories.
 * Applies recency filter to avoid repetition.
 */
function selectSlugByRules(
  personality: PersonalityScores,
  recentSlugs: string[]
): Omit<SelectionResult, "recentSlugs"> {
  const {
    openness,
    conscientiousness,
    extraversion,
    agreeableness,
    neuroticism,
  } = personality;

  // Rule 1: High neuroticism → Emotional regulation
  if (neuroticism !== null && neuroticism > 0.6) {
    const slug = selectFromCategory(
      PROMPT_SLUGS.emotion,
      recentSlugs,
      "emotion.soothing"
    );
    return {
      promptSlug: slug,
      confidence: 0.85,
      reasoning: `High neuroticism (${neuroticism.toFixed(2)}) indicates emotional support needed`,
      personalitySnapshot: personality,
    };
  }

  // Rule 2: High neuroticism (moderate) → Emotional validation
  if (neuroticism !== null && neuroticism > 0.4) {
    const slug = selectFromCategory(
      PROMPT_SLUGS.emotion,
      recentSlugs,
      "emotion.validating"
    );
    return {
      promptSlug: slug,
      confidence: 0.75,
      reasoning: `Moderate neuroticism (${neuroticism.toFixed(2)}) suggests validation approach`,
      personalitySnapshot: personality,
    };
  }

  // Rule 3: Low openness + High agreeableness → Memory/Narrative
  if (
    openness !== null &&
    agreeableness !== null &&
    openness < 0.4 &&
    agreeableness > 0.6
  ) {
    const slug = selectFromCategory(
      PROMPT_SLUGS.memory,
      recentSlugs,
      "memory.elicit_story"
    );
    return {
      promptSlug: slug,
      confidence: 0.8,
      reasoning: `Low openness (${openness.toFixed(2)}) + High agreeableness (${agreeableness.toFixed(2)}) → narrative approach works well`,
      personalitySnapshot: personality,
    };
  }

  // Rule 4: High extraversion → Engagement/Encouragement
  if (extraversion !== null && extraversion > 0.7) {
    const slug = selectFromCategory(
      PROMPT_SLUGS.engage,
      recentSlugs,
      "engage.encourage"
    );
    return {
      promptSlug: slug,
      confidence: 0.8,
      reasoning: `High extraversion (${extraversion.toFixed(2)}) responds well to encouragement`,
      personalitySnapshot: personality,
    };
  }

  // Rule 5: High conscientiousness → Action-oriented prompts
  if (conscientiousness !== null && conscientiousness > 0.6) {
    const slug = selectFromCategory(
      PROMPT_SLUGS.engage,
      recentSlugs,
      "engage.prompt_action"
    );
    return {
      promptSlug: slug,
      confidence: 0.75,
      reasoning: `High conscientiousness (${conscientiousness.toFixed(2)}) benefits from action prompts`,
      personalitySnapshot: personality,
    };
  }

  // Rule 6: High openness → Curiosity-based engagement
  if (openness !== null && openness > 0.6) {
    const slug = selectFromCategory(
      PROMPT_SLUGS.engage,
      recentSlugs,
      "engage.curiosity"
    );
    return {
      promptSlug: slug,
      confidence: 0.7,
      reasoning: `High openness (${openness.toFixed(2)}) enjoys curiosity-driven conversation`,
      personalitySnapshot: personality,
    };
  }

  // Default fallback: Clarify (safe conversational control)
  const slug = selectFromCategory(
    PROMPT_SLUGS.control,
    recentSlugs,
    "control.clarify"
  );
  return {
    promptSlug: slug,
    confidence: 0.5,
    reasoning: "No strong personality signals - using neutral clarification prompt",
    personalitySnapshot: personality,
  };
}

/**
 * Select a slug from a category, avoiding recent slugs
 */
function selectFromCategory(
  category: readonly string[],
  recentSlugs: string[],
  preferredSlug: string
): string {
  // Try preferred slug first if not recently used
  if (!recentSlugs.includes(preferredSlug)) {
    return preferredSlug;
  }

  // Find any slug from category not in recent history
  const available = category.filter((slug) => !recentSlugs.includes(slug));

  if (available.length > 0) {
    // Return first available (or could randomize)
    return available[0];
  }

  // All slugs recently used - return preferred anyway (repetition unavoidable)
  return preferredSlug;
}

/**
 * Save prompt slug selection to database
 */
export async function savePromptSlugSelection(
  callId: string,
  userId: string,
  selection: Omit<SelectionResult, "recentSlugs">
): Promise<void> {
  await prisma.promptSlugSelection.create({
    data: {
      callId,
      userId,
      promptSlug: selection.promptSlug,
      confidence: selection.confidence,
      reasoning: selection.reasoning,
      personalitySnapshot: selection.personalitySnapshot as any,
      recentSlugs: [], // Will be populated by next selection
      selectionMethod: "rule-based",
    },
  });
}

/**
 * Get all prompt slugs by category (for UI/testing)
 */
export function getAllPromptSlugs() {
  return PROMPT_SLUGS;
}

/**
 * Get selection history for a user
 */
export async function getSelectionHistory(
  userId: string,
  limit: number = 10
) {
  return await prisma.promptSlugSelection.findMany({
    where: { userId },
    orderBy: { selectedAt: "desc" },
    take: limit,
    include: {
      call: {
        select: {
          id: true,
          source: true,
          createdAt: true,
        },
      },
    },
  });
}
