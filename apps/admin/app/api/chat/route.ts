import { NextRequest, NextResponse } from "next/server";
import { getAICompletionStream, getDefaultEngine, AIEngine, AIMessage } from "@/lib/ai/client";
import { createMeteredStream } from "@/lib/metering";
import { buildSystemPrompt } from "./system-prompts";
import { executeCommand, parseCommand } from "@/lib/chat/commands";

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

export async function POST(request: NextRequest) {
  try {
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

    // Get streaming response
    const selectedEngine = engine || getDefaultEngine();
    const stream = await getAICompletionStream({
      engine: selectedEngine,
      messages,
      maxTokens: mode === "CALL" ? 300 : 2000,
      temperature: mode === "CALL" ? 0.85 : 0.7,
    });

    // Wrap stream with metering to track estimated token usage
    const meteredStream = createMeteredStream(stream, selectedEngine, messages, {
      sourceOp: "chat",
    });

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
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
