import { NextRequest, NextResponse } from "next/server";
import { AIEngine, AIMessage, ContentBlock } from "@/lib/ai/client";
import { getAIConfig } from "@/lib/ai/config-loader";
import { getConfiguredMeteredAICompletionStream, getConfiguredMeteredAICompletion } from "@/lib/metering";
import { buildSystemPrompt } from "./system-prompts";
import { executeCommand, parseCommand } from "@/lib/chat/commands";
import { logAI } from "@/lib/logger";
import { logAIInteraction } from "@/lib/ai/knowledge-accumulation";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { ADMIN_TOOLS } from "@/lib/chat/admin-tools";
import { executeAdminTool } from "@/lib/chat/admin-tool-handlers";
import { CHAT_TOOLS, executeToolCall, buildContentCatalog } from "./tools";

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
  callId?: string; // Active call ID for media message creation in CALL mode
}

const MAX_TOOL_ITERATIONS = 5;

/**
 * @api POST /api/chat
 * @visibility internal
 * @scope chat:send
 * @auth session
 * @tags chat
 * @description Sends a message to the AI chat assistant. Supports multiple modes (CHAT, DATA, SPEC, CALL) with mode-specific system prompts. DATA mode supports tool calling for database queries and spec updates. Returns a streaming text response. Handles slash commands separately. Logs interactions for AI knowledge accumulation.
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
    const { message, mode, entityContext, conversationHistory = [], engine, callId: requestCallId } = body;

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
    const lastHistoryMessage = conversationHistory[conversationHistory.length - 1];
    const isUserMessageInHistory = lastHistoryMessage?.role === "user" && lastHistoryMessage?.content === message.trim();

    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-10).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      ...(isUserMessageInHistory ? [] : [{ role: "user" as const, content: message.trim() }]),
    ];

    // @ai-call chat.{chat|data|spec|call} — Streaming chat per mode | config: /x/ai-config
    const callPoint = `chat.${mode.toLowerCase()}`;
    const aiConfig = await getAIConfig(callPoint);
    const selectedEngine = engine || aiConfig.provider;

    // DATA mode: use tool calling with non-streaming loop
    if (mode === "DATA") {
      return await handleDataModeWithTools(messages, callPoint, engine, selectedEngine, mode, message, entityContext, conversationHistory);
    }

    // CALL mode with content sharing tools
    if (mode === "CALL" && requestCallId) {
      const callerEntity = entityContext.find((e) => e.type === "caller");
      if (callerEntity) {
        return await handleCallModeWithTools(
          messages, callPoint, engine, selectedEngine, mode, message,
          entityContext, conversationHistory, callerEntity.id, requestCallId
        );
      }
    }

    // Other modes: standard streaming (no tools)
    const { stream: meteredStream } = await getConfiguredMeteredAICompletionStream(
      {
        callPoint,
        engineOverride: engine,
        messages,
        maxTokens: mode === "CALL" ? 300 : 2000,
        temperature: mode === "CALL" ? 0.85 : 0.7,
      },
      { sourceOp: callPoint }
    );

    logChatRequest(mode, message, selectedEngine, conversationHistory, entityContext);

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
    const errorMessage = parseAIError(error);
    return NextResponse.json(
      { ok: false, error: errorMessage, errorCode: getErrorCode(error) },
      { status: 500 }
    );
  }
}

/**
 * DATA mode with tool calling.
 * Uses non-streaming for the tool loop, then returns final text.
 */
async function handleDataModeWithTools(
  messages: AIMessage[],
  callPoint: string,
  engine: AIEngine | undefined,
  selectedEngine: string,
  mode: ChatMode,
  message: string,
  entityContext: EntityBreadcrumb[],
  conversationHistory: { role: string; content: string }[],
): Promise<Response> {
  const loopMessages: AIMessage[] = [...messages];
  let toolCallCount = 0;
  let finalContent = "";

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    // @ai-call chat.data — Non-streaming with tools | config: /x/ai-config
    const response = await getConfiguredMeteredAICompletion(
      {
        callPoint,
        engineOverride: engine,
        messages: loopMessages,
        maxTokens: 4000,
        temperature: 0.7,
        tools: ADMIN_TOOLS,
      },
      { sourceOp: `${callPoint}.tools` }
    );

    // If no tool calls, we're done
    if (!response.toolUses || response.toolUses.length === 0) {
      finalContent = response.content;
      break;
    }

    // Model wants to use tools
    toolCallCount += response.toolUses.length;

    // Add assistant's response (with tool_use blocks) to the conversation
    loopMessages.push({
      role: "assistant",
      content: response.rawContentBlocks || [{ type: "text", text: response.content }],
    });

    // Execute each tool and collect results
    const toolResultBlocks: ContentBlock[] = [];
    for (const toolUse of response.toolUses) {
      console.log(`[chat-tools] Executing tool: ${toolUse.name}`, JSON.stringify(toolUse.input).slice(0, 200));
      const result = await executeAdminTool(toolUse.name, toolUse.input);
      toolResultBlocks.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    // Add tool results as a user message
    loopMessages.push({
      role: "user",
      content: toolResultBlocks,
    });
  }

  // If loop exhausted without final content, use the last response
  if (!finalContent) {
    finalContent = "I used several tools but couldn't complete the request. Please try again with a more specific question.";
  }

  logChatRequest(mode, message, selectedEngine, conversationHistory, entityContext, toolCallCount);

  // Return as streaming-style response for consistency with other modes
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(finalContent));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Chat-Mode": mode,
      "X-AI-Engine": selectedEngine,
      "X-Tool-Calls": toolCallCount.toString(),
    },
  });
}

/**
 * CALL mode with content sharing tools.
 * Checks if teaching materials are available; if so, enables share_content tool.
 * Uses non-streaming for the tool loop, then returns final text as a stream.
 */
async function handleCallModeWithTools(
  messages: AIMessage[],
  callPoint: string,
  engine: AIEngine | undefined,
  selectedEngine: string,
  mode: ChatMode,
  message: string,
  entityContext: EntityBreadcrumb[],
  conversationHistory: { role: string; content: string }[],
  callerId: string,
  callId: string,
): Promise<Response> {
  // Check if there's any content to share
  const catalog = await buildContentCatalog(callerId);

  // No content available — fall back to standard streaming (no tools needed)
  if (!catalog) {
    const { stream: meteredStream } = await getConfiguredMeteredAICompletionStream(
      {
        callPoint,
        engineOverride: engine,
        messages,
        maxTokens: 300,
        temperature: 0.85,
      },
      { sourceOp: callPoint }
    );

    logChatRequest(mode, message, selectedEngine, conversationHistory, entityContext);

    return new Response(meteredStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Chat-Mode": mode,
        "X-AI-Engine": selectedEngine,
      },
    });
  }

  // Inject content catalog into system prompt
  const systemMsg = messages[0];
  if (systemMsg?.role === "system" && typeof systemMsg.content === "string") {
    systemMsg.content += catalog;
  }

  // Tool loop (same pattern as DATA mode)
  const loopMessages: AIMessage[] = [...messages];
  let toolCallCount = 0;
  let finalContent = "";
  const toolCtx = { callerId, callId };

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    // @ai-call chat.call — Non-streaming with content tools | config: /x/ai-config
    const response = await getConfiguredMeteredAICompletion(
      {
        callPoint,
        engineOverride: engine,
        messages: loopMessages,
        maxTokens: 300,
        temperature: 0.85,
        tools: CHAT_TOOLS,
      },
      { sourceOp: `${callPoint}.tools`, callerId, callId }
    );

    // No tool calls — done
    if (!response.toolUses || response.toolUses.length === 0) {
      finalContent = response.content;
      break;
    }

    toolCallCount += response.toolUses.length;

    // Add assistant's response to conversation
    loopMessages.push({
      role: "assistant",
      content: response.rawContentBlocks || [{ type: "text", text: response.content }],
    });

    // Execute tools and collect results
    const toolResultBlocks: ContentBlock[] = [];
    for (const toolUse of response.toolUses) {
      console.log(`[chat-tools:call] Executing: ${toolUse.name}`, JSON.stringify(toolUse.input).slice(0, 200));
      const result = await executeToolCall(toolUse, toolCtx);
      toolResultBlocks.push({
        type: "tool_result",
        tool_use_id: result.tool_use_id,
        content: result.content,
        ...(result.is_error ? { is_error: true } : {}),
      });
    }

    loopMessages.push({
      role: "user",
      content: toolResultBlocks,
    });
  }

  if (!finalContent) {
    finalContent = "Let me continue our conversation.";
  }

  logChatRequest(mode, message, selectedEngine, conversationHistory, entityContext, toolCallCount);

  // Return as streaming-style response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(finalContent));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Chat-Mode": mode,
      "X-AI-Engine": selectedEngine,
      "X-Tool-Calls": toolCallCount.toString(),
    },
  });
}

/**
 * Log chat request metadata
 */
function logChatRequest(
  mode: string,
  message: string,
  selectedEngine: string,
  conversationHistory: { role: string; content: string }[],
  entityContext: EntityBreadcrumb[],
  toolCalls?: number,
) {
  const promptSummary = `[${mode}] ${message.slice(0, 200)}${message.length > 200 ? "..." : ""}`;
  logAI("chat", promptSummary, "(streaming)", {
    mode,
    engine: selectedEngine,
    messageLength: message.length,
    historyLength: conversationHistory.length,
    entityContext: entityContext.map((e) => `${e.type}:${e.id}`).join(", "),
    ...(toolCalls ? { toolCalls } : {}),
  });

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
      model: selectedEngine,
      provider: selectedEngine,
      ...(toolCalls ? { toolCalls } : {}),
    },
  }).catch(console.error);
}

/**
 * Parse AI provider errors into user-friendly messages
 */
function parseAIError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unknown error occurred";
  }

  const message = error.message.toLowerCase();

  if (message.includes("credit balance is too low")) {
    return "Anthropic API credits exhausted. Please add credits at console.anthropic.com or switch to OpenAI in AI Config.";
  }
  if (message.includes("api key") || message.includes("authentication") || message.includes("unauthorized")) {
    return "API key invalid or not configured. Check your .env.local file.";
  }
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return "Rate limited by AI provider. Please wait a moment and try again.";
  }
  if (message.includes("model") && (message.includes("not found") || message.includes("does not exist"))) {
    return "AI model not available. Check AI Config settings.";
  }
  if (message.includes("network") || message.includes("econnrefused") || message.includes("timeout")) {
    return "Network error connecting to AI provider. Check your internet connection.";
  }
  if (message.includes("content policy") || message.includes("safety")) {
    return "Message blocked by AI safety filters.";
  }

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
