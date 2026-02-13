import { NextRequest, NextResponse } from "next/server";
import { AIEngine, AIMessage } from "@/lib/ai/client";
import { getAIConfig } from "@/lib/ai/config-loader";
import { getConfiguredMeteredAICompletionStream } from "@/lib/metering";
import { buildSystemPrompt } from "./system-prompts";
import { executeCommand, parseCommand } from "@/lib/chat/commands";
import { logAI } from "@/lib/logger";
import { logAIInteraction } from "@/lib/ai/knowledge-accumulation";
import { requireAuth, isAuthError } from "@/lib/permissions";

export const runtime = "nodejs";

type ChatMode = "CHAT" | "DATA" | "SPEC" | "CALL";

interface EntityBreadcrumb {
  type: string;
  id: string;
  label: string;
  data?: Record<string, unknown>;
}

interface ChatRequest {
  message: string;
  mode: ChatMode;
  entityContext: EntityBreadcrumb[];
  conversationHistory?: { role: string; content: string }[];
  isCommand?: boolean;
  engine?: AIEngine;
}

/**
 * @api POST /api/chat
 * @visibility internal
 * @scope chat:send
 * @auth session
 * @tags chat
 * @description Sends a message to the AI chat assistant. Supports multiple modes (CHAT, DATA, SPEC, CALL) with mode-specific system prompts. Returns a streaming text response. Handles slash commands separately. Logs interactions for AI knowledge accumulation.
 * @body message string - User message text (required)
 * @body mode string - Chat mode: "CHAT" | "DATA" | "SPEC" | "CALL"
 * @body entityContext EntityBreadcrumb[] - Current UI context breadcrumbs
 * @body conversationHistory object[] - Previous conversation messages
 * @body engine string - AI engine to use (optional, uses default if not specified)
 * @response 200 text/plain (streaming response)
 * @response 400 { ok: false, error: "Message is required" }
 * @response 500 { ok: false, error: "...", errorCode: "BILLING" | "AUTH" | "RATE_LIMIT" | ... }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const body: ChatRequest = await request.json();
    const { message, mode, entityContext, conversationHistory = [], engine } = body;

    if (!message?.trim()) {
      return NextResponse.json({ ok: false, error: "Message is required" }, { status: 400 });
    }

    // Check for slash command
    const parsed = parseCommand(message);
    if (parsed) {
      const result = await executeCommand(message, entityContext, mode);
      return NextResponse.json(result);
    }

    // Build mode-specific system prompt
    const systemPrompt = await buildSystemPrompt(mode, entityContext);

    // Prepare messages with conversation history
    // Check if the last message in history is already the user's current message (to avoid duplication)
    const lastHistoryMessage = conversationHistory[conversationHistory.length - 1];
    const isUserMessageInHistory = lastHistoryMessage?.role === "user" && lastHistoryMessage?.content === message.trim();

    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-10).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      // Only add user message if it's not already at the end of history
      ...(isUserMessageInHistory ? [] : [{ role: "user" as const, content: message.trim() }]),
    ];

    // @ai-call chat.{chat|data|spec|call} — Streaming chat per mode | config: /x/ai-config
    const callPoint = `chat.${mode.toLowerCase()}`;
    const aiConfig = await getAIConfig(callPoint);
    const selectedEngine = engine || aiConfig.provider;

    const { stream: meteredStream, model } = await getConfiguredMeteredAICompletionStream(
      {
        callPoint,
        engineOverride: engine,
        messages,
        maxTokens: mode === "CALL" ? 300 : 2000,
        temperature: mode === "CALL" ? 0.85 : 0.7,
      },
      { sourceOp: callPoint }
    );

    // Log the chat request (response is streamed so we log metadata only)
    const promptSummary = `[${mode}] ${message.slice(0, 200)}${message.length > 200 ? "..." : ""}`;
    logAI("chat", promptSummary, "(streaming)", {
      mode,
      engine: selectedEngine,
      messageLength: message.length,
      historyLength: conversationHistory.length,
      entityContext: entityContext.map((e) => `${e.type}:${e.id}`).join(", "),
    });

    // Log for AI knowledge accumulation (in background)
    const entityInfo = entityContext.length > 0 ? entityContext[0] : null;
    logAIInteraction({
      callPoint: `chat.${mode.toLowerCase()}`,
      userMessage: message,
      aiResponse: "(streaming response)",
      outcome: "success",
      metadata: {
        entityType: entityInfo?.type,
        entityId: entityInfo?.id,
        action: "chat",
        model: selectedEngine, // e.g., "anthropic", "openai"
        provider: selectedEngine,
      },
    }).catch(console.error);

    return new Response(meteredStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Chat-Mode": mode,
        "X-AI-Engine": selectedEngine,
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);

    // Parse AI provider-specific errors for better messaging
    const errorMessage = parseAIError(error);

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
        errorCode: getErrorCode(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Parse AI provider errors into user-friendly messages
 */
function parseAIError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unknown error occurred";
  }

  const message = error.message.toLowerCase();

  // Anthropic billing errors
  if (message.includes("credit balance is too low")) {
    return "Anthropic API credits exhausted. Please add credits at console.anthropic.com or switch to OpenAI in AI Config.";
  }

  // API key errors
  if (message.includes("api key") || message.includes("authentication") || message.includes("unauthorized")) {
    return "API key invalid or not configured. Check your .env.local file.";
  }

  // Rate limiting
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return "Rate limited by AI provider. Please wait a moment and try again.";
  }

  // Model errors
  if (message.includes("model") && (message.includes("not found") || message.includes("does not exist"))) {
    return "AI model not available. Check AI Config settings.";
  }

  // Network errors
  if (message.includes("network") || message.includes("econnrefused") || message.includes("timeout")) {
    return "Network error connecting to AI provider. Check your internet connection.";
  }

  // Content policy
  if (message.includes("content policy") || message.includes("safety")) {
    return "Message blocked by AI safety filters.";
  }

  // Return the original message if no specific pattern matched
  return error.message;
}

/**
 * Extract error code for frontend handling
 */
function getErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return "UNKNOWN";

  const message = error.message.toLowerCase();

  if (message.includes("credit balance")) return "BILLING";
  if (message.includes("api key") || message.includes("authentication")) return "AUTH";
  if (message.includes("rate limit")) return "RATE_LIMIT";
  if (message.includes("model")) return "MODEL";
  if (message.includes("network") || message.includes("timeout")) return "NETWORK";
  if (message.includes("content policy") || message.includes("safety")) return "CONTENT_POLICY";

  return "API_ERROR";
}
