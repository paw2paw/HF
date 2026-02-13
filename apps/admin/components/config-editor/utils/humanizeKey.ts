/**
 * Convert camelCase/snake_case config keys to human-readable labels.
 *
 * "categoryRelevanceWeights" → "Category Relevance Weights"
 * "memoriesPerCategory"      → "Memories Per Category"
 * "include_memories"         → "Include Memories"
 */
export function humanizeKey(key: string): string {
  return key
    // Insert space before uppercase letters (camelCase)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // Replace underscores with spaces
    .replace(/_/g, " ")
    // Capitalize first letter of each word
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
