/**
 * Generic Document Extractor
 *
 * Port of the original extractAssertions() logic. Used as fallback for
 * document types without a specialist extractor (TEXTBOOK, WORKSHEET,
 * EXAMPLE, REFERENCE, LESSON_PLAN, POLICY_DOCUMENT).
 *
 * Extracts assertions only (no questions or vocabulary).
 */

import type { ExtractionConfig, DocumentType } from "../resolve-config";
import type { ExtractedAssertion } from "../extract-assertions";
import {
  DocumentExtractor,
  callAI,
  parseJsonResponse,
  hashContent,
  type ChunkResult,
  type ExtractionContext,
} from "./base-extractor";

export class GenericExtractor extends DocumentExtractor {
  readonly documentType: DocumentType;

  constructor(documentType: DocumentType = "TEXTBOOK") {
    super();
    this.documentType = documentType;
  }

  async extractFromChunk(
    chunk: string,
    config: ExtractionConfig,
    context: ExtractionContext,
  ): Promise<ChunkResult> {
    const { extraction } = config;
    const validCategoryIds = new Set(extraction.categories.map((c) => c.id));

    const userPrompt = [
      `Extract all teaching points from this ${context.qualificationRef ? `${context.qualificationRef} ` : ""}training material.`,
      `\nValid categories: ${extraction.categories.map((c) => c.id).join(", ")}`,
      context.focusChapters?.length
        ? `Focus on: ${context.focusChapters.join(", ")}`
        : "",
      `\n---\n${chunk}\n---`,
    ].filter(Boolean).join("\n");

    const responseText = await callAI(
      extraction.systemPrompt,
      userPrompt,
      "content-trust.extract",
      extraction.llmConfig,
      {
        description: `Extract chunk ${context.chunkIndex} (${chunk.length} chars) for ${context.sourceSlug}`,
        sourceSlug: context.sourceSlug,
        chunkIndex: context.chunkIndex,
        documentType: this.documentType,
      },
    );

    const raw = parseJsonResponse(responseText);

    if (!Array.isArray(raw)) {
      return { assertions: [], questions: [], vocabulary: [], warnings: [] };
    }

    const assertions: ExtractedAssertion[] = raw.map((item: any) => ({
      assertion: String(item.assertion || ""),
      category: validCategoryIds.has(item.category) ? item.category : "fact",
      chapter: item.chapter || undefined,
      section: item.section || undefined,
      tags: Array.isArray(item.tags) ? item.tags : [],
      examRelevance: typeof item.examRelevance === "number" ? item.examRelevance : undefined,
      learningOutcomeRef: item.learningOutcomeRef || undefined,
      validUntil: item.validUntil || undefined,
      taxYear: item.taxYear || undefined,
      contentHash: hashContent(item.assertion || ""),
    }));

    return { assertions, questions: [], vocabulary: [], warnings: [] };
  }
}
