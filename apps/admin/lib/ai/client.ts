/**
 * AI Client Module
 *
 * Provides a unified interface for calling different AI engines (Claude, OpenAI, Mock).
 * The engine selection is passed from the frontend via request headers or body.
 *
 * Supports runtime configuration via AIConfig table - use `callPoint` to load
 * provider/model settings from the database.
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
  /** Optional: specific model to use (overrides engine default) */
  model?: string;
  /** Optional: call point for loading config from database */
  callPoint?: string;
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
  const { engine, messages, maxTokens = 1024, temperature = 0.7, model } = options;

  switch (engine) {
    case "claude":
      return callClaude(messages, maxTokens, temperature, model);

    case "openai":
      return callOpenAI(messages, maxTokens, temperature, model);

    case "mock":
    default:
      return mockCompletion(messages);
  }
}

async function callClaude(
  messages: AIMessage[],
  maxTokens: number,
  temperature: number,
  model?: string
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

  // Use provided model or default
  const modelId = model || "claude-sonnet-4-20250514";

  const response = await client.messages.create({
    model: modelId,
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
  temperature: number,
  model?: string
): Promise<AICompletionResult> {
  const client = getOpenAIClient();

  // Use provided model or default
  const modelId = model || "gpt-4o";

  const response = await client.chat.completions.create({
    model: modelId,
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

  // Generate mock prompt if this is a compose/generation request
  if (content.toLowerCase().includes("compose") || content.toLowerCase().includes("generate") || content.toLowerCase().includes("agent guidance")) {
    return {
      content: `# Agent Guidance Prompt (MOCK)

## Identity & Role
You are a helpful, knowledgeable assistant focused on providing clear, accurate information and support.

## Conversation Context
This is a mock-generated prompt. In production, this would be customized based on:
- Caller's personality profile and preferences
- Conversation history and memories
- Learning progress and goals
- Behavioral targets for tone and style

## Behavioral Guidelines
- Be warm, approachable, and empathetic
- Match the caller's pace and communication style
- Ask thoughtful questions to encourage engagement
- Provide clear explanations tailored to their level

## Current Session Goals
- Build rapport and understand caller's needs
- Provide helpful, relevant information
- Encourage continued learning and exploration

---
*This is a MOCK prompt. Configure ANTHROPIC_API_KEY or OPENAI_API_KEY for real AI-generated prompts.*`,
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

// ============================================================
// STREAMING SUPPORT
// ============================================================

export interface AIStreamOptions {
  engine: AIEngine;
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Optional: specific model to use (overrides engine default) */
  model?: string;
  /** Optional: call point for loading config from database */
  callPoint?: string;
}

/**
 * Get AI completion as a streaming response
 * Returns a ReadableStream that can be directly returned from API routes
 */
export async function getAICompletionStream(
  options: AIStreamOptions
): Promise<ReadableStream<Uint8Array>> {
  const { engine, messages, maxTokens = 1024, temperature = 0.7, model } = options;

  switch (engine) {
    case "claude":
      return streamClaude(messages, maxTokens, temperature, model);
    case "openai":
      return streamOpenAI(messages, maxTokens, temperature, model);
    case "mock":
    default:
      return mockStream(messages);
  }
}

async function streamClaude(
  messages: AIMessage[],
  maxTokens: number,
  temperature: number,
  model?: string
): Promise<ReadableStream<Uint8Array>> {
  const client = getAnthropicClient();

  // Separate system message from user/assistant messages
  const systemMessage = messages.find((m) => m.role === "system");
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  // Use provided model or default
  const modelId = model || "claude-sonnet-4-20250514";

  const stream = client.messages.stream({
    model: modelId,
    max_tokens: maxTokens,
    temperature,
    system: systemMessage?.content,
    messages: chatMessages,
  });

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

async function streamOpenAI(
  messages: AIMessage[],
  maxTokens: number,
  temperature: number,
  model?: string
): Promise<ReadableStream<Uint8Array>> {
  const client = getOpenAIClient();

  // Use provided model or default
  const modelId = model || "gpt-4o";

  const stream = await client.chat.completions.create({
    model: modelId,
    max_tokens: maxTokens,
    temperature,
    stream: true,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

function mockStream(messages: AIMessage[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lastMessage = messages[messages.length - 1];

  // Generate a mock response based on the message
  let response = "This is a mock response. ";
  if (lastMessage?.content.toLowerCase().includes("help")) {
    response = "Available commands:\n• /help - Show this help\n• /context - Show current context\n• /clear - Clear chat history\n• /memories - Show caller memories\n• /buildprompt - Build composed prompt";
  } else if (lastMessage?.content.toLowerCase().includes("hello") || lastMessage?.content.toLowerCase().includes("hi")) {
    response = "Hello! I'm your AI assistant. How can I help you today?";
  } else {
    response = `I received your message: "${lastMessage?.content?.slice(0, 50)}..."\n\nThis is a mock response since no AI engine is configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY to enable real responses.`;
  }

  const words = response.split(" ");
  let index = 0;

  return new ReadableStream({
    async pull(controller) {
      if (index < words.length) {
        const word = words[index] + (index < words.length - 1 ? " " : "");
        controller.enqueue(encoder.encode(word));
        index++;
        // Simulate streaming delay
        await new Promise((resolve) => setTimeout(resolve, 50));
      } else {
        controller.close();
      }
    },
  });
}

// ============================================================
// CONFIG-AWARE COMPLETIONS
// ============================================================

import { getAIConfig } from "./config-loader";

export interface ConfiguredAIOptions {
  callPoint: string;
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Override the configured engine (for testing) */
  engineOverride?: AIEngine;
}

/**
 * Get AI completion using configuration from the database.
 * This is the preferred method for production code.
 *
 * @param options - Includes callPoint to load config for
 * @returns Completion result with model info
 */
export async function getConfiguredAICompletion(
  options: ConfiguredAIOptions
): Promise<AICompletionResult> {
  const { callPoint, messages, maxTokens, temperature, engineOverride } = options;

  // Load config from database
  const config = await getAIConfig(callPoint);

  // Use override if provided, otherwise use config
  const engine = engineOverride ?? config.provider;
  const model = config.model;

  // Merge config values with explicit options (explicit wins)
  const finalMaxTokens = maxTokens ?? config.maxTokens ?? 1024;
  const finalTemperature = temperature ?? config.temperature ?? 0.7;

  return getAICompletion({
    engine,
    messages,
    maxTokens: finalMaxTokens,
    temperature: finalTemperature,
    model,
  });
}

/**
 * Get AI completion stream using configuration from the database.
 *
 * @param options - Includes callPoint to load config for
 * @returns Streaming response
 */
export async function getConfiguredAICompletionStream(
  options: ConfiguredAIOptions
): Promise<ReadableStream<Uint8Array>> {
  const { callPoint, messages, maxTokens, temperature, engineOverride } = options;

  // Load config from database
  const config = await getAIConfig(callPoint);

  // Use override if provided, otherwise use config
  const engine = engineOverride ?? config.provider;
  const model = config.model;

  // Merge config values with explicit options
  const finalMaxTokens = maxTokens ?? config.maxTokens ?? 1024;
  const finalTemperature = temperature ?? config.temperature ?? 0.7;

  return getAICompletionStream({
    engine,
    messages,
    maxTokens: finalMaxTokens,
    temperature: finalTemperature,
    model,
  });
}
