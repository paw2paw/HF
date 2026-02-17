/**
 * Artifact Extraction from Transcripts
 *
 * Extracts content worth sharing from call transcripts:
 * - Summaries, key facts, formulas, exercises, resources, study notes, reminders
 *
 * Follows the same pattern as extract-goals.ts:
 * Load transcript → Call metered AI → Parse JSON → Deduplicate → Persist
 */

import { prisma } from "@/lib/prisma";
import { ConversationArtifactType, ArtifactTrustLevel } from "@prisma/client";
import { AIEngine } from "@/lib/ai/client";
import { getConfiguredMeteredAICompletion, logMockAIUsage } from "@/lib/metering";
import { logAI } from "@/lib/logger";
import { getArtifactSettings, type ArtifactSettings } from "@/lib/system-settings";

// =====================================================
// TYPES
// =====================================================

export interface ArtifactExtractionResult {
  artifactsCreated: number;
  artifactsSkipped: number;
  errors: string[];
}

interface ExtractedArtifact {
  type: ConversationArtifactType;
  title: string;
  content: string;
  confidence: number;
  evidence: string;
  assertionIds: string[];
}

interface ArtifactExtractionResponse {
  artifacts: Array<{
    t: string;    // ConversationArtifactType
    ti: string;   // title
    c: string;    // content
    co: number;   // confidence
    ev: string;   // evidence (transcript excerpt)
    aids?: string[]; // ContentAssertion IDs
  }>;
}

type Logger = {
  info: (msg: string, data?: any) => void;
  warn: (msg: string, data?: any) => void;
  error: (msg: string, data?: any) => void;
  debug: (msg: string, data?: any) => void;
};

// =====================================================
// CONSTANTS
// =====================================================

let TRANSCRIPT_LIMIT = 4000;
let MIN_TRANSCRIPT_LENGTH = 100;
let CONFIDENCE_THRESHOLD = 0.6;
let SIMILARITY_THRESHOLD = 0.8;

async function loadArtifactConstants() {
  const s = await getArtifactSettings();
  TRANSCRIPT_LIMIT = s.transcriptLimitChars;
  MIN_TRANSCRIPT_LENGTH = s.transcriptMinChars;
  CONFIDENCE_THRESHOLD = s.confidenceThreshold;
  SIMILARITY_THRESHOLD = s.similarityThreshold;
}

// =====================================================
// MAIN EXPORT
// =====================================================

/**
 * Extract conversation artifacts from a call transcript.
 * Creates ConversationArtifact records with status=PENDING.
 */
export async function extractArtifacts(
  call: { id: string; transcript: string | null },
  callerId: string,
  engine: AIEngine,
  log: Logger
): Promise<ArtifactExtractionResult> {
  await loadArtifactConstants();

  const result: ArtifactExtractionResult = {
    artifactsCreated: 0,
    artifactsSkipped: 0,
    errors: [],
  };

  // 1. Validate input
  if (!call.transcript || call.transcript.length < MIN_TRANSCRIPT_LENGTH) {
    log.info("Skipping artifact extraction - transcript too short", {
      callId: call.id,
      transcriptLength: call.transcript?.length ?? 0,
    });
    return result;
  }

  try {
    // 2. Load existing artifacts for deduplication
    const existingArtifacts = await prisma.conversationArtifact.findMany({
      where: { callerId },
      select: { id: true, type: true, title: true },
    });

    // 3. Load domain ContentAssertions for trust matching
    const caller = await prisma.caller.findUnique({
      where: { id: callerId },
      select: { domainId: true },
    });

    let assertionContext = "";
    if (caller?.domainId) {
      const assertions = await prisma.contentAssertion.findMany({
        where: {
          source: {
            subjects: { some: { subject: { domains: { some: { domainId: caller.domainId } } } } },
          },
        },
        select: { id: true, assertion: true, category: true },
        take: 50,
      });
      if (assertions.length > 0) {
        assertionContext = assertions
          .map((a) => `${a.id}|${a.category}|${a.assertion.slice(0, 100)}`)
          .join("\n");
      }
    }

    // 4. Build prompt
    const prompt = buildArtifactExtractionPrompt(
      call.transcript,
      existingArtifacts,
      assertionContext
    );

    // 5. Handle mock engine
    if (engine === "mock") {
      await logMockAIUsage({
        callId: call.id,
        callerId,
        sourceOp: "pipeline:extract_artifacts",
        metadata: { reason: "mock_engine" },
      }).catch((e) => log.warn("Failed to log mock usage", { error: (e as Error).message }));
      log.info("Mock artifact extraction complete", { callId: call.id });
      return result;
    }

    // @ai-call pipeline.artifacts — Extract conversation artifacts from transcript | config: /x/ai-config
    const aiResult = await getConfiguredMeteredAICompletion(
      {
        callPoint: "pipeline.artifacts",
        engineOverride: engine,
        messages: [
          {
            role: "system",
            content:
              "You are an expert at identifying valuable content from tutoring conversations that should be shared with the learner. Extract artifacts worth sharing. Return valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        maxTokens: 2048,
        temperature: 0.3,
      },
      { callId: call.id, callerId, sourceOp: "pipeline:extract_artifacts" }
    );

    logAI("pipeline:extract_artifacts", prompt, aiResult.content, {
      usage: aiResult.usage,
      callId: call.id,
      callerId,
    });
    log.debug("AI artifact extraction response", { model: aiResult.model, tokens: aiResult.usage });

    // 6. Parse response
    let jsonContent = aiResult.content.trim();
    if (jsonContent.startsWith("```")) {
      jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    let parsed: ArtifactExtractionResponse;
    try {
      parsed = JSON.parse(jsonContent);
    } catch (parseError) {
      log.error("Artifact extraction JSON parse failed", {
        error: (parseError as Error).message,
        content: jsonContent.slice(0, 200),
      });
      result.errors.push(`JSON parse error: ${(parseError as Error).message}`);
      return result;
    }

    // 7. Process each extracted artifact
    if (parsed.artifacts && Array.isArray(parsed.artifacts)) {
      for (const rawArtifact of parsed.artifacts) {
        try {
          const extracted = normalizeArtifact(rawArtifact);
          if (!extracted) {
            result.artifactsSkipped++;
            continue;
          }

          if (extracted.confidence < CONFIDENCE_THRESHOLD) {
            log.debug("Skipping low confidence artifact", {
              title: extracted.title,
              confidence: extracted.confidence,
            });
            result.artifactsSkipped++;
            continue;
          }

          // Deduplicate
          const isDuplicate = existingArtifacts.some(
            (e) =>
              e.type === extracted.type &&
              calculateSimilarity(
                e.title.toLowerCase(),
                extracted.title.toLowerCase()
              ) > SIMILARITY_THRESHOLD
          );

          if (isDuplicate) {
            log.debug("Skipping duplicate artifact", { title: extracted.title });
            result.artifactsSkipped++;
            continue;
          }

          // Determine trust level
          const trustLevel =
            extracted.assertionIds.length > 0
              ? ArtifactTrustLevel.VERIFIED
              : ArtifactTrustLevel.INFERRED;

          await prisma.conversationArtifact.create({
            data: {
              callId: call.id,
              callerId,
              type: extracted.type,
              title: extracted.title,
              content: extracted.content,
              contentAssertionIds: extracted.assertionIds,
              trustLevel,
              confidence: extracted.confidence,
              evidence: extracted.evidence,
            },
          });

          result.artifactsCreated++;
          log.info("Created artifact", {
            type: extracted.type,
            title: extracted.title,
            trustLevel,
          });
        } catch (artifactError) {
          log.error("Failed to process artifact", {
            error: (artifactError as Error).message,
            title: rawArtifact.ti,
          });
          result.errors.push(`Artifact "${rawArtifact.ti}": ${(artifactError as Error).message}`);
        }
      }
    }

    log.info("Artifact extraction complete", result);
    return result;
  } catch (error: any) {
    log.error("Artifact extraction failed", { error: error.message, callId: call.id });
    result.errors.push(error.message);
    return result;
  }
}

// =====================================================
// HELPERS
// =====================================================

function buildArtifactExtractionPrompt(
  transcript: string,
  existingArtifacts: Array<{ id: string; type: ConversationArtifactType; title: string }>,
  assertionContext: string
): string {
  const existingList =
    existingArtifacts.length > 0
      ? existingArtifacts.map((a) => `${a.type}|${a.title}`).join("\n")
      : "None";

  const assertionSection = assertionContext
    ? `\nTRUSTED CONTENT (ContentAssertion IDs — if an artifact matches, include the ID in "aids"):\n${assertionContext}\n`
    : "";

  return `Extract content worth sharing with the learner from this tutoring conversation.

ARTIFACT TYPES:
- SUMMARY: Brief summary of key points covered in this session
- KEY_FACT: Important fact or piece of information discussed or taught
- FORMULA: Mathematical formula, equation, or domain-specific rule
- EXERCISE: Practice question, exercise, or challenge for the learner
- RESOURCE_LINK: Book, website, tool, or resource referenced
- STUDY_NOTE: Concise study note or revision aid
- REMINDER: Follow-up action, homework, or next-step reminder

EXTRACTION RULES:
- Only extract content that would genuinely help the learner after the call
- Include a clear, descriptive title (max 60 chars)
- Content should be self-contained and useful on its own
- Evidence should be the verbatim transcript excerpt that triggered the artifact
- Confidence: 0.8-1.0 for explicitly discussed content, 0.5-0.7 for inferred
- Do NOT extract artifacts that duplicate existing ones
- If content matches a trusted source, include its ID in "aids"

EXISTING ARTIFACTS (do not duplicate):
${existingList}
${assertionSection}
TRANSCRIPT:
${transcript.slice(0, TRANSCRIPT_LIMIT)}

Return JSON (no markdown):
{"artifacts":[{"t":"KEY_FACT","ti":"Annual ISA allowance","c":"The annual ISA allowance for 2025/26 is £20,000.","co":0.95,"ev":"the ISA allowance is twenty thousand pounds","aids":["content-assertion-id"]}]}

If no artifacts worth sharing, return: {"artifacts":[]}`;
}

function normalizeArtifact(
  raw: ArtifactExtractionResponse["artifacts"][0]
): ExtractedArtifact | null {
  const typeMap: Record<string, ConversationArtifactType> = {
    SUMMARY: ConversationArtifactType.SUMMARY,
    KEY_FACT: ConversationArtifactType.KEY_FACT,
    FORMULA: ConversationArtifactType.FORMULA,
    EXERCISE: ConversationArtifactType.EXERCISE,
    RESOURCE_LINK: ConversationArtifactType.RESOURCE_LINK,
    STUDY_NOTE: ConversationArtifactType.STUDY_NOTE,
    REMINDER: ConversationArtifactType.REMINDER,
    MEDIA: ConversationArtifactType.MEDIA,
  };

  const artifactType = typeMap[raw.t?.toUpperCase()];
  if (!artifactType) return null;
  if (!raw.ti || !raw.c) return null;

  return {
    type: artifactType,
    title: raw.ti.slice(0, 200),
    content: raw.c,
    confidence: Math.max(0, Math.min(1, raw.co ?? 0.7)),
    evidence: raw.ev || "",
    assertionIds: Array.isArray(raw.aids) ? raw.aids : [],
  };
}

function calculateSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.split(/\s+/).filter(Boolean));

  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}
