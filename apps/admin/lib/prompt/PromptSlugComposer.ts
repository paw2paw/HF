/**
 * PromptSlugComposer - Composes prompts from PromptSlugs based on parameter values
 *
 * This is the clean separation of concerns:
 * - AnalysisSpec defines HOW to measure parameters from transcripts
 * - PromptSlug defines WHAT to say based on those parameter values
 * - Parameter is the bridge between measurement and adaptation
 *
 * Memory Injection Policy:
 * - Global defaults from PromptCompositionConfig (if exists)
 * - Per-slug overrides on MEMORY-sourced PromptSlugs
 * - Controls: max items, min confidence, decay weighting, category filtering
 *
 * Flow:
 * 1. Get user's parameter values (from UserPersonalityProfile)
 * 2. Load global memory config (if exists)
 * 3. Find active PromptSlugs linked to those parameters
 * 4. For MEMORY slugs, apply injection policies
 * 5. For each slug, find the matching range based on value
 * 6. Collect and order all matching prompts
 * 7. Compose into final prompt text
 */

import { PrismaClient, PromptSlugSource, PromptSlugMode } from "@prisma/client";

const prisma = new PrismaClient();

// Memory injection configuration (global defaults + per-slug overrides)
interface MemoryInjectionConfig {
  maxItems: number;
  minConfidence: number;
  decayEnabled: boolean;
  categories: string[];
  relevanceMode: "all" | "topic-match" | "recent" | "weighted";
  recencyDays: number | null;
  summarizeAbove: number | null;
  summaryPrompt: string | null;
}

const DEFAULT_MEMORY_CONFIG: MemoryInjectionConfig = {
  maxItems: 20,
  minConfidence: 0.5,
  decayEnabled: true,
  categories: [], // empty = all categories
  relevanceMode: "all",
  recencyDays: null,
  summarizeAbove: null,
  summaryPrompt: null,
};

export interface SlugCompositionContext {
  // User/caller info
  userId?: string;
  callerId?: string;

  // Parameter values (if provided directly, otherwise fetched from profile)
  parameterValues?: Record<string, number>;

  // Include memory-based slugs
  includeMemories?: boolean;

  // Filter by source type
  sourceTypes?: PromptSlugSource[];

  // Optional: specify config name to use (defaults to "default" or first active)
  configName?: string;
}

export interface ComposedSlugPrompt {
  slugId: string;
  slug: string;
  name: string;
  sourceType: PromptSlugSource;
  priority: number;
  renderedPrompt: string;
  matchedRange: {
    label: string | null;
    minValue: number | null;
    maxValue: number | null;
  } | null;
  context: {
    parameterId?: string;
    parameterName?: string;
    value?: number;
    mode?: PromptSlugMode;
    memoriesUsed?: number;
  };
}

export interface SlugCompositionResult {
  prompts: ComposedSlugPrompt[];
  combinedPrompt: string;
  metadata: {
    totalSlugs: number;
    activeSlugs: number;
    matchedSlugs: number;
    parameterValuesUsed: Record<string, number>;
    memoriesIncluded: number;
    memoryConfig: MemoryInjectionConfig;
    composedAt: string;
  };
}

interface UserMemoryRow {
  id: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  decayFactor: number;
  extractedAt: Date;
}

/**
 * Load global memory configuration
 */
async function loadMemoryConfig(configName?: string): Promise<MemoryInjectionConfig> {
  try {
    // Try to find specified config or default
    const config = await prisma.promptCompositionConfig.findFirst({
      where: {
        isActive: true,
        ...(configName ? { name: configName } : { isDefault: true }),
      },
    });

    if (config) {
      return {
        maxItems: config.memoryMaxCount,
        minConfidence: config.memoryMinConfidence,
        decayEnabled: config.memoryDecayEnabled,
        categories: config.memoryCategories || [],
        relevanceMode: config.memoryRelevanceMode as MemoryInjectionConfig["relevanceMode"],
        recencyDays: config.memoryRecencyDays,
        summarizeAbove: config.memorySummarizeAbove,
        summaryPrompt: config.memorySummaryPrompt,
      };
    }
  } catch (e) {
    // Config table might not exist yet
  }

  return DEFAULT_MEMORY_CONFIG;
}

/**
 * Apply decay weighting to memories based on age
 */
function applyDecayWeighting(
  memories: UserMemoryRow[],
  decayEnabled: boolean
): Array<UserMemoryRow & { effectiveConfidence: number }> {
  const now = Date.now();

  return memories.map((m) => {
    let effectiveConfidence = m.confidence;

    if (decayEnabled && m.decayFactor < 1.0) {
      // Apply time-based decay
      const ageMs = now - m.extractedAt.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      // Exponential decay: confidence * decayFactor^days
      effectiveConfidence = m.confidence * Math.pow(m.decayFactor, ageDays / 30);
    }

    return { ...m, effectiveConfidence };
  });
}

/**
 * Filter memories based on injection policy
 */
function filterMemories(
  memories: UserMemoryRow[],
  config: MemoryInjectionConfig,
  slugOverrides?: {
    memoryMaxItems?: number | null;
    memoryMinConfidence?: number | null;
    memoryKeyPattern?: string | null;
    memoryDecayEnabled?: boolean;
    memoryCategory?: string | null;
  }
): Array<UserMemoryRow & { effectiveConfidence: number }> {
  // Merge config with slug overrides
  const maxItems = slugOverrides?.memoryMaxItems ?? config.maxItems;
  const minConfidence = slugOverrides?.memoryMinConfidence ?? config.minConfidence;
  const decayEnabled = slugOverrides?.memoryDecayEnabled ?? config.decayEnabled;
  const keyPattern = slugOverrides?.memoryKeyPattern;

  // Filter by category (slug-level category takes precedence)
  let filtered = memories;
  if (slugOverrides?.memoryCategory) {
    filtered = filtered.filter((m) => m.category === slugOverrides.memoryCategory);
  } else if (config.categories.length > 0) {
    filtered = filtered.filter((m) => config.categories.includes(m.category));
  }

  // Filter by key pattern (glob-style)
  if (keyPattern) {
    const regex = new RegExp(
      "^" + keyPattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
    );
    filtered = filtered.filter((m) => regex.test(m.key));
  }

  // Apply decay weighting
  const withDecay = applyDecayWeighting(filtered, decayEnabled);

  // Filter by minimum confidence (after decay)
  const aboveThreshold = withDecay.filter(
    (m) => m.effectiveConfidence >= minConfidence
  );

  // Sort by effective confidence (descending)
  aboveThreshold.sort((a, b) => b.effectiveConfidence - a.effectiveConfidence);

  // Limit to max items
  return aboveThreshold.slice(0, maxItems);
}

/**
 * Summarize memories if above threshold
 */
function summarizeMemories(
  memories: Array<{ category: string; key: string; value: string; confidence: number }>,
  summaryTemplate: string | null
): string {
  if (!summaryTemplate) {
    // Default summary format
    const byCategory: Record<string, string[]> = {};
    for (const m of memories) {
      if (!byCategory[m.category]) byCategory[m.category] = [];
      byCategory[m.category].push(`${m.key}: ${m.value}`);
    }

    const parts: string[] = [];
    for (const [category, items] of Object.entries(byCategory)) {
      parts.push(`${category}: ${items.join("; ")}`);
    }
    return `Known about this person: ${parts.join(". ")}`;
  }

  // Use provided template
  let result = summaryTemplate;

  // Replace {{count}}
  result = result.replace(/\{\{count\}\}/g, String(memories.length));

  // Replace {{#each memories}}...{{/each}}
  const eachRegex = /\{\{#each memories\}\}([\s\S]*?)\{\{\/each\}\}/g;
  result = result.replace(eachRegex, (_, content) => {
    return memories
      .map((mem) => {
        let itemContent = content;
        itemContent = itemContent.replace(/\{\{this\.key\}\}/g, mem.key);
        itemContent = itemContent.replace(/\{\{this\.value\}\}/g, mem.value);
        itemContent = itemContent.replace(/\{\{this\.category\}\}/g, mem.category);
        return itemContent;
      })
      .join("\n");
  });

  return result.trim();
}

/**
 * Compose prompts from active PromptSlugs based on parameter values
 */
export async function composeFromSlugs(
  context: SlugCompositionContext
): Promise<SlugCompositionResult> {
  // Step 1: Load global memory config
  const memoryConfig = await loadMemoryConfig(context.configName);

  // Step 2: Get parameter values
  let parameterValues = context.parameterValues || {};

  if (!context.parameterValues && context.userId) {
    const profile = await prisma.userPersonalityProfile.findUnique({
      where: { userId: context.userId },
    });
    if (profile?.parameterValues) {
      parameterValues = profile.parameterValues as Record<string, number>;
    }
  }

  // Step 3: Get memories if needed (raw, before filtering)
  let rawMemories: UserMemoryRow[] = [];
  if (context.includeMemories && context.userId) {
    // Build date filter for recency mode
    const dateFilter =
      memoryConfig.relevanceMode === "recent" && memoryConfig.recencyDays
        ? {
            extractedAt: {
              gte: new Date(
                Date.now() - memoryConfig.recencyDays * 24 * 60 * 60 * 1000
              ),
            },
          }
        : {};

    rawMemories = await prisma.userMemory.findMany({
      where: {
        userId: context.userId,
        supersededById: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        ...dateFilter,
      },
      orderBy: [{ confidence: "desc" }, { extractedAt: "desc" }],
      take: 200, // Fetch more than we need, filter later
    });
  }

  // Step 4: Get active PromptSlugs with their parameters and ranges
  const sourceFilter = context.sourceTypes
    ? { sourceType: { in: context.sourceTypes } }
    : {};

  const slugs = await prisma.promptSlug.findMany({
    where: {
      isActive: true,
      ...sourceFilter,
    },
    include: {
      parameters: {
        include: {
          parameter: true,
        },
      },
      ranges: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: [{ priority: "desc" }, { slug: "asc" }],
  });

  // Step 5: Process each slug and find matching prompts
  const composedPrompts: ComposedSlugPrompt[] = [];
  let totalMemoriesUsed = 0;

  for (const slug of slugs) {
    let renderedPrompt: string | null = null;
    let matchedRange: ComposedSlugPrompt["matchedRange"] = null;
    let slugContext: ComposedSlugPrompt["context"] = {};

    if (slug.sourceType === "PARAMETER" || slug.sourceType === "ADAPT") {
      // Get the primary parameter for this slug
      const primaryParam = slug.parameters[0];
      if (!primaryParam) continue;

      const parameterId = primaryParam.parameter.parameterId;
      const value = parameterValues[parameterId];

      if (value === undefined) {
        // No value for this parameter, use fallback if available
        if (slug.fallbackPrompt) {
          renderedPrompt = slug.fallbackPrompt;
        }
      } else {
        // Find matching range
        const range = findMatchingRange(slug.ranges, value, primaryParam.mode);

        if (range) {
          renderedPrompt = range.prompt;
          matchedRange = {
            label: range.label,
            minValue: range.minValue,
            maxValue: range.maxValue,
          };
        } else if (slug.fallbackPrompt) {
          renderedPrompt = slug.fallbackPrompt;
        }

        slugContext = {
          parameterId,
          parameterName: primaryParam.parameter.name,
          value,
          mode: primaryParam.mode,
        };
      }
    } else if (slug.sourceType === "MEMORY") {
      // Memory-based slug - apply injection policy
      const filteredMemories = filterMemories(rawMemories, memoryConfig, {
        memoryMaxItems: slug.memoryMaxItems,
        memoryMinConfidence: slug.memoryMinConfidence,
        memoryKeyPattern: slug.memoryKeyPattern,
        memoryDecayEnabled: slug.memoryDecayEnabled,
        memoryCategory: slug.memoryCategory,
      });

      if (filteredMemories.length > 0) {
        totalMemoriesUsed += filteredMemories.length;

        // Check if we should summarize
        const shouldSummarize =
          memoryConfig.summarizeAbove !== null &&
          filteredMemories.length > memoryConfig.summarizeAbove;

        const memoriesToRender = filteredMemories.map((m) => ({
          category: m.category,
          key: m.key,
          value: m.value,
          confidence: m.effectiveConfidence,
        }));

        // Check memory trigger condition
        const trigger = slug.memoryTrigger || "if_exists";
        let shouldInject = false;

        switch (trigger) {
          case "always":
            shouldInject = true;
            break;
          case "if_exists":
            shouldInject = filteredMemories.length > 0;
            break;
          case "recent_only":
            // Only inject if there are memories from last 7 days
            const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
            shouldInject = filteredMemories.some(
              (m) => m.extractedAt.getTime() > recentCutoff
            );
            break;
          default:
            shouldInject = filteredMemories.length > 0;
        }

        if (shouldInject) {
          if (shouldSummarize && slug.memorySummaryTemplate) {
            // Use summary
            renderedPrompt = summarizeMemories(
              memoriesToRender,
              slug.memorySummaryTemplate
            );
          } else {
            // Find a range with matching condition or use fallback
            const range = slug.ranges.find((r) => r.condition === "has_value");
            if (range) {
              renderedPrompt = renderMemoryTemplate(range.prompt, memoriesToRender);
              matchedRange = {
                label: range.label,
                minValue: null,
                maxValue: null,
              };
            } else if (slug.fallbackPrompt) {
              renderedPrompt = renderMemoryTemplate(
                slug.fallbackPrompt,
                memoriesToRender
              );
            }
          }

          slugContext = {
            memoriesUsed: filteredMemories.length,
          };
        }
      }
    } else if (slug.sourceType === "COMPOSITE") {
      // Composite slug - combines multiple parameters
      // Calculate weighted average of linked parameters
      let weightedSum = 0;
      let totalWeight = 0;

      for (const paramLink of slug.parameters) {
        const value = parameterValues[paramLink.parameter.parameterId];
        if (value !== undefined) {
          weightedSum += value * paramLink.weight;
          totalWeight += paramLink.weight;
        }
      }

      const compositeValue = totalWeight > 0 ? weightedSum / totalWeight : null;

      if (compositeValue !== null) {
        // Find matching range based on composite value
        const range = findMatchingRange(slug.ranges, compositeValue, "ABSOLUTE");

        if (range) {
          // Filter memories for composite template
          const filteredMemories = filterMemories(rawMemories, memoryConfig, {
            memoryMaxItems: slug.memoryMaxItems,
            memoryMinConfidence: slug.memoryMinConfidence,
          });

          const memoriesToRender = filteredMemories.map((m) => ({
            category: m.category,
            key: m.key,
            value: m.value,
            confidence: m.effectiveConfidence,
          }));

          renderedPrompt = renderCompositeTemplate(
            range.prompt,
            parameterValues,
            memoriesToRender
          );
          matchedRange = {
            label: range.label,
            minValue: range.minValue,
            maxValue: range.maxValue,
          };

          slugContext = {
            value: compositeValue,
          };
        } else if (slug.fallbackPrompt) {
          renderedPrompt = slug.fallbackPrompt;
        }
      }
    }

    // Add to results if we got a prompt
    if (renderedPrompt && renderedPrompt.trim()) {
      composedPrompts.push({
        slugId: slug.id,
        slug: slug.slug,
        name: slug.name,
        sourceType: slug.sourceType,
        priority: slug.priority,
        renderedPrompt: renderedPrompt.trim(),
        matchedRange,
        context: slugContext,
      });
    }
  }

  // Step 6: Combine prompts in priority order
  const combinedPrompt = composedPrompts
    .map((p) => p.renderedPrompt)
    .join("\n\n");

  return {
    prompts: composedPrompts,
    combinedPrompt,
    metadata: {
      totalSlugs: slugs.length,
      activeSlugs: slugs.filter((s) => s.isActive).length,
      matchedSlugs: composedPrompts.length,
      parameterValuesUsed: parameterValues,
      memoriesIncluded: totalMemoriesUsed,
      memoryConfig,
      composedAt: new Date().toISOString(),
    },
  };
}

/**
 * Find the matching range for a value
 */
function findMatchingRange(
  ranges: Array<{
    minValue: number | null;
    maxValue: number | null;
    prompt: string;
    label: string | null;
    condition: string | null;
  }>,
  value: number,
  mode: PromptSlugMode | "ABSOLUTE"
): (typeof ranges)[0] | null {
  // For DELTA mode, value represents change, not absolute
  // For GOAL mode, value represents progress toward target

  for (const range of ranges) {
    // Skip condition-based ranges (for memory slugs)
    if (range.condition) continue;

    const min = range.minValue;
    const max = range.maxValue;

    // Check if value falls within range
    const aboveMin = min === null || value >= min;
    const belowMax = max === null || value < max;

    if (aboveMin && belowMax) {
      return range;
    }
  }

  return null;
}

/**
 * Render a memory template with memory values
 */
function renderMemoryTemplate(
  template: string,
  memories: Array<{ category: string; key: string; value: string; confidence: number }>
): string {
  let result = template;

  // Replace {{memoryCount}}
  result = result.replace(/\{\{memoryCount\}\}/g, String(memories.length));

  // Replace {{#each memories}}...{{/each}} blocks
  const eachRegex = /\{\{#each memories\}\}([\s\S]*?)\{\{\/each\}\}/g;
  result = result.replace(eachRegex, (_, content) => {
    return memories
      .map((mem, idx) => {
        let itemContent = content;
        itemContent = itemContent.replace(/\{\{this\.key\}\}/g, mem.key);
        itemContent = itemContent.replace(/\{\{this\.value\}\}/g, mem.value);
        itemContent = itemContent.replace(/\{\{this\.category\}\}/g, mem.category);
        itemContent = itemContent.replace(
          /\{\{this\.confidence\}\}/g,
          mem.confidence.toFixed(2)
        );
        itemContent = itemContent.replace(/\{\{@index\}\}/g, String(idx));
        return itemContent;
      })
      .join("\n");
  });

  // Replace {{#if hasMemories}}...{{/if}} conditional
  result = result.replace(
    /\{\{#if hasMemories\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, content) => (memories.length > 0 ? content : "")
  );

  // Replace {{#unless hasMemories}}...{{/unless}} conditional
  result = result.replace(
    /\{\{#unless hasMemories\}\}([\s\S]*?)\{\{\/unless\}\}/g,
    (_, content) => (memories.length === 0 ? content : "")
  );

  // Replace category-specific accessors: {{memories.FACT}}
  const categoryRegex = /\{\{memories\.(FACT|PREFERENCE|EVENT|TOPIC|RELATIONSHIP)\}\}/g;
  result = result.replace(categoryRegex, (_, category) => {
    const catMemories = memories.filter((m) => m.category === category);
    return catMemories.map((m) => `${m.key}: ${m.value}`).join("; ");
  });

  // Clean up remaining unmatched tags
  result = result.replace(/\{\{[^}]+\}\}/g, "");
  result = result.replace(/\n{3,}/g, "\n\n").trim();

  return result;
}

/**
 * Render a composite template with all parameter values and memories
 */
function renderCompositeTemplate(
  template: string,
  parameterValues: Record<string, number>,
  memories: Array<{ category: string; key: string; value: string; confidence: number }>
): string {
  let result = template;

  // Replace parameter values: {{parameters.B5-O}}
  result = result.replace(/\{\{parameters\.([^}]+)\}\}/g, (_, paramId) => {
    const value = parameterValues[paramId];
    return value !== undefined ? value.toFixed(2) : "";
  });

  // Replace conditionals: {{#if parameters.B5-O >= 0.7}}...{{/if}}
  result = result.replace(
    /\{\{#if parameters\.([^}]+)\s*(>=|<=|>|<|==)\s*([\d.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, paramId, op, threshold, content) => {
      const value = parameterValues[paramId];
      if (value === undefined) return "";

      const thresh = parseFloat(threshold);
      let matches = false;

      switch (op) {
        case ">=":
          matches = value >= thresh;
          break;
        case "<=":
          matches = value <= thresh;
          break;
        case ">":
          matches = value > thresh;
          break;
        case "<":
          matches = value < thresh;
          break;
        case "==":
          matches = Math.abs(value - thresh) < 0.001;
          break;
      }

      return matches ? content : "";
    }
  );

  // Handle memories
  result = renderMemoryTemplate(result, memories);

  // Clean up remaining tags
  result = result.replace(/\{\{[^}]+\}\}/g, "");
  result = result.replace(/\n{3,}/g, "\n\n").trim();

  return result;
}

/**
 * Get a preview of what prompts would be generated for given parameter values
 * (Useful for the prompt preview UI)
 */
export async function previewSlugComposition(
  parameterValues: Record<string, number>,
  memories?: Array<{ category: string; key: string; value: string; confidence: number }>
): Promise<SlugCompositionResult> {
  return composeFromSlugs({
    parameterValues,
    includeMemories: !!memories,
  });
}
