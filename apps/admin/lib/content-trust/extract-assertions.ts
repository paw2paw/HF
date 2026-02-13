/**
 * Content Assertion Extraction
 *
 * Parses documents (PDF, text, markdown) into atomic ContentAssertions
 * using AI to identify teaching points, facts, thresholds, and definitions.
 *
 * Flow: Document → text extraction → chunking → AI extraction → assertions
 */

import { getConfiguredMeteredAICompletion } from "@/lib/metering/instrumented-ai";
import { logAssistantCall } from "@/lib/ai/assistant-wrapper";
import crypto from "crypto";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface ExtractedAssertion {
  assertion: string;
  category: "fact" | "definition" | "threshold" | "rule" | "process" | "example";
  chapter?: string;
  section?: string;
  pageRef?: string;
  tags: string[];
  validUntil?: string;
  taxYear?: string;
  examRelevance?: number;
  learningOutcomeRef?: string;
  contentHash: string;
}

export interface ExtractionResult {
  ok: boolean;
  assertions: ExtractedAssertion[];
  documentTitle?: string;
  documentStructure?: { chapters: string[] };
  warnings: string[];
  error?: string;
}

export interface ExtractionOptions {
  sourceSlug: string;
  qualificationRef?: string;
  focusChapters?: string[];
  maxAssertions?: number;
  /** Called after each chunk completes (for progress tracking) */
  onChunkDone?: (chunkIndex: number, totalChunks: number, extractedSoFar: number) => void;
}

// ------------------------------------------------------------------
// Text extraction
// ------------------------------------------------------------------

/**
 * Extract text from a PDF buffer using pdf-parse.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<{ text: string; pages: number }> {
  // Dynamic import to avoid bundling issues
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return { text: data.text, pages: data.numpages };
}

/**
 * Extract text from various file types.
 */
export async function extractText(
  file: File
): Promise<{ text: string; pages?: number; fileType: string }> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { text, pages } = await extractTextFromPdf(buffer);
    return { text, pages, fileType: "pdf" };
  }

  // Text-based formats
  const text = await file.text();
  if (name.endsWith(".md") || name.endsWith(".markdown")) {
    return { text, fileType: "markdown" };
  }
  if (name.endsWith(".json")) {
    return { text, fileType: "json" };
  }
  return { text, fileType: "text" };
}

// ------------------------------------------------------------------
// Chunking
// ------------------------------------------------------------------

const MAX_CHUNK_CHARS = 8000;

/**
 * Split text into manageable chunks for AI processing.
 * Tries to split on paragraph/section boundaries.
 */
export function chunkText(text: string, maxChars: number = MAX_CHUNK_CHARS): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining);
      break;
    }

    // Find a good split point (double newline, then single newline, then space)
    let splitAt = remaining.lastIndexOf("\n\n", maxChars);
    if (splitAt < maxChars * 0.5) {
      splitAt = remaining.lastIndexOf("\n", maxChars);
    }
    if (splitAt < maxChars * 0.3) {
      splitAt = remaining.lastIndexOf(" ", maxChars);
    }
    if (splitAt < 1) {
      splitAt = maxChars;
    }

    chunks.push(remaining.substring(0, splitAt));
    remaining = remaining.substring(splitAt).trimStart();
  }

  return chunks;
}

// ------------------------------------------------------------------
// AI extraction
// ------------------------------------------------------------------

/**
 * Generate a content hash for deduplication.
 */
function hashAssertion(text: string): string {
  return crypto.createHash("sha256").update(text.trim().toLowerCase()).digest("hex").substring(0, 16);
}

const EXTRACTION_SYSTEM_PROMPT = `You are a content extraction specialist. Your job is to parse educational/training material and extract atomic teaching points (assertions).

Each assertion should be:
- A single, self-contained fact, definition, threshold, rule, process step, or example
- Specific enough to be independently verifiable against the source
- Tagged with its category and any relevant metadata

Categories:
- fact: A specific factual statement (e.g., "The ISA allowance is £20,000")
- definition: A term definition (e.g., "An annuity is a series of regular payments")
- threshold: A numeric limit or boundary (e.g., "Higher rate tax starts at £50,270")
- rule: A regulatory or procedural rule (e.g., "Advisors must check affordability before recommending")
- process: A step in a procedure (e.g., "Step 3: Calculate the net relevant earnings")
- example: An illustrative example (e.g., "Example: If a client earns £80,000...")

Return a JSON array of objects with these fields:
- assertion: string (the teaching point)
- category: "fact" | "definition" | "threshold" | "rule" | "process" | "example"
- chapter: string | null (chapter or section heading this comes from)
- section: string | null (sub-section)
- tags: string[] (2-5 keywords)
- examRelevance: number (0.0-1.0, how likely to appear in an exam)
- learningOutcomeRef: string | null (e.g., "LO2", "AC2.3" if identifiable)
- validUntil: string | null (ISO date if time-bound, e.g., tax year figures)
- taxYear: string | null (e.g., "2024/25" if applicable)

IMPORTANT:
- Extract EVERY distinct teaching point, not just highlights
- Be precise with numbers, dates, and thresholds
- If content mentions a tax year or validity period, include it
- Do NOT invent information not present in the source text
- Return ONLY valid JSON (no markdown code fences)`;

/**
 * Use AI to extract assertions from a text chunk.
 */
async function extractFromChunk(
  chunk: string,
  options: ExtractionOptions,
  chunkIndex: number,
): Promise<ExtractedAssertion[]> {
  const userPrompt = [
    `Extract all teaching points from this ${options.qualificationRef ? `${options.qualificationRef} ` : ""}training material.`,
    options.focusChapters?.length
      ? `Focus on: ${options.focusChapters.join(", ")}`
      : "",
    `\n---\n${chunk}\n---`,
  ].filter(Boolean).join("\n");

  try {
    // @ai-call content-trust.extract — Extract assertions from training material | config: /x/ai-config
    const result = await getConfiguredMeteredAICompletion(
      {
        callPoint: "content-trust.extract",
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        maxTokens: 4000,
      },
      { sourceOp: "content-trust:extract" }
    );

    // Log for learning
    logAssistantCall(
      {
        callPoint: "content-trust.extract",
        userMessage: `Extract chunk ${chunkIndex} (${chunk.length} chars) for ${options.sourceSlug}`,
        metadata: { sourceSlug: options.sourceSlug, chunkIndex },
      },
      { response: `Extracted assertions`, success: true }
    );

    // Parse JSON response
    const text = result.content.trim();
    // Handle potential markdown code fences
    const jsonStr = text.startsWith("[") ? text : text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    const raw = JSON.parse(jsonStr);

    if (!Array.isArray(raw)) return [];

    return raw.map((item: any) => ({
      assertion: String(item.assertion || ""),
      category: item.category || "fact",
      chapter: item.chapter || undefined,
      section: item.section || undefined,
      tags: Array.isArray(item.tags) ? item.tags : [],
      examRelevance: typeof item.examRelevance === "number" ? item.examRelevance : undefined,
      learningOutcomeRef: item.learningOutcomeRef || undefined,
      validUntil: item.validUntil || undefined,
      taxYear: item.taxYear || undefined,
      contentHash: hashAssertion(item.assertion || ""),
    }));
  } catch (err: any) {
    console.error(`[extract-assertions] Chunk ${chunkIndex} failed:`, err.message);
    return [];
  }
}

// ------------------------------------------------------------------
// Main extraction pipeline
// ------------------------------------------------------------------

/**
 * Extract assertions from document text.
 * Chunks the text, runs AI extraction on each chunk, deduplicates results.
 */
export async function extractAssertions(
  text: string,
  options: ExtractionOptions,
): Promise<ExtractionResult> {
  const warnings: string[] = [];

  if (!text.trim()) {
    return { ok: false, assertions: [], warnings: [], error: "Empty document" };
  }

  // Chunk the text
  const chunks = chunkText(text);
  if (chunks.length > 20) {
    warnings.push(`Large document split into ${chunks.length} chunks — extraction may be slow`);
  }

  // Extract from each chunk (sequentially to avoid rate limits)
  const allAssertions: ExtractedAssertion[] = [];
  const limit = options.maxAssertions || 500;

  for (let i = 0; i < chunks.length && allAssertions.length < limit; i++) {
    const chunkAssertions = await extractFromChunk(chunks[i], options, i);
    allAssertions.push(...chunkAssertions);
    options.onChunkDone?.(i, chunks.length, allAssertions.length);
  }

  if (allAssertions.length >= limit) {
    warnings.push(`Reached assertion limit (${limit}). Document may have more content.`);
  }

  // Deduplicate by content hash
  const seen = new Set<string>();
  const deduplicated = allAssertions.filter((a) => {
    if (seen.has(a.contentHash)) return false;
    seen.add(a.contentHash);
    return true;
  });

  if (deduplicated.length < allAssertions.length) {
    warnings.push(`Removed ${allAssertions.length - deduplicated.length} duplicate assertions`);
  }

  return {
    ok: true,
    assertions: deduplicated,
    warnings,
  };
}
