/**
 * AI Client Module
 *
 * Provides a unified interface for calling different AI engines (Claude, OpenAI, Mock).
 * The engine selection is passed from the frontend via request headers or body.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export type AIEngine = "mock" | "claude" | "openai";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICompletionOptions {
  engine: AIEngine;
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface AICompletionResult {
  content: string;
  engine: AIEngine;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// Lazy-initialized clients
let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    // Prefer OPENAI_HF_MVP_KEY, fall back to OPENAI_API_KEY
    const apiKey = process.env.OPENAI_HF_MVP_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_HF_MVP_KEY or OPENAI_API_KEY not configured");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Get AI completion from the specified engine
 */
export async function getAICompletion(options: AICompletionOptions): Promise<AICompletionResult> {
  const { engine, messages, maxTokens = 1024, temperature = 0.7 } = options;

  switch (engine) {
    case "claude":
      return callClaude(messages, maxTokens, temperature);

    case "openai":
      return callOpenAI(messages, maxTokens, temperature);

    case "mock":
    default:
      return mockCompletion(messages);
  }
}

async function callClaude(
  messages: AIMessage[],
  maxTokens: number,
  temperature: number
): Promise<AICompletionResult> {
  const client = getAnthropicClient();

  // Separate system message from user/assistant messages
  const systemMessage = messages.find((m) => m.role === "system");
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    temperature,
    system: systemMessage?.content,
    messages: chatMessages,
  });

  const textContent = response.content.find((c) => c.type === "text");

  return {
    content: textContent?.text || "",
    engine: "claude",
    model: response.model,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

async function callOpenAI(
  messages: AIMessage[],
  maxTokens: number,
  temperature: number
): Promise<AICompletionResult> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: maxTokens,
    temperature,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const choice = response.choices[0];

  return {
    content: choice?.message?.content || "",
    engine: "openai",
    model: response.model,
    usage: response.usage
      ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
        }
      : undefined,
  };
}

function mockCompletion(messages: AIMessage[]): AICompletionResult {
  // For mock mode, return a structured response based on the last message
  const lastMessage = messages[messages.length - 1];
  const content = lastMessage?.content || "";

  // Generate mock scores if the prompt seems to be asking for scoring
  if (content.toLowerCase().includes("score") || content.toLowerCase().includes("rate")) {
    return {
      content: JSON.stringify({
        score: 0.5 + Math.random() * 0.3,
        confidence: 0.7 + Math.random() * 0.2,
        reasoning: "Mock scoring based on pattern analysis",
      }),
      engine: "mock",
      model: "mock_v1",
    };
  }

  // Generate mock memories if the prompt seems to be asking for extraction
  if (content.toLowerCase().includes("extract") || content.toLowerCase().includes("memory")) {
    return {
      content: JSON.stringify({
        memories: [
          { category: "CONTEXT", key: "interaction_type", value: "general", confidence: 0.8 },
        ],
      }),
      engine: "mock",
      model: "mock_v1",
    };
  }

  // Default mock response
  return {
    content: JSON.stringify({ result: "mock_response", timestamp: new Date().toISOString() }),
    engine: "mock",
    model: "mock_v1",
  };
}

/**
 * Check if an engine is available (API key configured)
 */
export function isEngineAvailable(engine: AIEngine): boolean {
  switch (engine) {
    case "mock":
      return true;
    case "claude":
      return !!process.env.ANTHROPIC_API_KEY;
    case "openai":
      return !!(process.env.OPENAI_HF_MVP_KEY || process.env.OPENAI_API_KEY);
    default:
      return false;
  }
}

/**
 * Get the default engine (first available)
 */
export function getDefaultEngine(): AIEngine {
  if (isEngineAvailable("claude")) return "claude";
  if (isEngineAvailable("openai")) return "openai";
  return "mock";
}
