/**
 * Shared category metadata for ContentAssertion categories.
 * Used by ExtractionSummary, ScaffoldPanel, CourseWhatTab, etc.
 */

export const CONTENT_CATEGORIES: Record<string, { color: string; bg: string; label: string }> = {
  fact:       { color: 'var(--accent-primary)',              bg: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)',              label: 'Facts' },
  definition: { color: 'var(--badge-cyan-text, #0891b2)',    bg: 'color-mix(in srgb, var(--badge-cyan-text, #0891b2) 10%, transparent)',    label: 'Definitions' },
  rule:       { color: 'var(--status-warning-text)',          bg: 'color-mix(in srgb, var(--status-warning-text) 10%, transparent)',          label: 'Rules' },
  process:    { color: 'var(--accent-secondary, #8b5cf6)',   bg: 'color-mix(in srgb, var(--accent-secondary, #8b5cf6) 10%, transparent)',   label: 'Processes' },
  example:    { color: 'var(--status-success-text)',          bg: 'color-mix(in srgb, var(--status-success-text) 10%, transparent)',          label: 'Examples' },
  threshold:  { color: 'var(--badge-pink-text, #be185d)',    bg: 'color-mix(in srgb, var(--badge-pink-text, #be185d) 10%, transparent)',    label: 'Thresholds' },
};

export const CATEGORY_ORDER = ['fact', 'definition', 'rule', 'process', 'example', 'threshold'] as const;
