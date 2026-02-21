/**
 * Agent Tuner — Interpret Intent
 *
 * Translates natural language intent into behavior pills backed by
 * real Parameter records. The AI is grounded on interpretationHigh/Low
 * descriptions so it maps "warm" → BEH-WARMTH reliably.
 */

import { getConfiguredMeteredAICompletion } from "@/lib/metering/instrumented-ai";
import { classifyAIError, userMessageForError } from "@/lib/ai/error-utils";
import { loadAdjustableParameters, formatParameterList } from "./params";
import type { AgentTunerPill, InterpretRequest, InterpretResponse } from "./types";

// ── Main ──────────────────────────────────────────────

export async function interpretIntent(
  input: InterpretRequest,
): Promise<InterpretResponse> {
  const { intent, context } = input;

  if (!intent || intent.trim().length < 3) {
    return { ok: false, error: "Describe the behavior in at least a few words." };
  }

  try {
    const { params, validParamIds } = await loadAdjustableParameters();

    if (params.length === 0) {
      return { ok: false, error: "No adjustable behavior parameters found. Seed the system first." };
    }

    const systemPrompt = buildSystemPrompt(context);
    const userMessage = buildUserMessage(intent.trim(), params, context);

    // @ai-call agent-tuner.interpret — Translate natural language intent into behavior pills | config: /x/ai-config
    const response = await getConfiguredMeteredAICompletion(
      {
        callPoint: "agent-tuner.interpret",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
        maxTokens: 2048,
      },
      { sourceOp: "agent-tuner:interpret" },
    );

    // Parse AI response (strip markdown fences if present)
    const raw = response.content
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "");

    let parsed: { pills: RawPill[]; interpretation: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("[agent-tuner] Failed to parse AI response:", raw.slice(0, 500));
      return { ok: false, error: "The AI response was malformed. Please try again." };
    }

    // Sanitize pills: validate param IDs, clamp values, filter empties
    const pills: AgentTunerPill[] = (parsed.pills || [])
      .filter((pill) => pill.id && pill.label && Array.isArray(pill.parameters))
      .map((pill) => ({
        id: pill.id,
        label: pill.label,
        description: pill.description || "",
        intensity: clamp(pill.intensity ?? 0.7, 0, 1),
        source: "intent" as const,
        parameters: pill.parameters
          .filter((p) => validParamIds.has(p.parameterId))
          .map((p) => {
            const paramCtx = params.find((pp) => pp.id === p.parameterId);
            return {
              parameterId: p.parameterId,
              parameterName: paramCtx?.name || p.parameterId,
              atFull: clamp(p.atFull, 0, 1),
              atZero: paramCtx?.currentValue ?? 0.5,
            };
          }),
      }))
      .filter((pill) => pill.parameters.length > 0);

    return {
      ok: true,
      pills,
      interpretation: parsed.interpretation || "",
    };
  } catch (error: unknown) {
    const code = classifyAIError(error);
    const message = userMessageForError(code);
    console.error("[agent-tuner] interpret error:", error);
    return { ok: false, error: message };
  }
}

// ── Internal Types ────────────────────────────────────

interface RawPill {
  id: string;
  label: string;
  description?: string;
  intensity?: number;
  parameters: Array<{ parameterId: string; atFull: number }>;
}

// ── Helpers ───────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildSystemPrompt(context?: InterpretRequest["context"]): string {
  const domainHint = context?.domainName
    ? ` for the "${context.domainName}" domain`
    : "";
  const personaHint = context?.personaSlug
    ? ` The agent uses the "${context.personaSlug}" persona.`
    : "";

  return `You are an expert at configuring AI tutoring agents. You translate natural language style descriptions into "behavior pills" — high-level concept bundles that each control a group of behavior parameters${domainHint}.${personaHint}

Each pill has:
- id: kebab-case slug (e.g. "warm-tone")
- label: Short display name (2-4 words)
- description: One sentence explaining the concept
- intensity: Default 0.0-1.0 (how strongly to apply)
- parameters: Array of { parameterId, atFull } — target value at full intensity

Rules:
- Generate 3-5 pills that capture the user's intent
- Each pill should bundle 2-5 related parameters forming a coherent concept
- Prefer minimal overlap between pills
- atFull values must be 0.0-1.0
- Only reference parameterId values from the provided list
- Return ONLY valid JSON, no markdown fences, no explanation`;
}

function buildUserMessage(
  intent: string,
  params: Array<{
    id: string;
    name: string;
    group: string;
    currentValue: number;
    high: string;
    low: string;
  }>,
  context?: InterpretRequest["context"],
): string {
  const paramList = formatParameterList(params);
  const subjectHint = context?.subjectName
    ? `\nSubject: ${context.subjectName}`
    : "";

  return `User describes their desired agent style: "${intent}"${subjectHint}

Generate 3-5 behavior pills that capture this intent.

Available parameters:
${paramList}

Return JSON: { "pills": [...], "interpretation": "brief summary of suggested style" }`;
}
