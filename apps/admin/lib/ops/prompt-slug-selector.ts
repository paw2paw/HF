/**
 * prompt-slug-selector.ts
 *
 * Selects appropriate prompt slugs based on user personality and conversation context.
 *
 * MVP uses rule-based selection mapping personality traits to prompt categories.
 * Future versions may use ML models or more sophisticated selection algorithms.
 */

import { PrismaClient } from "@prisma/client";
import type { SpecConfig } from "@/lib/types/json-fields";

const prisma = new PrismaClient();

// Config loaded from SLUG_SELECT spec (with defaults)
interface SlugSelectConfig {
  // Threshold definitions for rule-based selection
  thresholds: {
    highNeuroticism: number;
    moderateNeuroticism: number;
    lowOpenness: number;
    highAgreeableness: number;
    highExtraversion: number;
    highConscientiousness: number;
    highOpenness: number;
  };
  // Confidence levels for each rule
  confidences: {
    highNeuroticism: number;
    moderateNeuroticism: number;
    memoryNarrative: number;
    highExtraversion: number;
    highConscientiousness: number;
    highOpenness: number;
    fallback: number;
  };
  // How many recent slugs to check for repetition avoidance
  maxRecentSlugs: number;
}

const DEFAULT_SLUG_SELECT_CONFIG: SlugSelectConfig = {
  thresholds: {
    highNeuroticism: 0.6,
    moderateNeuroticism: 0.4,
    lowOpenness: 0.4,
    highAgreeableness: 0.6,
    highExtraversion: 0.7,
    highConscientiousness: 0.6,
    highOpenness: 0.6,
  },
  confidences: {
    highNeuroticism: 0.85,
    moderateNeuroticism: 0.75,
    memoryNarrative: 0.8,
    highExtraversion: 0.8,
    highConscientiousness: 0.75,
    highOpenness: 0.7,
    fallback: 0.5,
  },
  maxRecentSlugs: 3,
};

/**
 * Load SLUG_SELECT spec config from database
 */
async function loadSlugSelectConfig(): Promise<SlugSelectConfig> {
  const spec = await prisma.analysisSpec.findFirst({
    where: {
      slug: "system-slug-select",
      isActive: true,
      scope: "SYSTEM",
    },
  });

  if (!spec?.config) {
    return DEFAULT_SLUG_SELECT_CONFIG;
  }

  const specConfig = spec.config as SpecConfig;
  return {
    thresholds: {
      highNeuroticism: specConfig.thresholds?.highNeuroticism ?? DEFAULT_SLUG_SELECT_CONFIG.thresholds.highNeuroticism,
      moderateNeuroticism: specConfig.thresholds?.moderateNeuroticism ?? DEFAULT_SLUG_SELECT_CONFIG.thresholds.moderateNeuroticism,
      lowOpenness: specConfig.thresholds?.lowOpenness ?? DEFAULT_SLUG_SELECT_CONFIG.thresholds.lowOpenness,
      highAgreeableness: specConfig.thresholds?.highAgreeableness ?? DEFAULT_SLUG_SELECT_CONFIG.thresholds.highAgreeableness,
      highExtraversion: specConfig.thresholds?.highExtraversion ?? DEFAULT_SLUG_SELECT_CONFIG.thresholds.highExtraversion,
      highConscientiousness: specConfig.thresholds?.highConscientiousness ?? DEFAULT_SLUG_SELECT_CONFIG.thresholds.highConscientiousness,
      highOpenness: specConfig.thresholds?.highOpenness ?? DEFAULT_SLUG_SELECT_CONFIG.thresholds.highOpenness,
    },
    confidences: {
      highNeuroticism: specConfig.confidences?.highNeuroticism ?? DEFAULT_SLUG_SELECT_CONFIG.confidences.highNeuroticism,
      moderateNeuroticism: specConfig.confidences?.moderateNeuroticism ?? DEFAULT_SLUG_SELECT_CONFIG.confidences.moderateNeuroticism,
      memoryNarrative: specConfig.confidences?.memoryNarrative ?? DEFAULT_SLUG_SELECT_CONFIG.confidences.memoryNarrative,
      highExtraversion: specConfig.confidences?.highExtraversion ?? DEFAULT_SLUG_SELECT_CONFIG.confidences.highExtraversion,
      highConscientiousness: specConfig.confidences?.highConscientiousness ?? DEFAULT_SLUG_SELECT_CONFIG.confidences.highConscientiousness,
      highOpenness: specConfig.confidences?.highOpenness ?? DEFAULT_SLUG_SELECT_CONFIG.confidences.highOpenness,
      fallback: specConfig.confidences?.fallback ?? DEFAULT_SLUG_SELECT_CONFIG.confidences.fallback,
    },
    maxRecentSlugs: specConfig.maxRecentSlugs ?? DEFAULT_SLUG_SELECT_CONFIG.maxRecentSlugs,
  };
}

// Default prompt slug taxonomy (fallback if database not seeded)
const DEFAULT_PROMPT_SLUGS = {
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
};

// Cached prompt slugs (loaded from database)
let cachedPromptSlugs: Record<string, string[]> | null = null;

/**
 * Load prompt slug taxonomy from database
 * Slugs are stored as COMPOSE specs with domain="prompt-slugs"
 */
async function loadPromptSlugs(): Promise<Record<string, string[]>> {
  if (cachedPromptSlugs) {
    return cachedPromptSlugs;
  }

  const specs = await prisma.analysisSpec.findMany({
    where: {
      domain: "prompt-slugs",
      outputType: "COMPOSE",
      scope: "SYSTEM",
      isActive: true,
    },
    select: {
      config: true,
    },
  });

  if (specs.length === 0) {
    // Fallback to defaults if no specs found
    return DEFAULT_PROMPT_SLUGS;
  }

  // Build taxonomy from specs
  const taxonomy: Record<string, string[]> = {};

  for (const spec of specs) {
    const config = spec.config as { category?: string; slugId?: string } | null;
    if (config?.category && config?.slugId) {
      if (!taxonomy[config.category]) {
        taxonomy[config.category] = [];
      }
      taxonomy[config.category].push(config.slugId);
    }
  }

  // If we got valid data, cache it
  if (Object.keys(taxonomy).length > 0) {
    cachedPromptSlugs = taxonomy;
    return taxonomy;
  }

  return DEFAULT_PROMPT_SLUGS;
}

/**
 * Get the prompt template for a specific slug
 */
export async function getPromptTemplate(slugId: string): Promise<string | null> {
  const spec = await prisma.analysisSpec.findFirst({
    where: {
      domain: "prompt-slugs",
      outputType: "COMPOSE",
      scope: "SYSTEM",
      isActive: true,
      config: {
        path: ["slugId"],
        equals: slugId,
      },
    },
    select: {
      promptTemplate: true,
    },
  });

  return spec?.promptTemplate || null;
}

interface PersonalityScores {
  openness: number | null;
  conscientiousness: number | null;
  extraversion: number | null;
  agreeableness: number | null;
  neuroticism: number | null;
}

interface SelectionContext {
  callId?: string;
  callerId?: string;
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
  const { callId, callerId } = context;

  if (!callerId && !callId) {
    throw new Error("Either callerId or callId must be provided");
  }

  // Load SLUG_SELECT spec config
  const config = await loadSlugSelectConfig();
  const maxRecent = context.maxRecent ?? config.maxRecentSlugs;

  // Get user ID from call if not provided
  let effectiveUserId = callerId;
  if (!effectiveUserId && callId) {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: { callerId: true },
    });
    effectiveUserId = call?.callerId ?? undefined;
  }

  if (!effectiveUserId) {
    throw new Error("Could not determine callerId from context");
  }

  // Get personality profile
  const personality = await prisma.callerPersonality.findUnique({
    where: { callerId: effectiveUserId },
  });

  if (!personality) {
    throw new Error(
      `No personality profile found for caller ${effectiveUserId}. Run personality analysis first.`
    );
  }

  // Get recent prompt slugs to avoid repetition
  const recentSelections = await prisma.promptSlugSelection.findMany({
    where: { callerId: effectiveUserId },
    orderBy: { selectedAt: "desc" },
    take: maxRecent,
    select: { promptSlug: true },
  });

  const recentSlugs =
    context.recentSlugs ?? recentSelections.map((s) => s.promptSlug);

  // Load prompt slug taxonomy from database
  const promptSlugs = await loadPromptSlugs();

  // Select prompt slug using rule-based logic (with config thresholds)
  const selection = selectSlugByRules(
    {
      openness: personality.openness,
      conscientiousness: personality.conscientiousness,
      extraversion: personality.extraversion,
      agreeableness: personality.agreeableness,
      neuroticism: personality.neuroticism,
    },
    recentSlugs,
    config,
    promptSlugs
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
 * Uses thresholds and confidences from SLUG_SELECT spec config.
 * Uses prompt slug taxonomy loaded from database.
 */
function selectSlugByRules(
  personality: PersonalityScores,
  recentSlugs: string[],
  config: SlugSelectConfig,
  promptSlugs: Record<string, string[]>
): Omit<SelectionResult, "recentSlugs"> {
  const {
    openness,
    conscientiousness,
    extraversion,
    agreeableness,
    neuroticism,
  } = personality;

  const { thresholds, confidences } = config;

  // Rule 1: High neuroticism → Emotional regulation
  if (neuroticism !== null && neuroticism > thresholds.highNeuroticism) {
    const slug = selectFromCategory(
      promptSlugs.emotion || [],
      recentSlugs,
      "emotion.soothing"
    );
    return {
      promptSlug: slug,
      confidence: confidences.highNeuroticism,
      reasoning: `High neuroticism (${neuroticism.toFixed(2)}) indicates emotional support needed`,
      personalitySnapshot: personality,
    };
  }

  // Rule 2: Moderate neuroticism → Emotional validation
  if (neuroticism !== null && neuroticism > thresholds.moderateNeuroticism) {
    const slug = selectFromCategory(
      promptSlugs.emotion || [],
      recentSlugs,
      "emotion.validating"
    );
    return {
      promptSlug: slug,
      confidence: confidences.moderateNeuroticism,
      reasoning: `Moderate neuroticism (${neuroticism.toFixed(2)}) suggests validation approach`,
      personalitySnapshot: personality,
    };
  }

  // Rule 3: Low openness + High agreeableness → Memory/Narrative
  if (
    openness !== null &&
    agreeableness !== null &&
    openness < thresholds.lowOpenness &&
    agreeableness > thresholds.highAgreeableness
  ) {
    const slug = selectFromCategory(
      promptSlugs.memory || [],
      recentSlugs,
      "memory.elicit_story"
    );
    return {
      promptSlug: slug,
      confidence: confidences.memoryNarrative,
      reasoning: `Low openness (${openness.toFixed(2)}) + High agreeableness (${agreeableness.toFixed(2)}) → narrative approach works well`,
      personalitySnapshot: personality,
    };
  }

  // Rule 4: High extraversion → Engagement/Encouragement
  if (extraversion !== null && extraversion > thresholds.highExtraversion) {
    const slug = selectFromCategory(
      promptSlugs.engage || [],
      recentSlugs,
      "engage.encourage"
    );
    return {
      promptSlug: slug,
      confidence: confidences.highExtraversion,
      reasoning: `High extraversion (${extraversion.toFixed(2)}) responds well to encouragement`,
      personalitySnapshot: personality,
    };
  }

  // Rule 5: High conscientiousness → Action-oriented prompts
  if (conscientiousness !== null && conscientiousness > thresholds.highConscientiousness) {
    const slug = selectFromCategory(
      promptSlugs.engage || [],
      recentSlugs,
      "engage.prompt_action"
    );
    return {
      promptSlug: slug,
      confidence: confidences.highConscientiousness,
      reasoning: `High conscientiousness (${conscientiousness.toFixed(2)}) benefits from action prompts`,
      personalitySnapshot: personality,
    };
  }

  // Rule 6: High openness → Curiosity-based engagement
  if (openness !== null && openness > thresholds.highOpenness) {
    const slug = selectFromCategory(
      promptSlugs.engage || [],
      recentSlugs,
      "engage.curiosity"
    );
    return {
      promptSlug: slug,
      confidence: confidences.highOpenness,
      reasoning: `High openness (${openness.toFixed(2)}) enjoys curiosity-driven conversation`,
      personalitySnapshot: personality,
    };
  }

  // Default fallback: Clarify (safe conversational control)
  const slug = selectFromCategory(
    promptSlugs.control || [],
    recentSlugs,
    "control.clarify"
  );
  return {
    promptSlug: slug,
    confidence: confidences.fallback,
    reasoning: "No strong personality signals - using neutral clarification prompt",
    personalitySnapshot: personality,
  };
}

/**
 * Select a slug from a category, avoiding recent slugs
 */
function selectFromCategory(
  category: string[],
  recentSlugs: string[],
  preferredSlug: string
): string {
  // If category is empty, return preferred slug
  if (category.length === 0) {
    return preferredSlug;
  }

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
  callerId: string,
  selection: Omit<SelectionResult, "recentSlugs">
): Promise<void> {
  await prisma.promptSlugSelection.create({
    data: {
      callId,
      callerId,
      promptSlug: selection.promptSlug,
      confidence: selection.confidence,
      reasoning: selection.reasoning,
      personalitySnapshot: selection.personalitySnapshot as unknown as Record<string, any>,
      recentSlugs: [], // Will be populated by next selection
      selectionMethod: "rule-based",
    },
  });
}

/**
 * Get all prompt slugs by category (for UI/testing)
 * Now loads from database with fallback to defaults
 */
export async function getAllPromptSlugs(): Promise<Record<string, string[]>> {
  return await loadPromptSlugs();
}

/**
 * Clear cached prompt slugs (call after seeding or updating specs)
 */
export function clearPromptSlugCache(): void {
  cachedPromptSlugs = null;
}

/**
 * Get selection history for a user
 */
export async function getSelectionHistory(
  callerId: string,
  limit: number = 10
) {
  return await prisma.promptSlugSelection.findMany({
    where: { callerId },
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
