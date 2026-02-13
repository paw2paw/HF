/**
 * Memory Transforms — Spec-Driven Sub-Flow
 *
 * 3 chainable transforms declared in COMP-001 memory section:
 *   1. deduplicateMemories — deduplicate by normalized key
 *   2. scoreMemoryRelevance — blend confidence with contextual relevance
 *   3. groupMemoriesByCategory — group into byCategory + all + _deduplicated
 *
 * Also registers the legacy monolithic "deduplicateAndGroupMemories" for
 * backward compatibility (specs that haven't switched to the array form).
 */

import { registerTransform } from "../TransformRegistry";
import type { AssembledContext, CompositionSectionDef, MemoryData } from "../types";

/**
 * Compute contextual relevance of a memory to the current session.
 *
 * Uses keyword overlap between memory content and session context,
 * plus an optional per-category boost from spec config.
 *
 * @param memory - The memory to score
 * @param sessionContext - Current session context (modules, goals, topics)
 * @param categoryWeights - Per-category boost weights from COMP-001 spec (default: no boost)
 * @returns 0-1 relevance score
 */
export function computeMemoryRelevance(
  memory: MemoryData,
  sessionContext: {
    currentModule?: string | null;
    nextModule?: string | null;
    recentTopics?: string[];
    upcomingTopics?: string[];
    learnerGoals?: string[];
  },
  categoryWeights?: Record<string, number>,
): number {
  const weights = categoryWeights || {};

  // Build a set of context keywords (lowered, split by spaces)
  const contextTokens = new Set<string>();
  const addTokens = (text: string | null | undefined) => {
    if (!text) return;
    text.toLowerCase().split(/\s+/).forEach((t) => {
      if (t.length > 2) contextTokens.add(t);
    });
  };

  addTokens(sessionContext.currentModule);
  addTokens(sessionContext.nextModule);
  (sessionContext.recentTopics || []).forEach(addTokens);
  (sessionContext.upcomingTopics || []).forEach(addTokens);
  (sessionContext.learnerGoals || []).forEach(addTokens);

  if (contextTokens.size === 0) {
    // No session context → pure category boost (or 0)
    return Math.min(1, Math.max(0, weights[memory.category] || 0));
  }

  // Compute keyword overlap
  const memoryText = `${memory.key} ${memory.value}`.toLowerCase();
  const memoryTokens = memoryText.split(/\s+/).filter((t) => t.length > 2);

  let matches = 0;
  for (const token of memoryTokens) {
    if (contextTokens.has(token)) matches++;
  }

  const overlapScore = memoryTokens.length > 0
    ? Math.min(1, matches / Math.min(memoryTokens.length, 3))
    : 0;

  // Add category boost (capped at 1.0 total)
  const categoryBoost = weights[memory.category] || 0;
  return Math.min(1, overlapScore + categoryBoost);
}

// ---------------------------------------------------------------------------
// Step 1: Deduplicate by normalized key (highest confidence wins)
// Input:  MemoryData[]
// Output: MemoryData[]
// ---------------------------------------------------------------------------
registerTransform("deduplicateMemories", (
  rawData: MemoryData[],
  _context: AssembledContext,
  _sectionDef: CompositionSectionDef,
) => {
  const memories = rawData || [];
  const seen = new Map<string, MemoryData>();
  for (const m of memories) {
    const normalizedKey = `${m.category}:${m.key.toLowerCase().replace(/\s+/g, "_")}`;
    const existing = seen.get(normalizedKey);
    if (!existing || m.confidence > existing.confidence) {
      seen.set(normalizedKey, m);
    }
  }
  return Array.from(seen.values());
});

// ---------------------------------------------------------------------------
// Step 2: Score relevance, blend with confidence, sort
// Input:  MemoryData[]
// Output: ScoredMemory[] (MemoryData + relevance + combinedScore), sorted desc
// ---------------------------------------------------------------------------
registerTransform("scoreMemoryRelevance", (
  rawData: MemoryData[],
  context: AssembledContext,
  sectionDef: CompositionSectionDef,
) => {
  const memories = rawData || [];
  const memConfig = sectionDef.config || {};
  const alpha: number = memConfig.relevanceAlpha ?? context.specConfig.relevanceAlpha ?? 1.0;
  const categoryWeights: Record<string, number> = memConfig.categoryRelevanceWeights ?? {};

  const sessionContext = {
    currentModule: context.sharedState?.moduleToReview?.name || null,
    nextModule: context.sharedState?.nextModule?.name || null,
    upcomingTopics: (context.sharedState?.modules || [])
      .slice(
        (context.sharedState?.lastCompletedIndex ?? -1) + 1,
        (context.sharedState?.lastCompletedIndex ?? -1) + 3,
      )
      .map((m: any) => m.name),
    learnerGoals: (context.loadedData?.goals || []).map((g: any) => g.name),
  };

  const scored = memories.map((m) => {
    const relevance = computeMemoryRelevance(m, sessionContext, categoryWeights);
    const combinedScore = alpha * m.confidence + (1 - alpha) * relevance;
    return { ...m, relevance, combinedScore };
  });
  scored.sort((a, b) => b.combinedScore - a.combinedScore);
  return scored;
});

// ---------------------------------------------------------------------------
// Step 3: Group into byCategory + all + _deduplicated
// Input:  MemoryData[] (or ScoredMemory[])
// Output: { totalCount, byCategory, all, _deduplicated }
// ---------------------------------------------------------------------------
registerTransform("groupMemoriesByCategory", (
  rawData: MemoryData[],
  context: AssembledContext,
  sectionDef: CompositionSectionDef,
) => {
  const memories = rawData || [];
  const memoriesPerCategory = sectionDef.config?.memoriesPerCategory || context.specConfig.memoriesPerCategory || 5;
  const memoriesLimit = sectionDef.config?.memoriesLimit || context.specConfig.memoriesLimit || 50;

  const byCategory: Record<string, Array<{ key: string; value: string; confidence: number }>> = {};
  for (const m of memories) {
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
    totalCount: memories.length,
    byCategory,
    all: memories.slice(0, memoriesLimit).map((m) => ({
      category: m.category,
      key: m.key,
      value: m.value,
      confidence: m.confidence,
    })),
    _deduplicated: memories,
  };
});

// ---------------------------------------------------------------------------
// Legacy monolithic transform — backward compat for specs using single string
// ---------------------------------------------------------------------------
registerTransform("deduplicateAndGroupMemories", (
  rawData: MemoryData[],
  context: AssembledContext,
  sectionDef: CompositionSectionDef,
) => {
  const memories = rawData || [];
  const memoriesPerCategory = sectionDef.config?.memoriesPerCategory || context.specConfig.memoriesPerCategory || 5;
  const memoriesLimit = sectionDef.config?.memoriesLimit || context.specConfig.memoriesLimit || 50;

  // Step 1: Deduplicate
  const seen = new Map<string, MemoryData>();
  for (const m of memories) {
    const normalizedKey = `${m.category}:${m.key.toLowerCase().replace(/\s+/g, "_")}`;
    const existing = seen.get(normalizedKey);
    if (!existing || m.confidence > existing.confidence) {
      seen.set(normalizedKey, m);
    }
  }
  const deduplicated = Array.from(seen.values());

  // Step 2: Score + sort
  const memConfig = sectionDef.config || {};
  const alpha: number = memConfig.relevanceAlpha ?? context.specConfig.relevanceAlpha ?? 1.0;
  const categoryWeights: Record<string, number> = memConfig.categoryRelevanceWeights ?? {};

  const sessionContext = {
    currentModule: context.sharedState?.moduleToReview?.name || null,
    nextModule: context.sharedState?.nextModule?.name || null,
    upcomingTopics: (context.sharedState?.modules || [])
      .slice(
        (context.sharedState?.lastCompletedIndex ?? -1) + 1,
        (context.sharedState?.lastCompletedIndex ?? -1) + 3,
      )
      .map((m: any) => m.name),
    learnerGoals: (context.loadedData?.goals || []).map((g: any) => g.name),
  };

  const scored = deduplicated.map((m) => {
    const relevance = computeMemoryRelevance(m, sessionContext, categoryWeights);
    const combinedScore = alpha * m.confidence + (1 - alpha) * relevance;
    return { ...m, relevance, combinedScore };
  });
  scored.sort((a, b) => b.combinedScore - a.combinedScore);

  // Step 3: Group
  const byCategory: Record<string, Array<{ key: string; value: string; confidence: number }>> = {};
  for (const m of scored) {
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
    totalCount: scored.length,
    byCategory,
    all: scored.slice(0, memoriesLimit).map((m) => ({
      category: m.category,
      key: m.key,
      value: m.value,
      confidence: m.confidence,
    })),
    _deduplicated: scored,
  };
});
