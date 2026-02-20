/**
 * Comprehension Extractor
 *
 * Specialist extractor for comprehension documents — reading passages
 * with comprehension questions, vocabulary exercises, and answer keys.
 *
 * Key differences from generic extraction:
 * 1. Separates reading content (assertions) from questions and vocabulary
 * 2. Detects and pairs Q&A (question number → answer key)
 * 3. Extracts vocabulary term/definition pairs into ContentVocabulary
 * 4. Handles multiple question types (MCQ, T/F, matching, unscramble, open)
 */

import type { ExtractionConfig } from "../resolve-config";
import type { ExtractedAssertion } from "../extract-assertions";
import {
  DocumentExtractor,
  callAI,
  parseJsonResponse,
  hashContent,
  type ChunkResult,
  type ExtractionContext,
  type ExtractedQuestion,
  type ExtractedVocabulary,
} from "./base-extractor";

// ------------------------------------------------------------------
// Comprehension-specific prompt
// ------------------------------------------------------------------

const COMPREHENSION_EXTRACTION_PROMPT = `You are extracting structured content from a comprehension/reading document.
This document contains a reading passage (or article) with comprehension questions, vocabulary exercises, and possibly an answer key.

You must return a JSON object with THREE arrays:

{
  "assertions": [...],   // Teaching points from the reading passage
  "questions": [...],    // Questions, tasks, and exercises
  "vocabulary": [...]    // Vocabulary terms with definitions
}

## assertions array
Each item: { "assertion": string, "category": string, "chapter": string?, "section": string?, "tags": string[], "learningOutcomeRef": string? }
Categories: "reading_passage" (key fact from passage), "key_fact" (important statement), "discussion_prompt" (open question)

## questions array
Each item: {
  "questionText": string,
  "questionType": "MCQ" | "TRUE_FALSE" | "MATCHING" | "FILL_BLANK" | "SHORT_ANSWER" | "OPEN" | "UNSCRAMBLE" | "ORDERING",
  "options": [{ "label": "A", "text": "...", "isCorrect": boolean }]?,  // for MCQ
  "correctAnswer": string?,  // the correct answer text
  "section": string?,        // which section/task this belongs to
  "tags": string[]
}

For TRUE_FALSE: questionText = the statement, correctAnswer = "True" or "False"
For MATCHING: questionText = the pair description, options = [{label: "left item", text: "right match"}]
For UNSCRAMBLE: questionText = the scrambled letters/words, correctAnswer = the correct word
For ORDERING: questionText = the task description, correctAnswer = the correct order

## vocabulary array
Each item: {
  "term": string,
  "definition": string,
  "partOfSpeech": string?,      // "verb", "noun", "adjective", etc.
  "exampleUsage": string?,      // Example sentence from the text
  "topic": string?,
  "tags": string[]
}

IMPORTANT:
- Extract EVERY question, including matching exercises, T/F, and unscramble tasks
- Match answers to questions where an answer key exists
- For vocabulary: extract term→definition pairs from vocab exercises, glossaries, matching sections
- Do NOT invent answers not present in the source
- Return ONLY valid JSON`;

// ------------------------------------------------------------------
// Comprehension Extractor
// ------------------------------------------------------------------

export class ComprehensionExtractor extends DocumentExtractor {
  readonly documentType = "COMPREHENSION" as const;

  async extractFromChunk(
    chunk: string,
    config: ExtractionConfig,
    context: ExtractionContext,
  ): Promise<ChunkResult> {
    const userPrompt = [
      `Extract all content from this comprehension/reading document chunk.`,
      context.qualificationRef ? `Qualification: ${context.qualificationRef}` : "",
      `\n---\n${chunk}\n---`,
    ].filter(Boolean).join("\n");

    const responseText = await callAI(
      COMPREHENSION_EXTRACTION_PROMPT,
      userPrompt,
      "content-trust.extract-comprehension",
      config.extraction.llmConfig,
      {
        description: `Extract comprehension chunk ${context.chunkIndex} (${chunk.length} chars) for ${context.sourceSlug}`,
        sourceSlug: context.sourceSlug,
        chunkIndex: context.chunkIndex,
        documentType: "COMPREHENSION",
      },
    );

    const parsed = parseJsonResponse(responseText);

    // Handle both { assertions, questions, vocabulary } and flat array formats
    const rawAssertions = Array.isArray(parsed) ? parsed : (parsed.assertions || []);
    const rawQuestions = Array.isArray(parsed) ? [] : (parsed.questions || []);
    const rawVocabulary = Array.isArray(parsed) ? [] : (parsed.vocabulary || []);

    // Parse assertions
    const assertions: ExtractedAssertion[] = (rawAssertions as any[]).map((item: any) => ({
      assertion: String(item.assertion || ""),
      category: item.category || "reading_passage",
      chapter: item.chapter || undefined,
      section: item.section || undefined,
      tags: Array.isArray(item.tags) ? item.tags : [],
      examRelevance: typeof item.examRelevance === "number" ? item.examRelevance : undefined,
      learningOutcomeRef: item.learningOutcomeRef || undefined,
      contentHash: hashContent(item.assertion || ""),
    }));

    // Parse questions
    const validQuestionTypes = new Set([
      "MCQ", "TRUE_FALSE", "MATCHING", "FILL_BLANK", "SHORT_ANSWER", "OPEN", "UNSCRAMBLE", "ORDERING",
    ]);

    const questions: ExtractedQuestion[] = (rawQuestions as any[])
      .filter((q: any) => q.questionText)
      .map((q: any) => ({
        questionText: String(q.questionText),
        questionType: validQuestionTypes.has(q.questionType) ? q.questionType : "SHORT_ANSWER",
        options: Array.isArray(q.options) ? q.options : undefined,
        correctAnswer: q.correctAnswer ? String(q.correctAnswer) : undefined,
        section: q.section || undefined,
        tags: Array.isArray(q.tags) ? q.tags : [],
        contentHash: hashContent(`question:${q.questionText}`),
      }));

    // Parse vocabulary
    const vocabulary: ExtractedVocabulary[] = (rawVocabulary as any[])
      .filter((v: any) => v.term && v.definition)
      .map((v: any) => ({
        term: String(v.term),
        definition: String(v.definition),
        partOfSpeech: v.partOfSpeech || undefined,
        exampleUsage: v.exampleUsage || undefined,
        topic: v.topic || undefined,
        tags: Array.isArray(v.tags) ? v.tags : [],
        contentHash: hashContent(`vocab:${v.term}:${v.definition}`),
      }));

    return { assertions, questions, vocabulary, warnings: [] };
  }
}
