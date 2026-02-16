/**
 * Document Type Classification
 *
 * Classifies uploaded documents into pedagogical types before extraction.
 * Uses a lightweight AI call on the first N characters of extracted text.
 *
 * Types: CURRICULUM, TEXTBOOK, WORKSHEET, EXAMPLE, ASSESSMENT, REFERENCE
 *
 * The classification prompt is spec-driven via CONTENT-EXTRACT-001 config.
 */

import { getConfiguredMeteredAICompletion } from "@/lib/metering/instrumented-ai";
import { logAssistantCall } from "@/lib/ai/assistant-wrapper";
import type { ExtractionConfig, DocumentType } from "./resolve-config";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface ClassificationResult {
  documentType: DocumentType;
  confidence: number;
  reasoning: string;
}

const VALID_TYPES: DocumentType[] = [
  "CURRICULUM", "TEXTBOOK", "WORKSHEET", "EXAMPLE", "ASSESSMENT", "REFERENCE",
];

// ------------------------------------------------------------------
// Classification
// ------------------------------------------------------------------

/**
 * Classify a document's type using AI.
 *
 * Examines a text sample and filename to determine the pedagogical role
 * of the document. Returns the classified type with confidence score.
 *
 * Falls back to TEXTBOOK with confidence 0.0 on any error.
 */
export async function classifyDocument(
  textSample: string,
  fileName: string,
  extractionConfig: ExtractionConfig,
): Promise<ClassificationResult> {
  const { classification } = extractionConfig;
  const sample = textSample.substring(0, classification.sampleSize);

  const userPrompt = [
    `Filename: ${fileName}`,
    "",
    "--- TEXT SAMPLE ---",
    sample,
    "--- END SAMPLE ---",
  ].join("\n");

  try {
    // @ai-call content-trust.classify — Classify document type for extraction | config: /x/ai-config
    const result = await getConfiguredMeteredAICompletion(
      {
        callPoint: "content-trust.classify",
        messages: [
          { role: "system", content: classification.systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: classification.llmConfig.temperature,
        maxTokens: classification.llmConfig.maxTokens,
      },
      { sourceOp: "content-trust:classify" },
    );

    logAssistantCall(
      {
        callPoint: "content-trust.classify",
        userMessage: `Classify ${fileName} (${sample.length} chars sample)`,
        metadata: { fileName },
      },
      { response: "Classification complete", success: true },
    );

    // Parse response
    const text = result.content.trim();
    let jsonStr = text.startsWith("{") ? text : text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    // Remove trailing commas
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, "$1");

    const parsed = JSON.parse(jsonStr);

    const documentType: DocumentType = VALID_TYPES.includes(parsed.documentType)
      ? parsed.documentType
      : "TEXTBOOK";

    const confidence = typeof parsed.confidence === "number"
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.5;

    return {
      documentType,
      confidence,
      reasoning: parsed.reasoning || "No reasoning provided",
    };
  } catch (error: any) {
    console.error("[classify-document] Classification failed, defaulting to TEXTBOOK:", error?.message);
    return {
      documentType: "TEXTBOOK",
      confidence: 0.0,
      reasoning: `Classification failed: ${error?.message || "unknown error"}`,
    };
  }
}
