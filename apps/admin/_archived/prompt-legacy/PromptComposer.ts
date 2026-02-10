/**
 * PromptComposer - Runtime prompt composition service
 *
 * Composes a final prompt for a caller by evaluating:
 * - Static blocks (BLOCK items)
 * - Dynamic prompts evaluated against parameter values (SLUG items)
 * - Auto-collected dynamic prompts (AUTO_SLUGS items)
 * - Caller memories (CALLER items)
 *
 * "Last wins" - later items in the stack override earlier guidance
 */

import { PrismaClient, PromptSlugSource, PromptSlugMode } from "@prisma/client";

const prisma = new PrismaClient();

// Types for composition
export type ParameterValues = Record<string, number>; // parameterId -> current value
export type ParameterDeltas = Record<string, number>; // parameterId -> delta from previous

export interface CallerContext {
  callerId: string;
  userId?: string;
  parameterValues: ParameterValues;
  parameterDeltas?: ParameterDeltas;
  // Memories can be passed in or fetched
  memories?: {
    category: string;
    key: string;
    value: string;
    confidence: number;
  }[];
}

export interface ComposedPrompt {
  prompt: string;
  sections: ComposedSection[];
  metadata: {
    stackId: string;
    stackName: string;
    stackVersion: string;
    composedAt: string;
    itemsEvaluated: number;
    slugsMatched: number;
    autoSlugsCollected: number;
  };
}

export interface ComposedSection {
  type: "BLOCK" | "SLUG" | "AUTO_SLUGS" | "CALLER";
  source: string; // block.slug, promptSlug.slug, "auto_slugs", "caller_memories"
  content: string;
  metadata?: {
    parameterId?: string;
    parameterValue?: number;
    rangeLabel?: string;
    weight?: number;
    mode?: string;
  };
}

/**
 * Compose a prompt for a caller using their assigned stack
 */
export async function composePromptForCaller(
  callerId: string,
  parameterValues: ParameterValues,
  parameterDeltas?: ParameterDeltas
): Promise<ComposedPrompt> {
  // Get caller with their stack
  const caller = await prisma.caller.findUnique({
    where: { id: callerId },
    include: {
      promptStack: {
        include: {
          items: {
            where: { isEnabled: true },
            orderBy: { sortOrder: "asc" },
            include: {
              block: true,
              slug: {
                include: {
                  parameters: {
                    include: {
                      parameter: true,
                    },
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
      },
      user: true,
    },
  });

  if (!caller) {
    throw new Error(`Caller not found: ${callerId}`);
  }

  if (!caller.promptStack) {
    throw new Error(`Caller ${callerId} has no assigned prompt stack`);
  }

  const context: CallerContext = {
    callerId,
    userId: caller.userId || undefined,
    parameterValues,
    parameterDeltas,
  };

  // Fetch memories if caller has a user
  if (caller.userId) {
    const memories = await prisma.userMemory.findMany({
      where: {
        userId: caller.userId,
        supersededById: null, // Only current memories
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ confidence: "desc" }, { extractedAt: "desc" }],
      take: 50, // Reasonable limit
    });

    context.memories = memories.map((m) => ({
      category: m.category,
      key: m.key,
      value: m.value,
      confidence: m.confidence,
    }));
  }

  return composePromptFromStack(caller.promptStack, context);
}

/**
 * Compose a prompt from a stack definition and caller context
 */
export async function composePromptFromStack(
  stack: any, // PromptStack with items included
  context: CallerContext
): Promise<ComposedPrompt> {
  const sections: ComposedSection[] = [];
  let autoSlugsCollected = 0;
  let slugsMatched = 0;

  for (const item of stack.items) {
    switch (item.itemType) {
      case "BLOCK":
        if (item.block) {
          sections.push({
            type: "BLOCK",
            source: item.block.slug,
            content: item.block.content,
          });
        }
        break;

      case "SLUG":
        if (item.slug) {
          const result = evaluateSlug(item.slug, context);
          if (result) {
            sections.push(result);
            slugsMatched++;
          }
        }
        break;

      case "AUTO_SLUGS":
        const autoResults = await collectAutoSlugs(item, context);
        sections.push(...autoResults);
        autoSlugsCollected += autoResults.length;
        slugsMatched += autoResults.length;
        break;

      case "CALLER":
        if (context.memories && context.memories.length > 0) {
          const memoryContent = formatCallerMemories(
            context.memories,
            item.callerMemoryCategories,
            item.callerMemoryLimit
          );
          if (memoryContent) {
            sections.push({
              type: "CALLER",
              source: "caller_memories",
              content: memoryContent,
            });
          }
        }
        break;
    }
  }

  // Concatenate all sections into final prompt
  const prompt = sections.map((s) => s.content).join("\n\n");

  return {
    prompt,
    sections,
    metadata: {
      stackId: stack.id,
      stackName: stack.name,
      stackVersion: stack.version,
      composedAt: new Date().toISOString(),
      itemsEvaluated: stack.items.length,
      slugsMatched,
      autoSlugsCollected,
    },
  };
}

/**
 * Evaluate a single dynamic slug against caller's parameter values
 */
function evaluateSlug(slug: any, context: CallerContext): ComposedSection | null {
  // Calculate the effective value for this slug
  const { value, metadata } = calculateSlugValue(slug, context);

  if (value === null) {
    // No matching parameters, use fallback if available
    if (slug.fallbackPrompt) {
      return {
        type: "SLUG",
        source: slug.slug,
        content: slug.fallbackPrompt,
        metadata: { ...metadata, rangeLabel: "fallback" },
      };
    }
    return null;
  }

  // Find matching range
  const matchingRange = findMatchingRange(slug.ranges, value);

  if (matchingRange) {
    return {
      type: "SLUG",
      source: slug.slug,
      content: matchingRange.prompt,
      metadata: {
        ...metadata,
        parameterValue: value,
        rangeLabel: matchingRange.label || undefined,
      },
    };
  }

  // No range matched, use fallback
  if (slug.fallbackPrompt) {
    return {
      type: "SLUG",
      source: slug.slug,
      content: slug.fallbackPrompt,
      metadata: { ...metadata, parameterValue: value, rangeLabel: "fallback" },
    };
  }

  return null;
}

/**
 * Calculate the effective value for a slug based on its parameters
 * Supports single parameter, composite (weighted average), and delta modes
 */
function calculateSlugValue(
  slug: any,
  context: CallerContext
): { value: number | null; metadata: any } {
  const { parameterValues, parameterDeltas } = context;
  const params = slug.parameters || [];

  if (params.length === 0) {
    return { value: null, metadata: {} };
  }

  // Single parameter case
  if (params.length === 1) {
    const p = params[0];
    const parameterId = p.parameterId;
    const mode = p.mode;

    if (mode === "DELTA" && parameterDeltas && parameterDeltas[parameterId] !== undefined) {
      return {
        value: parameterDeltas[parameterId],
        metadata: { parameterId, mode: "DELTA" },
      };
    }

    if (parameterValues[parameterId] !== undefined) {
      return {
        value: parameterValues[parameterId],
        metadata: { parameterId, mode: "ABSOLUTE" },
      };
    }

    return { value: null, metadata: { parameterId } };
  }

  // Composite case: weighted average
  let weightedSum = 0;
  let totalWeight = 0;
  const usedParams: string[] = [];

  for (const p of params) {
    const parameterId = p.parameterId;
    const weight = p.weight ?? 1.0;
    const mode = p.mode;

    let value: number | undefined;

    if (mode === "DELTA" && parameterDeltas && parameterDeltas[parameterId] !== undefined) {
      value = parameterDeltas[parameterId];
    } else if (parameterValues[parameterId] !== undefined) {
      value = parameterValues[parameterId];
    }

    if (value !== undefined) {
      weightedSum += value * weight;
      totalWeight += weight;
      usedParams.push(parameterId);
    }
  }

  if (totalWeight === 0) {
    return { value: null, metadata: { composite: true, parametersChecked: params.length } };
  }

  const compositeValue = weightedSum / totalWeight;

  return {
    value: compositeValue,
    metadata: {
      composite: true,
      parametersUsed: usedParams.length,
      totalWeight,
    },
  };
}

/**
 * Find the matching range for a value
 */
function findMatchingRange(ranges: any[], value: number): any | null {
  for (const range of ranges) {
    const minOk = range.minValue === null || value >= range.minValue;
    const maxOk = range.maxValue === null || value < range.maxValue;

    if (minOk && maxOk) {
      return range;
    }
  }
  return null;
}

/**
 * Auto-collect all relevant dynamic prompts for the caller
 */
async function collectAutoSlugs(
  item: any,
  context: CallerContext
): Promise<ComposedSection[]> {
  const { parameterValues } = context;
  const parameterIds = Object.keys(parameterValues);

  if (parameterIds.length === 0) {
    return [];
  }

  // Build query for slugs
  const sourceTypes = item.autoSlugSourceTypes?.length > 0
    ? item.autoSlugSourceTypes
    : ["PARAMETER", "COMPOSITE"];

  // Find all active slugs that use any of the caller's parameters
  const slugs = await prisma.promptSlug.findMany({
    where: {
      isActive: true,
      sourceType: { in: sourceTypes as PromptSlugSource[] },
      parameters: {
        some: {
          parameterId: { in: parameterIds },
        },
      },
    },
    include: {
      parameters: {
        include: {
          parameter: {
            select: {
              parameterId: true,
              name: true,
              domainGroup: true,
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      ranges: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: getAutoSlugOrderBy(item.autoSlugOrderBy),
  });

  // Filter by domain if specified
  let filteredSlugs = slugs;
  if (item.autoSlugDomainFilter?.length > 0) {
    const domainFilter = new Set(item.autoSlugDomainFilter);
    filteredSlugs = slugs.filter((s) =>
      s.parameters.some((p) => domainFilter.has(p.parameter.domainGroup))
    );
  }

  // Apply limit if specified
  if (item.autoSlugLimit && item.autoSlugLimit > 0) {
    filteredSlugs = filteredSlugs.slice(0, item.autoSlugLimit);
  }

  // Evaluate each slug
  const results: ComposedSection[] = [];
  for (const slug of filteredSlugs) {
    const result = evaluateSlug(slug, context);
    if (result) {
      // Mark as auto-collected
      result.type = "AUTO_SLUGS";
      results.push(result);
    }
  }

  return results;
}

/**
 * Get orderBy clause for auto slug collection
 */
function getAutoSlugOrderBy(orderBy?: string): any {
  switch (orderBy) {
    case "priority":
      return [{ priority: "desc" }, { name: "asc" }];
    case "domainGroup":
      // Order by first parameter's domain group
      return [{ name: "asc" }]; // Simplified - would need to join
    case "name":
      return { name: "asc" };
    default:
      return [{ priority: "desc" }, { name: "asc" }];
  }
}

/**
 * Format caller memories into prompt text
 */
function formatCallerMemories(
  memories: { category: string; key: string; value: string; confidence: number }[],
  categoryFilter?: string[],
  limit?: number | null
): string | null {
  let filtered = memories;

  // Filter by category if specified
  if (categoryFilter && categoryFilter.length > 0) {
    const filterSet = new Set(categoryFilter);
    filtered = memories.filter((m) => filterSet.has(m.category));
  }

  // Apply limit
  if (limit && limit > 0) {
    filtered = filtered.slice(0, limit);
  }

  if (filtered.length === 0) {
    return null;
  }

  // Format memories into text
  const lines = filtered.map((m) => `- ${m.key}: ${m.value}`);

  return `About this caller:\n${lines.join("\n")}`;
}

/**
 * Preview what a composition would produce without saving
 */
export async function previewComposition(
  stackId: string,
  parameterValues: ParameterValues,
  parameterDeltas?: ParameterDeltas
): Promise<ComposedPrompt> {
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
                include: {
                  parameter: true,
                },
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

  const context: CallerContext = {
    callerId: "preview",
    parameterValues,
    parameterDeltas,
    memories: [], // No memories for preview
  };

  return composePromptFromStack(stack, context);
}
