/**
 * Memory category mappings — normalizes LLM output to valid MemoryCategory enum values.
 * Mirrors the taxonomy config from the system-memory-taxonomy spec.
 */

import { MemoryCategory } from "@prisma/client";

const CATEGORY_MAPPINGS: Record<string, MemoryCategory> = {
  // Direct matches (uppercase)
  "FACT": MemoryCategory.FACT,
  "PREFERENCE": MemoryCategory.PREFERENCE,
  "EVENT": MemoryCategory.EVENT,
  "TOPIC": MemoryCategory.TOPIC,
  "RELATIONSHIP": MemoryCategory.RELATIONSHIP,
  "CONTEXT": MemoryCategory.CONTEXT,
  // Common variations LLM might return
  "INTEREST": MemoryCategory.TOPIC,
  "INTEREST_": MemoryCategory.TOPIC,
  "INTERESTS": MemoryCategory.TOPIC,
  "HOBBY": MemoryCategory.TOPIC,
  "HOBBIES": MemoryCategory.TOPIC,
  "LIKE": MemoryCategory.PREFERENCE,
  "LIKES": MemoryCategory.PREFERENCE,
  "DISLIKE": MemoryCategory.PREFERENCE,
  "DISLIKES": MemoryCategory.PREFERENCE,
  "PERSONAL": MemoryCategory.FACT,
  "PERSONAL_INFO": MemoryCategory.FACT,
  "DEMOGRAPHIC": MemoryCategory.FACT,
  "LOCATION": MemoryCategory.FACT,
  "EXPERIENCE": MemoryCategory.EVENT,
  "HISTORY": MemoryCategory.EVENT,
  "SITUATION": MemoryCategory.CONTEXT,
  "CURRENT": MemoryCategory.CONTEXT,
  "FAMILY": MemoryCategory.RELATIONSHIP,
  "FRIEND": MemoryCategory.RELATIONSHIP,
  "WORK": MemoryCategory.FACT,
  "JOB": MemoryCategory.FACT,
};

const DEFAULT_CATEGORY = MemoryCategory.FACT;

/**
 * Map LLM category output to valid MemoryCategory enum
 */
export function mapToMemoryCategory(category: string): MemoryCategory {
  if (!category) return DEFAULT_CATEGORY;

  // Clean up the category string
  const cleaned = category.toUpperCase().trim().replace(/[^A-Z_]/g, '');

  // Direct enum match
  if (cleaned in MemoryCategory) {
    return cleaned as MemoryCategory;
  }

  // Lookup in mappings
  const mapped = CATEGORY_MAPPINGS[cleaned];
  if (mapped) {
    return mapped;
  }

  // Try partial match (e.g., "interest_" -> "INTEREST")
  for (const [key, value] of Object.entries(CATEGORY_MAPPINGS)) {
    if (cleaned.startsWith(key) || key.startsWith(cleaned)) {
      return value;
    }
  }

  return DEFAULT_CATEGORY;
}
