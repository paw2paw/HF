/**
 * PromptStackComposer
 *
 * Composes a final prompt by evaluating a PromptStack against a caller's:
 * - Parameter values (from UserPersonality or CallScores)
 * - Memories (from UserMemory)
 *
 * Stack item types:
 * - BLOCK: Static prompt text (from PromptBlock)
 * - SLUG: Single dynamic prompt (evaluated against parameter values)
 * - CALLER: Auto-generated from caller's memories
 * - AUTO_SLUGS: Auto-collect all matching dynamic prompts
 */

import { prisma } from "@/lib/prisma";

// Types for the composer
export interface CallerContext {
  callerId: string;
  userId?: string;
  // Parameter values: parameterId -> score (0-1)
  parameterValues: Record<string, number>;
  // Previous parameter values for DELTA mode (optional)
  previousValues?: Record<string, number>;
  // Memories: category -> array of memory values
  memories?: Record<string, MemoryItem[]>;
}

export interface MemoryItem {
  key: string;
  value: string;
  confidence: number;
  source: string;
}

export interface ComposedPrompt {
  // The final composed prompt text
  text: string;
  // Debug info: which slugs matched and why
  matches: SlugMatch[];
  // Stack used
  stackId: string;
  stackName: string;
  // Timestamp
  composedAt: Date;
}

export interface SlugMatch {
  slugId: string;
  slugSlug: string;
  slugName: string;
  sourceType: string;
  // Which range matched (if any)
  rangeLabel?: string;
  // The prompt text selected
  promptText: string;
  // Which parameters drove this match
  parameters: Array<{
    parameterId: string;
    value: number;
    weight: number;
    mode: string;
  }>;
  // Computed effective value (weighted)
  effectiveValue?: number;
  // Priority for ordering
  priority: number;
}

/**
 * Compose a prompt for a caller using their assigned stack
 */
export async function composePromptForCaller(
  callerId: string,
  options?: {
    // Override stack (instead of caller's assigned stack)
    stackId?: string;
    // Include debug info
    debug?: boolean;
  }
): Promise<ComposedPrompt> {
  // 1. Get the caller
  const caller = await prisma.caller.findUnique({
    where: { id: callerId },
    include: {
      user: {
        include: {
          personality: true,
          memories: {
            where: { supersededById: null },
            orderBy: { confidence: "desc" },
          },
        },
      },
    },
  });

  if (!caller) {
    throw new Error(`Caller not found: ${callerId}`);
  }

  // 2. Determine which stack to use
  const stackId = options?.stackId || caller.promptStackId;
  if (!stackId) {
    // Try to get the default stack
    const defaultStack = await prisma.promptStack.findFirst({
      where: { isDefault: true, status: "PUBLISHED" },
    });
    if (!defaultStack) {
      throw new Error("No stack assigned to caller and no default stack found");
    }
  }

  // 3. Build caller context from user data
  const context: CallerContext = {
    callerId,
    userId: caller.userId || undefined,
    parameterValues: {},
    memories: {},
  };

  // Extract personality values as parameter values
  if (caller.user?.personality) {
    const p = caller.user.personality;
    // Map personality fields to parameter IDs
    // These should match your parameter IDs
    if (p.openness != null) context.parameterValues["B5-O"] = p.openness;
    if (p.conscientiousness != null) context.parameterValues["B5-C"] = p.conscientiousness;
    if (p.extraversion != null) context.parameterValues["B5-E"] = p.extraversion;
    if (p.agreeableness != null) context.parameterValues["B5-A"] = p.agreeableness;
    if (p.neuroticism != null) context.parameterValues["B5-N"] = p.neuroticism;
  }

  // Extract memories grouped by category
  if (caller.user?.memories) {
    for (const mem of caller.user.memories) {
      if (!context.memories![mem.category]) {
        context.memories![mem.category] = [];
      }
      context.memories![mem.category].push({
        key: mem.key,
        value: mem.value,
        confidence: mem.confidence,
        source: mem.source,
      });
    }
  }

  // 4. Compose using the stack
  return composePromptWithStack(stackId!, context);
}

/**
 * Compose a prompt using a specific stack and context
 */
export async function composePromptWithStack(
  stackId: string,
  context: CallerContext
): Promise<ComposedPrompt> {
  // Load the stack with all items
  const stack = await prisma.promptStack.findUnique({
    where: { id: stackId },
    include: {
      items: {
        where: { isEnabled: true },
        orderBy: { sortOrder: "asc" },
        include: {
          block: true,
          slug: {
            include: {
              parameters: {
                include: { parameter: true },
                orderBy: { sortOrder: "asc" },
              },
              ranges: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!stack) {
    throw new Error(`Stack not found: ${stackId}`);
  }

  const promptParts: string[] = [];
  const matches: SlugMatch[] = [];

  // Process each item in order
  for (const item of stack.items) {
    switch (item.itemType) {
      case "BLOCK": {
        // Static block - just include the content
        if (item.block?.content && item.block.isActive) {
          promptParts.push(item.block.content);
        }
        break;
      }

      case "SLUG": {
        // Single dynamic slug - evaluate against parameters
        if (item.slug) {
          const match = evaluateSlug(item.slug, context);
          if (match) {
            promptParts.push(match.promptText);
            matches.push(match);
          }
        }
        break;
      }

      case "CALLER": {
        // Auto-generate from caller's memories
        const memoryText = formatCallerMemories(
          context.memories || {},
          item.callerMemoryCategories,
          item.callerMemoryLimit || undefined
        );
        if (memoryText) {
          promptParts.push(memoryText);
        }
        break;
      }

      case "AUTO_SLUGS": {
        // Auto-collect all matching slugs
        const autoMatches = await collectAutoSlugs(
          context,
          item.autoSlugSourceTypes,
          item.autoSlugOrderBy || "priority",
          item.autoSlugLimit || undefined,
          item.autoSlugDomainFilter
        );
        for (const match of autoMatches) {
          promptParts.push(match.promptText);
          matches.push(match);
        }
        break;
      }
    }
  }

  return {
    text: promptParts.join("\n\n"),
    matches,
    stackId: stack.id,
    stackName: stack.name,
    composedAt: new Date(),
  };
}

/**
 * Evaluate a single slug against the caller's parameter values
 */
function evaluateSlug(
  slug: any, // The slug with parameters and ranges loaded
  context: CallerContext
): SlugMatch | null {
  if (!slug.isActive) return null;

  const params = slug.parameters || [];
  const ranges = slug.ranges || [];

  // Calculate effective value based on source type
  let effectiveValue: number | null = null;
  const matchedParams: SlugMatch["parameters"] = [];

  if (slug.sourceType === "PARAMETER" || slug.sourceType === "COMPOSITE" || slug.sourceType === "ADAPT") {
    // Single, composite, or adapt parameter evaluation
    let weightedSum = 0;
    let totalWeight = 0;

    for (const p of params) {
      const parameterId = p.parameter?.parameterId || p.parameterId;
      const value = context.parameterValues[parameterId];

      if (value !== undefined) {
        const weight = p.weight || 1.0;

        if (p.mode === "DELTA" && context.previousValues) {
          // DELTA mode: use the change in value
          const prevValue = context.previousValues[parameterId] || value;
          const delta = value - prevValue;
          weightedSum += delta * weight;
        } else if (p.mode === "GOAL") {
          // GOAL mode: value is already the progress (0-1)
          // Just use it directly
          weightedSum += value * weight;
        } else {
          // ABSOLUTE mode: use the value directly
          weightedSum += value * weight;
        }
        totalWeight += weight;

        matchedParams.push({
          parameterId,
          value,
          weight,
          mode: p.mode || "ABSOLUTE",
        });
      }
    }

    if (totalWeight > 0) {
      effectiveValue = weightedSum / totalWeight;
    }
  } else if (slug.sourceType === "MEMORY") {
    // Memory-based slug - check if relevant memories exist
    const category = slug.memoryCategory;
    if (category && context.memories?.[category]?.length) {
      // For memory slugs, we use confidence as the "value"
      const topMemory = context.memories[category][0];
      effectiveValue = topMemory.confidence;
    }
  }

  // Find matching range
  let matchedRange: any = null;
  let promptText = slug.fallbackPrompt || "";

  if (effectiveValue !== null && ranges.length > 0) {
    for (const range of ranges) {
      const minOk = range.minValue === null || effectiveValue >= range.minValue;
      const maxOk = range.maxValue === null || effectiveValue < range.maxValue;

      if (minOk && maxOk) {
        matchedRange = range;
        promptText = range.prompt;
        break;
      }
    }
  }

  // Return null if no prompt text
  if (!promptText) return null;

  return {
    slugId: slug.id,
    slugSlug: slug.slug,
    slugName: slug.name,
    sourceType: slug.sourceType,
    rangeLabel: matchedRange?.label || undefined,
    promptText,
    parameters: matchedParams,
    effectiveValue: effectiveValue ?? undefined,
    priority: slug.priority || 0,
  };
}

/**
 * Format caller memories into prompt text
 */
function formatCallerMemories(
  memories: Record<string, MemoryItem[]>,
  categories: string[],
  limit?: number
): string | null {
  const lines: string[] = [];
  let count = 0;

  // If no categories specified, use all
  const cats = categories.length > 0 ? categories : Object.keys(memories);

  for (const cat of cats) {
    const items = memories[cat] || [];
    for (const item of items) {
      if (limit && count >= limit) break;
      lines.push(`- ${item.key}: ${item.value}`);
      count++;
    }
    if (limit && count >= limit) break;
  }

  if (lines.length === 0) return null;

  return `Known information about this caller:\n${lines.join("\n")}`;
}

/**
 * Auto-collect all matching slugs based on caller's parameter values
 */
async function collectAutoSlugs(
  context: CallerContext,
  sourceTypes: string[],
  orderBy: string,
  limit?: number,
  domainFilter?: string[]
): Promise<SlugMatch[]> {
  // Get all active slugs matching the source types
  const where: any = {
    isActive: true,
  };

  if (sourceTypes.length > 0) {
    where.sourceType = { in: sourceTypes };
  }

  const slugs = await prisma.promptSlug.findMany({
    where,
    include: {
      parameters: {
        include: { parameter: true },
        orderBy: { sortOrder: "asc" },
      },
      ranges: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  // Evaluate each slug
  const matches: SlugMatch[] = [];

  for (const slug of slugs) {
    // Apply domain filter if specified
    if (domainFilter && domainFilter.length > 0) {
      const slugDomains = slug.parameters.map((p) => p.parameter?.domainGroup).filter(Boolean);
      const matchesDomain = domainFilter.some((d) => slugDomains.includes(d));
      if (!matchesDomain) continue;
    }

    const match = evaluateSlug(slug, context);
    if (match) {
      matches.push(match);
    }
  }

  // Sort by specified order
  if (orderBy === "priority") {
    matches.sort((a, b) => b.priority - a.priority);
  } else if (orderBy === "name") {
    matches.sort((a, b) => a.slugName.localeCompare(b.slugName));
  }

  // Apply limit
  if (limit && matches.length > limit) {
    return matches.slice(0, limit);
  }

  return matches;
}

/**
 * Preview prompt composition with custom parameter values
 * Useful for testing without a real caller
 */
export async function previewPrompt(
  stackId: string,
  parameterValues: Record<string, number>,
  memories?: Record<string, MemoryItem[]>
): Promise<ComposedPrompt> {
  const context: CallerContext = {
    callerId: "preview",
    parameterValues,
    memories: memories || {},
  };

  return composePromptWithStack(stackId, context);
}
