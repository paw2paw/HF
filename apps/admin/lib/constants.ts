/**
 * Shared constants for the HF Admin application
 *
 * These constants are derived from Prisma's generated enums where possible,
 * ensuring type safety and consistency across the codebase.
 */

import { MemoryCategory } from "@prisma/client";

/**
 * All memory categories as an array
 * Use this when you need to iterate over categories or build UI selects
 */
export const MEMORY_CATEGORIES = Object.values(MemoryCategory) as MemoryCategory[];

/**
 * Memory category metadata for UI display
 */
export const MEMORY_CATEGORY_META: Record<MemoryCategory, {
  label: string;
  description: string;
  color: { bg: string; text: string };
  icon: string;
}> = {
  FACT: {
    label: "Fact",
    description: "Immutable facts about the caller",
    color: { bg: "#dbeafe", text: "#2563eb" },
    icon: "📌",
  },
  PREFERENCE: {
    label: "Preference",
    description: "Caller preferences and communication style",
    color: { bg: "#fef3c7", text: "#d97706" },
    icon: "⭐",
  },
  EVENT: {
    label: "Event",
    description: "Time-bound events and interactions",
    color: { bg: "#dcfce7", text: "#16a34a" },
    icon: "📅",
  },
  TOPIC: {
    label: "Topic",
    description: "Topics of interest discussed",
    color: { bg: "#f3e8ff", text: "#9333ea" },
    icon: "💡",
  },
  RELATIONSHIP: {
    label: "Relationship",
    description: "Relationships and connections",
    color: { bg: "#fce7f3", text: "#db2777" },
    icon: "👥",
  },
  CONTEXT: {
    label: "Context",
    description: "Situational context that may change",
    color: { bg: "#e5e7eb", text: "#4b5563" },
    icon: "📍",
  },
};

/**
 * Group memories by category
 * @param memories Array of objects with a category field
 * @returns Object with category keys and arrays of memories
 */
export function groupMemoriesByCategory<T extends { category: string }>(
  memories: T[]
): Record<MemoryCategory, T[]> {
  const groups = {} as Record<MemoryCategory, T[]>;

  // Initialize all categories with empty arrays
  for (const cat of MEMORY_CATEGORIES) {
    groups[cat] = [];
  }

  // Group memories
  for (const memory of memories) {
    const cat = memory.category as MemoryCategory;
    if (groups[cat]) {
      groups[cat].push(memory);
    }
  }

  return groups;
}

/**
 * Get memories grouped by category with optional limit per category
 * @param memories Array of objects with a category field
 * @param limitPerCategory Maximum items per category (default: no limit)
 * @returns Object with lowercase category keys (facts, preferences, etc.)
 */
export function getMemoriesByCategory<T extends { category: string }>(
  memories: T[],
  limitPerCategory?: number
): {
  facts: T[];
  preferences: T[];
  events: T[];
  topics: T[];
  relationships: T[];
  context: T[];
} {
  const grouped = groupMemoriesByCategory(memories);

  const slice = (arr: T[]) => limitPerCategory ? arr.slice(0, limitPerCategory) : arr;

  return {
    facts: slice(grouped.FACT),
    preferences: slice(grouped.PREFERENCE),
    events: slice(grouped.EVENT),
    topics: slice(grouped.TOPIC),
    relationships: slice(grouped.RELATIONSHIP),
    context: slice(grouped.CONTEXT),
  };
}
