/**
 * AI Sim Runner — Dual-AI Conversation Loop
 *
 * Runs a fully automated simulated call where AI plays BOTH roles:
 * - System Agent: Uses the caller's composed prompt (same as real calls)
 * - Simulated Caller: Separate prompt instructing AI to role-play as a realistic caller
 *
 * The conversation alternates between the two AIs for N turns.
 */

import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getConfiguredMeteredAICompletion } from "@/lib/metering/instrumented-ai";
import { executeComposition, loadComposeConfig, persistComposedPrompt } from "@/lib/prompt/composition";
import { renderPromptSummary } from "@/lib/prompt/composition/renderPromptSummary";

// =============================================================================
// TYPES
// =============================================================================

export type SimProgressEvent = {
  phase: "init" | "turn" | "pipeline" | "pipeline-result" | "error" | "complete";
  turn?: number;
  role?: "system" | "caller";
  message: string;
  detail?: Record<string, any>;
};

export interface SimRunnerOptions {
  callerId: string;
  turnCount: number;
  runPipeline: boolean;
  onProgress: (event: SimProgressEvent) => void;
}

export interface SimRunnerResult {
  callId: string;
  transcript: string;
  turns: { role: "system" | "caller"; content: string }[];
  pipelineResult?: Record<string, any>;
}

type AIMessage = { role: "system" | "user" | "assistant"; content: string };

// AI generation defaults for sim conversations
const SIM_SYSTEM_MAX_TOKENS = 300;
const SIM_SYSTEM_TEMPERATURE = 0.85;
const SIM_CALLER_MAX_TOKENS = 200;
const SIM_CALLER_TEMPERATURE = 0.9;

// =============================================================================
// CALLER PERSONA PROMPT
// =============================================================================

function buildCallerPersonaPrompt(
  callerName: string,
  domainName: string,
): string {
  return `You are role-playing as a caller named ${callerName} in a ${domainName} session.

RULES:
- You ARE the caller, NOT the AI assistant
- Respond naturally as a real person would
- Keep responses SHORT (1-3 sentences) — this simulates a phone/chat conversation
- Ask questions, express curiosity, sometimes be confused or unsure
- Do NOT be overly polite or perfect — be realistic and human
- React to what the assistant says, ask follow-ups
- If this is your first interaction, introduce yourself briefly
- Show some personality — maybe you're a bit nervous, or enthusiastic, or skeptical

You are talking to an AI assistant. Respond as yourself, the caller.`;
}

// =============================================================================
// ROLE INVERSION
// =============================================================================

/**
 * Invert conversation history for the "caller" AI.
 * From the caller's perspective:
 * - What the system said = incoming messages (role: "user")
 * - What the caller said = outgoing messages (role: "assistant")
 */
function invertRoles(history: AIMessage[]): AIMessage[] {
  return history.map((msg) => {
    if (msg.role === "system") return msg; // Keep system prompt as-is
    if (msg.role === "assistant") return { ...msg, role: "user" as const };
    if (msg.role === "user") return { ...msg, role: "assistant" as const };
    return msg;
  });
}

// =============================================================================
// MAIN SIM LOOP
// =============================================================================

export async function runSimulation(options: SimRunnerOptions): Promise<SimRunnerResult> {
  const { callerId, turnCount, runPipeline, onProgress } = options;

  // ─── Load caller ───
  const caller = await prisma.caller.findUnique({
    where: { id: callerId },
    include: { domain: true },
  });
  if (!caller) throw new Error("Caller not found");

  const callerName = caller.name || "Test Caller";
  const domainName = caller.domain?.name || "General";

  onProgress({ phase: "init", message: "Composing prompt..." });

  // ─── Compose prompt (or reuse active one) ───
  let systemPromptText: string;

  const activePrompt = await prisma.composedPrompt.findFirst({
    where: { callerId, status: "active" },
    orderBy: { composedAt: "desc" },
  });

  if (activePrompt?.prompt) {
    systemPromptText = activePrompt.prompt;
    onProgress({ phase: "init", message: "Using existing composed prompt" });
  } else {
    // Compose fresh
    const { fullSpecConfig, sections } = await loadComposeConfig({});
    const composition = await executeComposition(callerId, sections, fullSpecConfig);
    const promptSummary = renderPromptSummary(composition.llmPrompt);
    await persistComposedPrompt(composition, promptSummary, {
      callerId,
      triggerType: "sim",
    });
    systemPromptText = promptSummary || "You are a helpful AI assistant. Have a natural conversation.";
    onProgress({ phase: "init", message: "Fresh prompt composed" });
  }

  // ─── Create call record ───
  const lastCall = await prisma.call.findFirst({
    where: { callerId },
    orderBy: { callSequence: "desc" },
  });
  const nextSequence = (lastCall?.callSequence ?? 0) + 1;

  const call = await prisma.call.create({
    data: {
      callerId,
      source: "ai-simulation",
      callSequence: nextSequence,
      transcript: "",
      previousCallId: lastCall?.id || null,
    },
  });

  onProgress({ phase: "init", message: `Call #${nextSequence} created` });

  // ─── Build persona prompts ───
  const callerPersonaPrompt = buildCallerPersonaPrompt(callerName, domainName);

  const turns: { role: "system" | "caller"; content: string }[] = [];
  const conversationHistory: AIMessage[] = [];

  // ─── Turn 1: System agent opens ───
  // @ai-call test-harness.system — System agent opening turn in sim conversation | config: /x/ai-config
  const openingResult = await getConfiguredMeteredAICompletion(
    {
      callPoint: "test-harness.system",
      messages: [
        { role: "system", content: systemPromptText },
        { role: "user", content: "[Call begins — greet the caller warmly and naturally.]" },
      ],
      maxTokens: SIM_SYSTEM_MAX_TOKENS,
      temperature: SIM_SYSTEM_TEMPERATURE,
    },
    { callerId, callId: call.id, sourceOp: "test-harness.system" }
  );

  const openingText = openingResult.content || "Hello! How can I help you today?";
  turns.push({ role: "system", content: openingText });
  conversationHistory.push({ role: "assistant", content: openingText });
  onProgress({ phase: "turn", turn: 1, role: "system", message: openingText });

  // ─── Turns 2..N: Alternate caller and system ───
  for (let turn = 2; turn <= turnCount; turn++) {
    const isCallerTurn = turn % 2 === 0;

    if (isCallerTurn) {
      // Caller responds
      const callerHistory = invertRoles(conversationHistory);
      // @ai-call test-harness.caller — Caller persona turn in sim conversation | config: /x/ai-config
      const callerResult = await getConfiguredMeteredAICompletion(
        {
          callPoint: "test-harness.caller",
          messages: [
            { role: "system", content: callerPersonaPrompt },
            ...callerHistory,
          ],
          maxTokens: SIM_CALLER_MAX_TOKENS,
          temperature: SIM_CALLER_TEMPERATURE,
        },
        { callerId, callId: call.id, sourceOp: "test-harness.caller" }
      );

      const callerText = callerResult.content || "I see, tell me more.";
      turns.push({ role: "caller", content: callerText });
      conversationHistory.push({ role: "user", content: callerText });
      onProgress({ phase: "turn", turn, role: "caller", message: callerText });
    } else {
      // @ai-call test-harness.system — System agent response turn in sim conversation | config: /x/ai-config
      const systemResult = await getConfiguredMeteredAICompletion(
        {
          callPoint: "test-harness.system",
          messages: [
            { role: "system", content: systemPromptText },
            ...conversationHistory,
          ],
          maxTokens: SIM_SYSTEM_MAX_TOKENS,
          temperature: SIM_SYSTEM_TEMPERATURE,
        },
        { callerId, callId: call.id, sourceOp: "test-harness.system" }
      );

      const systemText = systemResult.content || "Is there anything else you'd like to know?";
      turns.push({ role: "system", content: systemText });
      conversationHistory.push({ role: "assistant", content: systemText });
      onProgress({ phase: "turn", turn, role: "system", message: systemText });
    }
  }

  // ─── Save transcript ───
  const transcript = turns
    .map((t) => `${t.role === "system" ? "Assistant" : "User"}: ${t.content}`)
    .join("\n");

  await prisma.call.update({
    where: { id: call.id },
    data: { transcript },
  });

  onProgress({ phase: "init", message: "Transcript saved" });

  // ─── Run pipeline ───
  let pipelineResult: Record<string, any> | undefined;
  if (runPipeline) {
    onProgress({ phase: "pipeline", message: "Running analysis pipeline..." });

    try {
      // Call the end-call pipeline endpoint internally
      const baseUrl = config.app.url;
      const pipelineRes = await fetch(`${baseUrl}/api/calls/${call.id}/pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callerId,
          mode: "prompt",
          engine: "claude",
          transcript,
        }),
      });

      if (pipelineRes.ok) {
        const data = await pipelineRes.json();
        pipelineResult = data.data || data;
        onProgress({
          phase: "pipeline-result",
          message: "Pipeline complete",
          detail: pipelineResult,
        });
      } else {
        const err = await pipelineRes.text();
        console.error("[sim-runner] Pipeline failed:", err);
        onProgress({ phase: "error", message: `Pipeline failed: ${pipelineRes.status}` });
      }
    } catch (err: any) {
      console.error("[sim-runner] Pipeline error:", err.message);
      onProgress({ phase: "error", message: `Pipeline error: ${err.message}` });
    }
  }

  return {
    callId: call.id,
    transcript,
    turns,
    pipelineResult,
  };
}
