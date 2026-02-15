import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { renderVoicePrompt } from "@/lib/prompt/composition/renderPromptSummary";
import { verifyVapiRequest } from "@/lib/vapi/auth";
import { VAPI_TOOL_DEFINITIONS } from "../tools/route";

export const runtime = "nodejs";

/**
 * @api POST /api/vapi/assistant-request
 * @visibility public
 * @scope vapi:assistant
 * @auth webhook-secret
 * @tags vapi, composition, calls
 * @description VAPI calls this at call start to get a per-caller assistant config.
 *   Identifies caller by phone number, loads their active ComposedPrompt,
 *   renders a voice-optimized system prompt, and returns full assistant config.
 *   Must respond within 7.5 seconds.
 *
 *   VAPI Server URL event: "assistant-request"
 *   Ref: https://docs.vapi.ai/server-url/events
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const authError = verifyVapiRequest(request, rawBody);
    if (authError) return authError;

    const body = JSON.parse(rawBody);

    // VAPI sends various event types to the Server URL
    const messageType = body.message?.type || body.type;

    if (messageType !== "assistant-request") {
      // For non-assistant-request events, acknowledge and return
      return NextResponse.json({ ok: true });
    }

    // Extract caller phone from VAPI call data
    const customerPhone =
      body.message?.call?.customer?.number ||
      body.call?.customer?.number ||
      null;

    if (!customerPhone) {
      console.warn("[vapi/assistant-request] No customer phone number in request (missing field)");
      return NextResponse.json(
        { error: "No customer phone number provided" },
        { status: 400 },
      );
    }

    // Normalize phone (strip spaces, ensure +)
    const normalizedPhone = customerPhone.replace(/\s+/g, "");

    // Find caller by phone
    const caller = await prisma.caller.findFirst({
      where: { phone: normalizedPhone },
      select: { id: true, name: true, phone: true },
    });

    if (!caller) {
      console.warn(`[vapi/assistant-request] No caller found for phone: ***${normalizedPhone.slice(-4)}`);
      // Return a generic assistant config for unknown callers
      return NextResponse.json({
        assistant: {
          model: {
            provider: "openai",
            model: config.ai.openai.model,
            messages: [
              {
                role: "system",
                content: "You are a helpful voice assistant. This caller is not yet registered in the system. Have a friendly conversation and gather their name.",
              },
            ],
          },
          firstMessage: "Hello! I don't think we've spoken before. What's your name?",
        },
      });
    }

    // Load the active ComposedPrompt for this caller
    const composedPrompt = await prisma.composedPrompt.findFirst({
      where: {
        callerId: caller.id,
        status: "active",
      },
      orderBy: { composedAt: "desc" },
      select: {
        id: true,
        llmPrompt: true,
        prompt: true,
      },
    });

    if (!composedPrompt?.llmPrompt) {
      console.warn(`[vapi/assistant-request] No active prompt for caller: ${caller.id}`);
      return NextResponse.json({
        assistant: {
          model: {
            provider: "openai",
            model: config.ai.openai.model,
            messages: [
              {
                role: "system",
                content: `You are a helpful voice tutor. The caller is ${caller.name || "a returning caller"}. No personalized prompt is available yet — have a warm, friendly conversation.`,
              },
            ],
          },
          firstMessage: `Hi${caller.name ? ` ${caller.name}` : ""}! Good to hear from you.`,
        },
      });
    }

    // Render voice-optimized prompt from the stored llmPrompt
    const voicePrompt = renderVoicePrompt(composedPrompt.llmPrompt as any);
    const firstLine = (composedPrompt.llmPrompt as any)?._quickStart?.first_line;

    console.log(
      `[vapi/assistant-request] Serving prompt for caller ${caller.id}: ${voicePrompt.length} chars`,
    );

    // Build tool definitions with server URL pointing to our tools endpoint
    const serverUrl = `${config.app.url}/api/vapi`;
    const tools = VAPI_TOOL_DEFINITIONS.map((tool) => ({
      ...tool,
      server: { url: `${serverUrl}/tools` },
    }));

    // Return VAPI assistant configuration
    // The assistant-request response format: https://docs.vapi.ai/server-url/events
    return NextResponse.json({
      assistant: {
        model: {
          provider: "openai",
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: voicePrompt,
            },
          ],
          tools,
        },
        ...(firstLine ? { firstMessage: firstLine } : {}),
        serverUrl: `${serverUrl}/webhook`,
        // Custom Knowledge Base — VAPI calls this per-turn for retrieval
        knowledgePlan: {
          provider: "custom-knowledge-base",
          server: {
            url: `${serverUrl}/knowledge`,
          },
        },
      },
    });
  } catch (error: any) {
    console.error("[vapi/assistant-request] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal error" },
      { status: 500 },
    );
  }
}
