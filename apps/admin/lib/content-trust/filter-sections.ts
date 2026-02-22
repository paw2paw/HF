/**
 * Smart Section Filtering
 *
 * Post-segmentation filter that decides which sections should be:
 * - EXTRACTED normally (content sections)
 * - EXTRACTED as reference (answer keys, teacher notes — tagged differently)
 * - SKIPPED entirely (TOC, index, title pages, copyright, blank)
 *
 * Also provides regex-based figure reference detection as a fallback
 * alongside AI-detected figureRefs from segmentation.
 *
 * Configuration is driven by SystemSettings (extraction.filter.*).
 * All skip/reference decisions are reported as warnings for transparency.
 */

import type { DocumentSection } from "./segment-document";
import {
  getExtractionFilterSettings,
  type ExtractionFilterSettings,
  EXTRACTION_FILTER_DEFAULTS,
} from "@/lib/system-settings";

// ── Types ──────────────────────────────────────────────

export interface FilterResult {
  /** Sections to extract (may have filterAction = "reference" for tagging) */
  sections: DocumentSection[];
  /** Sections that were skipped */
  skipped: Array<{ title: string; reason: string }>;
  /** Human-readable summary for extraction warnings */
  warnings: string[];
}

// ── Figure reference detection ─────────────────────────

const FIGURE_PATTERNS = [
  /\b(?:Figure|Fig\.?)\s+(\d+(?:\.\d+)*[a-z]?)/gi,
  /\b(?:Diagram|Chart|Graph|Table|Image|Illustration)\s+(\d+(?:\.\d+)*[a-z]?)/gi,
];

/**
 * Detect figure/diagram/table references in text using regex patterns.
 * Returns deduplicated list of references (e.g. ["Figure 1.2", "Table 3"]).
 */
export function detectFigureRefs(text: string): string[] {
  const refs = new Set<string>();
  for (const pattern of FIGURE_PATTERNS) {
    // Reset lastIndex for each pattern since they're global
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      // Normalise: use the full match (e.g. "Figure 1.2"), trimmed
      refs.add(match[0].trim());
    }
  }
  return [...refs];
}

// ── FUTURE: Figure-heavy section handling ──
// TODO: Sections with hasFigures=true and high figure density could be
// handled specially — extract figure captions as assertions with category "figure",
// link to MediaAsset records when image extraction is implemented.
// For now, figure refs are tracked as fig: tags on assertions.

// ── Filtering ──────────────────────────────────────────

/**
 * Filter sections based on configurable rules.
 * Loads settings from SystemSettings (with fallback to defaults).
 */
export async function filterSections(
  fullText: string,
  sections: DocumentSection[],
): Promise<FilterResult> {
  const settings = await getExtractionFilterSettings().catch(() => EXTRACTION_FILTER_DEFAULTS);

  if (!settings.filteringEnabled) {
    return {
      sections: sections.map((s) => ({ ...s, filterAction: "extract" as const })),
      skipped: [],
      warnings: [],
    };
  }

  return applyFilters(fullText, sections, settings);
}

/**
 * Pure filtering function (no async, takes settings directly).
 * Exported for unit testing.
 *
 * Skip rules (section removed entirely):
 * 1. pedagogicalRole === "META"
 * 2. Title matches skip patterns
 * 3. Section text shorter than minSectionChars
 *
 * Reference rules (extracted but tagged):
 * 1. hasAnswerKey === true
 * 2. pedagogicalRole === "REFERENCE"
 * 3. Title matches reference patterns
 */
export function applyFilters(
  fullText: string,
  sections: DocumentSection[],
  settings: ExtractionFilterSettings,
): FilterResult {
  const skipPatterns = settings.skipPatterns.map((s) => s.toLowerCase());
  const refPatterns = settings.referencePatterns.map((s) => s.toLowerCase());

  const kept: DocumentSection[] = [];
  const skipped: Array<{ title: string; reason: string }> = [];
  const warnings: string[] = [];

  for (const section of sections) {
    const sectionText = fullText.substring(section.startOffset, section.endOffset);
    const titleLower = section.title.toLowerCase();

    // Skip rule 1: Pedagogical role is META
    if (section.pedagogicalRole === "META") {
      skipped.push({ title: section.title, reason: "META role (non-content)" });
      continue;
    }

    // Skip rule 2: Title matches skip patterns
    if (matchesAnyPattern(titleLower, skipPatterns)) {
      skipped.push({ title: section.title, reason: "title matches skip pattern" });
      continue;
    }

    // Skip rule 3: Too short
    if (sectionText.trim().length < settings.minSectionChars) {
      skipped.push({
        title: section.title,
        reason: `too short (${sectionText.trim().length} chars < ${settings.minSectionChars})`,
      });
      continue;
    }

    // Reference rule: tag but don't skip
    if (
      section.hasAnswerKey ||
      section.pedagogicalRole === "REFERENCE" ||
      matchesAnyPattern(titleLower, refPatterns)
    ) {
      kept.push({ ...section, filterAction: "reference" });
      continue;
    }

    // Normal extraction
    kept.push({ ...section, filterAction: "extract" });
  }

  if (skipped.length > 0) {
    warnings.push(
      `Skipped ${skipped.length} non-content section${skipped.length > 1 ? "s" : ""}: ` +
        skipped.map((s) => `"${s.title}" (${s.reason})`).join(", "),
    );
  }

  const refCount = kept.filter((s) => s.filterAction === "reference").length;
  if (refCount > 0) {
    warnings.push(
      `${refCount} section${refCount > 1 ? "s" : ""} extracted as reference content`,
    );
  }

  return { sections: kept, skipped, warnings };
}

/**
 * Check if a title matches any pattern (substring match).
 * Also checks common exact title variants.
 */
function matchesAnyPattern(title: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    // Match pattern with underscores converted to spaces
    if (title.includes(pattern.replace(/_/g, " ")) || title.includes(pattern)) {
      return true;
    }
  }

  // Common exact titles that should always be skipped
  const exactMatches = [
    "table of contents", "contents", "index", "copyright",
    "title page", "acknowledgements", "acknowledgments",
    "publisher", "about the author", "about the authors",
  ];
  return exactMatches.some((m) => title === m || title.startsWith(m + " "));
}
