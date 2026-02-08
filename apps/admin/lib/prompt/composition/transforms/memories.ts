/**
 * Memory Transforms
 * Extracted from route.ts lines 1337-1362, 1746-1756
 */

import { registerTransform } from "../TransformRegistry";
import type { AssembledContext, CompositionSectionDef, MemoryData } from "../types";

/**
 * Deduplicate memories by normalized key, group by category, limit per category.
 * Returns the structured memories object for the llmPrompt.
 */
registerTransform("deduplicateAndGroupMemories", (
  rawData: MemoryData[],
  context: AssembledContext,
  sectionDef: CompositionSectionDef,
) => {
  const memories = rawData || [];
  const memoriesPerCategory = sectionDef.config?.memoriesPerCategory || context.specConfig.memoriesPerCategory || 5;

  // Deduplicate by normalized key (handle case differences)
  const seen = new Map<string, MemoryData>();
  for (const m of memories) {
    const normalizedKey = `${m.category}:${m.key.toLowerCase().replace(/\s+/g, "_")}`;
    const existing = seen.get(normalizedKey);
    if (!existing || m.confidence > existing.confidence) {
      seen.set(normalizedKey, m);
    }
  }
  const deduplicated = Array.from(seen.values());

  // Group by category with per-category limit
  const byCategory: Record<string, Array<{ key: string; value: string; confidence: number }>> = {};
  for (const m of deduplicated) {
    if (!byCategory[m.category]) byCategory[m.category] = [];
    if (byCategory[m.category].length < memoriesPerCategory) {
      byCategory[m.category].push({
        key: m.key,
        value: m.value,
        confidence: m.confidence,
      });
    }
  }

  return {
    totalCount: deduplicated.length,
    byCategory,
    all: deduplicated.slice(0, 20).map((m) => ({
      category: m.category,
      key: m.key,
      value: m.value,
      confidence: m.confidence,
    })),
    // Store deduplicated list in context for other transforms (instructions)
    _deduplicated: deduplicated,
  };
});
