/**
 * Extractor Registry
 *
 * Maps DocumentType to the appropriate specialist extractor.
 * Types without a specialist extractor fall back to GenericExtractor.
 */

import type { DocumentType } from "../resolve-config";
import type { DocumentExtractor } from "./base-extractor";
import { GenericExtractor } from "./generic-extractor";
import { CurriculumExtractor } from "./curriculum-extractor";
import { ComprehensionExtractor } from "./comprehension-extractor";
import { AssessmentExtractor } from "./assessment-extractor";
import { ReadingPassageExtractor } from "./reading-passage-extractor";
import { QuestionBankExtractor } from "./question-bank-extractor";

/**
 * Bump this when extraction logic changes materially (new categories,
 * specialist extractors, prompt changes, post-processing steps).
 * Sources with extractorVersion < EXTRACTOR_VERSION show as "outdated".
 */
export const EXTRACTOR_VERSION = 1;

// Registry of specialist extractors (by document type)
const SPECIALIST_EXTRACTORS: Partial<Record<DocumentType, new () => DocumentExtractor>> = {
  CURRICULUM: CurriculumExtractor,
  COMPREHENSION: ComprehensionExtractor,
  ASSESSMENT: AssessmentExtractor,
  READING_PASSAGE: ReadingPassageExtractor,
  QUESTION_BANK: QuestionBankExtractor,
};

/**
 * Get the appropriate extractor for a document type.
 * Returns a specialist extractor if available, otherwise GenericExtractor.
 */
export function getExtractor(documentType?: DocumentType): DocumentExtractor {
  if (documentType && SPECIALIST_EXTRACTORS[documentType]) {
    const ExtractorClass = SPECIALIST_EXTRACTORS[documentType]!;
    return new ExtractorClass();
  }

  // Fallback: GenericExtractor with the document type for logging
  return new GenericExtractor(documentType || "TEXTBOOK");
}

/**
 * Check if a source's extraction is outdated relative to current extractor version.
 * Returns true if extractorVersion is null (pre-tracking) or < EXTRACTOR_VERSION.
 */
export function isExtractionOutdated(extractorVersion: number | null): boolean {
  return extractorVersion === null || extractorVersion < EXTRACTOR_VERSION;
}
