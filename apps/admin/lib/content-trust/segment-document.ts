/**
 * Document Section Segmentation
 *
 * Pre-processing step that identifies distinct pedagogical sections
 * within a document before extraction. Composite documents (worksheets
 * with reading passages + exercises + answer keys) get segmented so
 * each section can be extracted with the right type-specific prompt.
 *
 * For non-composite documents (pure textbooks, syllabuses), segmentation
 * detects a single section and falls through to the standard pipeline.
 *
 * Pedagogical roles (ACTIVATE, INPUT, CHECK, PRODUCE, REFLECT, REFERENCE)
 * are stored as tags on extracted assertions for later filtering.
 */

import { getConfiguredMeteredAICompletion } from "@/lib/metering/instrumented-ai";
import { logAssistantCall } from "@/lib/ai/assistant-wrapper";
import { buildMultiPointSample } from "./classify-document";
import type { DocumentType } from "./resolve-config";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

/** Pedagogical role of a document section */
export type PedagogicalRole =
  | "ACTIVATE"   // Pre-reading, warm-up, vocabulary prep
  | "INPUT"      // Reading passage, video transcript, listening text
  | "CHECK"      // Comprehension questions, T/F, matching exercises
  | "PRODUCE"    // Discussion, writing, role-play, production tasks
  | "REFLECT"    // Self-assessment, review, learning journal
  | "REFERENCE"; // Answer key, teacher notes, glossary

/** A detected section within a document */
export interface DocumentSection {
  /** Section heading or title (e.g., "Preparation task", "Task 2") */
  title: string;
  /** Character offset where section starts in the full text */
  startOffset: number;
  /** Character offset where section ends */
  endOffset: number;
  /** Best extraction type for this section */
  sectionType: DocumentType;
  /** Pedagogical role of this section */
  pedagogicalRole: PedagogicalRole;
  /** Whether this section contains questions */
  hasQuestions: boolean;
  /** Whether this section contains an answer key */
  hasAnswerKey: boolean;
}

/** Result of document segmentation */
export interface SegmentationResult {
  /** True if multiple distinct section types detected */
  isComposite: boolean;
  /** Detected sections in document order */
  sections: DocumentSection[];
}

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

/** Minimum text length to attempt segmentation */
const MIN_TEXT_LENGTH = 500;

/** Maximum text to send for segmentation (controls cost) */
const MAX_SEGMENTATION_SAMPLE = 6000;

const VALID_ROLES: PedagogicalRole[] = [
  "ACTIVATE", "INPUT", "CHECK", "PRODUCE", "REFLECT", "REFERENCE",
];

const VALID_SECTION_TYPES: DocumentType[] = [
  "CURRICULUM", "TEXTBOOK", "WORKSHEET", "EXAMPLE", "ASSESSMENT", "REFERENCE",
];

// ------------------------------------------------------------------
// Segmentation prompt
// ------------------------------------------------------------------

const SEGMENTATION_SYSTEM_PROMPT = `You are a document structure analyst for an educational content system.

Given the text of an educational document, identify its distinct pedagogical sections. Many teaching documents are COMPOSITE — they contain reading passages, vocabulary exercises, comprehension questions, discussion prompts, and answer keys all in one file.

For each section, identify:
1. title: The section heading or a descriptive title
2. startText: The first ~30 characters of the section (for offset matching)
3. sectionType: The best extraction type for this section:
   - TEXTBOOK: Dense teaching content, reading passages, explanatory text
   - WORKSHEET: Learner activity, exercise, fill-in-the-blank
   - ASSESSMENT: Questions with expected answers, quizzes, tests
   - REFERENCE: Answer key, glossary, teacher notes, quick reference
   - CURRICULUM: Formal learning outcomes, assessment criteria
   - EXAMPLE: Case study, sample document for discussion
4. pedagogicalRole: The teaching purpose:
   - ACTIVATE: Pre-reading activity, warm-up, vocabulary prep
   - INPUT: Main teaching content, reading passage, core material
   - CHECK: Comprehension check, questions, matching, true/false
   - PRODUCE: Discussion prompt, writing task, role-play, production
   - REFLECT: Self-assessment, review, learning journal
   - REFERENCE: Answer key, teacher notes, solutions
5. hasQuestions: true if the section contains questions for the learner
6. hasAnswerKey: true if the section contains answers/solutions

Return a JSON object:
{
  "isComposite": true/false,
  "sections": [
    {
      "title": "string",
      "startText": "first ~30 chars of section",
      "sectionType": "TEXTBOOK|WORKSHEET|ASSESSMENT|REFERENCE|CURRICULUM|EXAMPLE",
      "pedagogicalRole": "ACTIVATE|INPUT|CHECK|PRODUCE|REFLECT|REFERENCE",
      "hasQuestions": true/false,
      "hasAnswerKey": true/false
    }
  ]
}

Rules:
- If the document has only ONE section type throughout, set isComposite: false and return a single section
- Sections should be in document order
- Adjacent text of the same type can be merged into one section
- Be generous with section detection — even short sections (a few lines) count if they serve a different pedagogical purpose
- A document with reading + exercises + answers is ALWAYS composite
- Return ONLY valid JSON (no markdown code fences)`;

// ------------------------------------------------------------------
// Segmentation
// ------------------------------------------------------------------

/**
 * Segment a document into pedagogical sections.
 *
 * Sends the document text to AI to identify distinct sections (reading
 * passages, exercises, answer keys, etc.). Returns section boundaries
 * with types and roles for per-section extraction.
 *
 * For short documents or when segmentation fails, returns a single
 * section covering the entire text (non-composite fallback).
 */
export async function segmentDocument(
  text: string,
  fileName: string,
): Promise<SegmentationResult> {
  // Skip segmentation for very short documents
  if (text.length < MIN_TEXT_LENGTH) {
    return {
      isComposite: false,
      sections: [{
        title: fileName,
        startOffset: 0,
        endOffset: text.length,
        sectionType: "TEXTBOOK",
        pedagogicalRole: "INPUT",
        hasQuestions: false,
        hasAnswerKey: false,
      }],
    };
  }

  try {
    const sample = text.length > MAX_SEGMENTATION_SAMPLE
      ? buildMultiPointSample(text, MAX_SEGMENTATION_SAMPLE)
      : text;

    const userPrompt = [
      `Filename: ${fileName}`,
      "",
      "--- DOCUMENT TEXT ---",
      sample,
      "--- END DOCUMENT ---",
    ].join("\n");

    // @ai-call content-trust.segment — Identify pedagogical sections in document | config: /x/ai-config
    const result = await getConfiguredMeteredAICompletion(
      {
        callPoint: "content-trust.segment",
        messages: [
          { role: "system", content: SEGMENTATION_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      },
      { sourceOp: "content-trust:segment" },
    );

    logAssistantCall(
      {
        callPoint: "content-trust.segment",
        userMessage: `Segment "${fileName}" (${text.length} chars)`,
        metadata: { fileName, textLength: text.length },
      },
      { response: "Segmentation complete", success: true },
    );

    // Parse response
    const responseText = result.content.trim();
    let jsonStr = responseText.startsWith("{")
      ? responseText
      : responseText.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, "$1");

    const parsed = JSON.parse(jsonStr);

    if (!parsed.sections || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
      return fallbackSingleSection(text, fileName);
    }

    // Resolve section offsets by matching startText against the full document
    const sections = resolveOffsets(text, parsed.sections);

    if (sections.length === 0) {
      return fallbackSingleSection(text, fileName);
    }

    // Determine if truly composite (multiple distinct section types)
    const distinctTypes = new Set(sections.map((s) => s.sectionType));
    const isComposite = parsed.isComposite === true || distinctTypes.size > 1;

    return { isComposite, sections };
  } catch (error: any) {
    console.error("[segment-document] Segmentation failed, falling back:", error?.message);
    return fallbackSingleSection(text, fileName);
  }
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/**
 * Fallback: treat entire document as a single non-composite section.
 */
function fallbackSingleSection(text: string, fileName: string): SegmentationResult {
  return {
    isComposite: false,
    sections: [{
      title: fileName,
      startOffset: 0,
      endOffset: text.length,
      sectionType: "TEXTBOOK",
      pedagogicalRole: "INPUT",
      hasQuestions: false,
      hasAnswerKey: false,
    }],
  };
}

/**
 * Resolve section character offsets by matching AI-returned startText
 * against the actual document text.
 *
 * The AI returns approximate "startText" strings for each section.
 * We find these in the full text to establish real character offsets.
 * Sections that can't be matched are skipped.
 */
function resolveOffsets(
  fullText: string,
  rawSections: Array<{
    title: string;
    startText?: string;
    sectionType?: string;
    pedagogicalRole?: string;
    hasQuestions?: boolean;
    hasAnswerKey?: boolean;
  }>,
): DocumentSection[] {
  const sections: DocumentSection[] = [];
  let searchFrom = 0;

  for (let i = 0; i < rawSections.length; i++) {
    const raw = rawSections[i];
    const startText = raw.startText?.trim();

    let startOffset: number;
    if (startText && startText.length >= 5) {
      // Try to find startText in the document (case-insensitive, from current position)
      const searchTarget = startText.toLowerCase();
      const foundAt = fullText.toLowerCase().indexOf(searchTarget, searchFrom);

      if (foundAt >= 0) {
        startOffset = foundAt;
      } else {
        // Try a fuzzy match with just the first 15 chars
        const shortTarget = searchTarget.substring(0, 15);
        const shortFound = fullText.toLowerCase().indexOf(shortTarget, searchFrom);
        startOffset = shortFound >= 0 ? shortFound : searchFrom;
      }
    } else {
      startOffset = searchFrom;
    }

    // End offset is the start of the next section, or end of text
    const endOffset = i < rawSections.length - 1 ? -1 : fullText.length; // resolved in next pass

    const sectionType: DocumentType = VALID_SECTION_TYPES.includes(raw.sectionType as DocumentType)
      ? (raw.sectionType as DocumentType)
      : "TEXTBOOK";

    const pedagogicalRole: PedagogicalRole = VALID_ROLES.includes(raw.pedagogicalRole as PedagogicalRole)
      ? (raw.pedagogicalRole as PedagogicalRole)
      : "INPUT";

    sections.push({
      title: raw.title || `Section ${i + 1}`,
      startOffset,
      endOffset,
      sectionType,
      pedagogicalRole,
      hasQuestions: raw.hasQuestions === true,
      hasAnswerKey: raw.hasAnswerKey === true,
    });

    searchFrom = startOffset + 1;
  }

  // Second pass: resolve endOffset for all sections except the last
  for (let i = 0; i < sections.length - 1; i++) {
    sections[i].endOffset = sections[i + 1].startOffset;
  }

  // Filter out empty sections (startOffset === endOffset)
  return sections.filter((s) => s.endOffset > s.startOffset);
}
