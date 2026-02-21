/**
 * Action Extraction from Transcripts
 *
 * Extracts actionable items from call transcripts:
 * - Homework assigned to the learner
 * - Follow-ups the agent promised
 * - Tasks for operators (send media, etc.)
 * - Reminders for anyone
 *
 * Follows the same pattern as extract-artifacts.ts:
 * Load transcript → Call metered AI → Parse JSON → Deduplicate → Persist
 */

import { prisma } from "@/lib/prisma";
import { CallActionType, CallActionAssignee, CallActionPriority } from "@prisma/client";
import { AIEngine } from "@/lib/ai/client";
import { getConfiguredMeteredAICompletion, logMockAIUsage } from "@/lib/metering";
import { logAI } from "@/lib/logger";
import { getActionSettings, ACTIONS_DEFAULTS } from "@/lib/system-settings";

// =====================================================
// TYPES
// =====================================================

export interface ActionExtractionResult {
  actionsCreated: number;
  actionsSkipped: number;
  errors: string[];
}

interface ExtractedAction {
  type: CallActionType;
  assignee: CallActionAssignee;
  title: string;
  description: string;
  priority: CallActionPriority;
  confidence: number;
  evidence: string;
}

interface ActionExtractionResponse {
  actions: Array<{
    t: string;    // CallActionType
    a: string;    // CallActionAssignee
    ti: string;   // title
    d: string;    // description
    p: string;    // priority
    co: number;   // confidence
    ev: string;   // evidence (transcript excerpt)
  }>;
}

type Logger = {
  info: (msg: string, data?: any) => void;
  warn: (msg: string, data?: any) => void;
  error: (msg: string, data?: any) => void;
  debug: (msg: string, data?: any) => void;
};

// =====================================================
// MAIN EXPORT
// =====================================================

/**
 * Extract actionable items from a call transcript.
 * Creates CallAction records with status=PENDING.
 */
export async function extractActions(
  call: { id: string; transcript: string | null },
  callerId: string,
  engine: AIEngine,
  log: Logger
): Promise<ActionExtractionResult> {
  const result: ActionExtractionResult = {
    actionsCreated: 0,
    actionsSkipped: 0,
    errors: [],
  };

  // Load thresholds from SystemSettings (falls back to ACTIONS_DEFAULTS)
  const settings = await getActionSettings().catch(() => ACTIONS_DEFAULTS);

  // 1. Validate input
  if (!call.transcript || call.transcript.length < settings.minTranscriptLength) {
    log.info("Skipping action extraction - transcript too short", {
      callId: call.id,
      transcriptLength: call.transcript?.length ?? 0,
    });
    return result;
  }

  try {
    // 2. Load existing actions for deduplication
    const existingActions = await prisma.callAction.findMany({
      where: { callerId },
      select: { id: true, type: true, title: true },
    });

    // 3. Build prompt
    const prompt = buildActionExtractionPrompt(call.transcript, existingActions, settings.transcriptLimit);

    // 4. Handle mock engine
    if (engine === "mock") {
      await logMockAIUsage({
        callId: call.id,
        callerId,
        sourceOp: "pipeline:extract_actions",
        metadata: { reason: "mock_engine" },
      }).catch((e) => log.warn("Failed to log mock usage", { error: (e as Error).message }));
      log.info("Mock action extraction complete", { callId: call.id });
      return result;
    }

    // @ai-call pipeline.actions — Extract actionable items from transcript | config: /x/ai-config
    const aiResult = await getConfiguredMeteredAICompletion(
      {
        callPoint: "pipeline.actions",
        engineOverride: engine,
        messages: [
          {
            role: "system",
            content:
              "You are an expert at identifying actionable items from tutoring conversations. Extract homework, follow-ups, tasks, and reminders. Return valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        maxTokens: 1024,
        temperature: 0.3,
      },
      { callId: call.id, callerId, sourceOp: "pipeline:extract_actions" }
    );

    logAI("pipeline:extract_actions", prompt, aiResult.content, {
      usage: aiResult.usage,
      callId: call.id,
      callerId,
    });
    log.debug("AI action extraction response", { model: aiResult.model, tokens: aiResult.usage });

    // 5. Parse response
    let jsonContent = aiResult.content.trim();
    if (jsonContent.startsWith("```")) {
      jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    let parsed: ActionExtractionResponse;
    try {
      parsed = JSON.parse(jsonContent);
    } catch (parseError) {
      log.error("Action extraction JSON parse failed", {
        error: (parseError as Error).message,
        content: jsonContent.slice(0, 200),
      });
      result.errors.push(`JSON parse error: ${(parseError as Error).message}`);
      return result;
    }

    // 6. Process each extracted action
    if (parsed.actions && Array.isArray(parsed.actions)) {
      for (const rawAction of parsed.actions) {
        try {
          const extracted = normalizeAction(rawAction);
          if (!extracted) {
            result.actionsSkipped++;
            continue;
          }

          if (extracted.confidence < settings.confidenceThreshold) {
            log.debug("Skipping low confidence action", {
              title: extracted.title,
              confidence: extracted.confidence,
            });
            result.actionsSkipped++;
            continue;
          }

          // Deduplicate
          const isDuplicate = existingActions.some(
            (e) =>
              e.type === extracted.type &&
              calculateSimilarity(
                e.title.toLowerCase(),
                extracted.title.toLowerCase()
              ) > settings.similarityThreshold
          );

          if (isDuplicate) {
            log.debug("Skipping duplicate action", { title: extracted.title });
            result.actionsSkipped++;
            continue;
          }

          await prisma.callAction.create({
            data: {
              callId: call.id,
              callerId,
              type: extracted.type,
              assignee: extracted.assignee,
              title: extracted.title,
              description: extracted.description || null,
              priority: extracted.priority,
              source: "EXTRACTED",
              confidence: extracted.confidence,
              evidence: extracted.evidence,
            },
          });

          result.actionsCreated++;
          log.info("Created action", {
            type: extracted.type,
            assignee: extracted.assignee,
            title: extracted.title,
          });
        } catch (actionError) {
          log.error("Failed to process action", {
            error: (actionError as Error).message,
            title: rawAction.ti,
          });
          result.errors.push(`Action "${rawAction.ti}": ${(actionError as Error).message}`);
        }
      }
    }

    log.info("Action extraction complete", result);
    return result;
  } catch (error: any) {
    log.error("Action extraction failed", { error: error.message, callId: call.id });
    result.errors.push(error.message);
    return result;
  }
}

// =====================================================
// HELPERS
// =====================================================

function buildActionExtractionPrompt(
  transcript: string,
  existingActions: Array<{ id: string; type: CallActionType; title: string }>,
  transcriptLimit: number,
): string {
  const existingList =
    existingActions.length > 0
      ? existingActions.map((a) => `${a.type}|${a.title}`).join("\n")
      : "None";

  return `Extract actionable items from this tutoring conversation.

ACTION TYPES:
- SEND_MEDIA: Agent or operator needs to send a document, image, or resource to the learner
- HOMEWORK: Practice exercise, study task, or assignment for the learner to complete
- TASK: Generic actionable task for anyone
- FOLLOWUP: Something to revisit or follow up on in a future conversation
- REMINDER: Something to remember or check on

ASSIGNEES:
- CALLER: The learner needs to do this (homework, practice, revision)
- OPERATOR: An admin/operator needs to fulfill this (send materials, set up access)
- AGENT: The AI agent should do this in the next conversation (explain a topic, check on progress)

PRIORITIES:
- LOW: Nice to have, no urgency
- MEDIUM: Standard importance (default)
- HIGH: Important, should be done soon
- URGENT: Critical, needs immediate attention

EXTRACTION RULES:
- Only extract clear, actionable commitments or assignments
- "I'll send you..." or "Let me share..." → AGENT or OPERATOR assigning SEND_MEDIA
- "Practice X" or "For homework..." or "Try doing Y" → CALLER doing HOMEWORK
- "Next time we'll cover..." or "I'll explain that..." → AGENT doing FOLLOWUP
- "Remember to..." or "Don't forget..." → appropriate assignee doing REMINDER
- Title should be concise (max 60 chars), description should give context
- Confidence: 0.8-1.0 for explicit commitments, 0.5-0.7 for implied
- Do NOT extract actions that duplicate existing ones

EXISTING ACTIONS (do not duplicate):
${existingList}

TRANSCRIPT:
${transcript.slice(0, transcriptLimit)}

Return JSON (no markdown):
{"actions":[{"t":"HOMEWORK","a":"CALLER","ti":"Practice times tables","d":"Practice 7x and 8x multiplication tables before next session","p":"MEDIUM","co":0.9,"ev":"for homework try the seven and eight times tables"}]}

If no actions found, return: {"actions":[]}`;
}

function normalizeAction(
  raw: ActionExtractionResponse["actions"][0]
): ExtractedAction | null {
  const typeMap: Record<string, CallActionType> = {
    SEND_MEDIA: CallActionType.SEND_MEDIA,
    HOMEWORK: CallActionType.HOMEWORK,
    TASK: CallActionType.TASK,
    FOLLOWUP: CallActionType.FOLLOWUP,
    REMINDER: CallActionType.REMINDER,
  };

  const assigneeMap: Record<string, CallActionAssignee> = {
    CALLER: CallActionAssignee.CALLER,
    OPERATOR: CallActionAssignee.OPERATOR,
    AGENT: CallActionAssignee.AGENT,
  };

  const priorityMap: Record<string, CallActionPriority> = {
    LOW: CallActionPriority.LOW,
    MEDIUM: CallActionPriority.MEDIUM,
    HIGH: CallActionPriority.HIGH,
    URGENT: CallActionPriority.URGENT,
  };

  const actionType = typeMap[raw.t?.toUpperCase()];
  if (!actionType) return null;

  const actionAssignee = assigneeMap[raw.a?.toUpperCase()];
  if (!actionAssignee) return null;

  if (!raw.ti) return null;

  return {
    type: actionType,
    assignee: actionAssignee,
    title: raw.ti.slice(0, 200),
    description: raw.d || "",
    priority: priorityMap[raw.p?.toUpperCase()] || CallActionPriority.MEDIUM,
    confidence: Math.max(0, Math.min(1, raw.co ?? 0.7)),
    evidence: raw.ev || "",
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
