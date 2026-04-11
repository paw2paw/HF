/**
 * Assessment Extractor
 *
 * Specialist extractor for formal tests, exams, and quizzes.
 * Focuses on extracting structured question/answer pairs with
 * mark schemes, rubrics, and misconceptions.
 *
 * Key differences from generic extraction:
 * 1. Primary output is ContentQuestion (not assertions)
 * 2. Detects mark allocation and rubric criteria
 * 3. Identifies misconceptions (common wrong answers)
 * 4. Maps questions to Learning Outcomes
 */

import type { ExtractionConfig } from "../resolve-config";
import type { ExtractedAssertion } from "../extract-assertions";
import { sanitiseLORef } from "../validate-lo-linkage";
import {
  DocumentExtractor,
  callAI,
  parseJsonResponse,
  buildLoRefHint,
  hashContent,
  type ChunkResult,
  type ExtractionContext,
  type ExtractedQuestion,
} from "./base-extractor";

// ------------------------------------------------------------------
// Assessment-specific prompt
// ------------------------------------------------------------------

const ASSESSMENT_EXTRACTION_PROMPT = `You are extracting structured content from an assessment/exam document.
This document contains questions with expected answers, mark schemes, rubrics, or grade boundaries.

You must return a JSON object with TWO arrays:

{
  "assertions": [...],   // Factual knowledge points, mark scheme criteria, misconceptions
  "questions": [...]     // Structured question/answer pairs
}

## assertions array
Each item: { "assertion": string, "category": string, "chapter": string?, "section": string?, "tags": string[], "examRelevance": number?, "learningOutcomeRef": string? }
Categories:
- "fact": A factual statement used in question context
- "mark_scheme": A marking criterion or rubric point
- "misconception": A common wrong answer or misunderstanding (explain why it's wrong)
- "answer": The correct answer or model answer
- "rule": An exam rule or instruction

## questions array
Each item: {
  "questionText": string,
  "questionType": "MCQ" | "TRUE_FALSE" | "MATCHING" | "FILL_BLANK" | "SHORT_ANSWER" | "OPEN" | "UNSCRAMBLE" | "ORDERING",
  "options": [{ "label": "A", "text": "...", "isCorrect": boolean }]?,  // for MCQ
  "correctAnswer": string?,
  "answerExplanation": string?,    // why this answer is correct
  "markScheme": string?,           // mark allocation / rubric for this question
  "learningOutcomeRef": string?,   // which LO is tested
  "difficulty": number?,           // 1-5 estimate
  "bloomLevel": "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE",
  "section": string?,              // "Section A", "Part 2", etc.
  "tags": string[]
}

Bloom level classification:
- REMEMBER: Recall, define, list, name, identify
- UNDERSTAND: Explain, describe, interpret, summarise
- APPLY: Calculate, demonstrate, use, solve
- ANALYZE: Compare, contrast, examine, distinguish
- EVALUATE: Justify, critique, assess, argue
- CREATE: Design, construct, produce, plan

Difficulty estimation:
- 1: Recall/recognition (define, list, name)
- 2: Comprehension (explain, describe)
- 3: Application (apply, calculate, demonstrate)
- 4: Analysis (compare, contrast, evaluate)
- 5: Synthesis/evaluation (justify, design, critique)

IMPORTANT:
- Parse EVERY question, including sub-questions (Q1a, Q1b)
- Extract mark allocations where visible (e.g., "[2 marks]", "(3)")
- Detect MCQ options (A/B/C/D) and identify the correct answer
- For True/False, record the correct answer
- For open questions, include the model answer/mark scheme if available
- Do NOT invent answers not in the source
- Return ONLY valid JSON`;

// ------------------------------------------------------------------
// Bloom level helpers
// ------------------------------------------------------------------

type BloomLevel = "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";

const VALID_BLOOM_LEVELS = new Set<BloomLevel>(["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]);

function normalizeBloomLevel(raw: unknown): BloomLevel | undefined {
  if (typeof raw !== "string") return undefined;
  const upper = raw.toUpperCase().trim() as BloomLevel;
  return VALID_BLOOM_LEVELS.has(upper) ? upper : undefined;
}

/** Infer bloom from existing difficulty 1-5 scale as fallback */
function inferBloomFromDifficulty(difficulty: number | undefined): BloomLevel | undefined {
  if (!difficulty) return undefined;
  if (difficulty <= 1) return "REMEMBER";
  if (difficulty <= 2) return "UNDERSTAND";
  if (difficulty <= 3) return "APPLY";
  if (difficulty <= 4) return "ANALYZE";
  return "EVALUATE";
}

// ------------------------------------------------------------------
// Assessment Extractor
// ------------------------------------------------------------------

export class AssessmentExtractor extends DocumentExtractor {
  readonly documentType = "ASSESSMENT" as const;

  async extractFromChunk(
    chunk: string,
    config: ExtractionConfig,
    context: ExtractionContext,
  ): Promise<ChunkResult> {
    const userPrompt = [
      `Extract all questions and teaching points from this assessment document.`,
      context.qualificationRef ? `Qualification: ${context.qualificationRef}` : "",
      buildLoRefHint(context.curriculumLoRefs),
      `\n---\n${chunk}\n---`,
    ].filter(Boolean).join("\n");

    const curriculumRefSet = context.curriculumLoRefs && context.curriculumLoRefs.length > 0
      ? new Set(context.curriculumLoRefs.map((lo) => lo.ref.toUpperCase()))
      : null;
    const enforceWhitelist = (raw: string | null | undefined): string | undefined => {
      const sanitised = sanitiseLORef(raw);
      if (!sanitised) return undefined;
      if (curriculumRefSet && !curriculumRefSet.has(sanitised)) return undefined;
      return sanitised;
    };

    // @ai-call content-trust.extract-assessment — Extract assertions and questions with rubrics from assessment docs | config: /x/ai-config
    const aiResult = await callAI(
      ASSESSMENT_EXTRACTION_PROMPT,
      userPrompt,
      "content-trust.extract-assessment",
      config.extraction.llmConfig,
      {
        description: `Extract assessment chunk ${context.chunkIndex} (${chunk.length} chars) for ${context.sourceSlug}`,
        sourceSlug: context.sourceSlug,
        chunkIndex: context.chunkIndex,
        documentType: "ASSESSMENT",
      },
    );

    const parsed = parseJsonResponse(aiResult.content);

    const rawAssertions = Array.isArray(parsed) ? parsed : (parsed.assertions || []);
    const rawQuestions = Array.isArray(parsed) ? [] : (parsed.questions || []);

    // Parse assertions (mark scheme, misconceptions, facts)
    const validCategories = new Set(["fact", "mark_scheme", "misconception", "answer", "rule"]);
    const assertions: ExtractedAssertion[] = (rawAssertions as any[]).map((item: any) => ({
      assertion: String(item.assertion || ""),
      category: validCategories.has(item.category) ? item.category : "fact",
      chapter: item.chapter || undefined,
      section: item.section || undefined,
      tags: Array.isArray(item.tags) ? item.tags : [],
      examRelevance: typeof item.examRelevance === "number" ? item.examRelevance : 1.0,
      // Guard per epic #131 A2.
      learningOutcomeRef: enforceWhitelist(item.learningOutcomeRef),
      contentHash: hashContent(item.assertion || ""),
    }));

    // Parse questions
    const validQuestionTypes = new Set([
      "MCQ", "TRUE_FALSE", "MATCHING", "FILL_BLANK", "SHORT_ANSWER", "OPEN", "UNSCRAMBLE", "ORDERING",
    ]);

    const questions: ExtractedQuestion[] = (rawQuestions as any[])
      .filter((q: any) => q.questionText)
      .map((q: any) => {
        const difficulty = typeof q.difficulty === "number" && q.difficulty >= 1 && q.difficulty <= 5
          ? q.difficulty
          : undefined;
        return {
          questionText: String(q.questionText),
          questionType: validQuestionTypes.has(q.questionType) ? q.questionType : "SHORT_ANSWER",
          options: Array.isArray(q.options) ? q.options : undefined,
          correctAnswer: q.correctAnswer ? String(q.correctAnswer) : undefined,
          answerExplanation: q.answerExplanation ? String(q.answerExplanation) : undefined,
          markScheme: q.markScheme ? String(q.markScheme) : undefined,
          learningOutcomeRef: enforceWhitelist(q.learningOutcomeRef),
          difficulty,
          bloomLevel: normalizeBloomLevel(q.bloomLevel) ?? inferBloomFromDifficulty(difficulty),
          assessmentUse: "BOTH" as const,
          section: q.section || undefined,
          tags: Array.isArray(q.tags) ? q.tags : [],
          contentHash: hashContent(`question:${q.questionText}`),
        };
      });

    return { assertions, questions, vocabulary: [], warnings: [] };
  }
}
