/**
 * Content Extractors — Public API
 *
 * Re-exports the extractor framework for use by the extraction pipeline.
 */

export { DocumentExtractor } from "./base-extractor";
export type {
  ChunkResult,
  FullExtractionResult,
  ExtractionContext,
  ExtractedQuestion,
  ExtractedVocabulary,
} from "./base-extractor";
export { hashContent, callAI, parseJsonResponse } from "./base-extractor";
export { GenericExtractor } from "./generic-extractor";
export { CurriculumExtractor } from "./curriculum-extractor";
export { ComprehensionExtractor } from "./comprehension-extractor";
export { AssessmentExtractor } from "./assessment-extractor";
export { getExtractor } from "./registry";
