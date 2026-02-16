import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { renderVoicePrompt } from "@/lib/prompt/composition/renderPromptSummary";
import { verifyVapiRequest } from "@/lib/vapi/auth";
import { getVoiceCallSettings } from "@/lib/system-settings";
import { VAPI_TOOL_DEFINITIONS, TOOL_SETTING_KEYS } from "../tools/route";

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

    // Load voice call settings (30s cache — hot-configurable via Settings UI)
    const vs = await getVoiceCallSettings();

    // Normalize phone (strip spaces, ensure +)
    const normalizedPhone = customerPhone.replace(/\s+/g, "");

    // Find caller by phone
    const caller = await prisma.caller.findFirst({
      where: { phone: normalizedPhone },
      select: { id: true, name: true, phone: true },
    });

    if (!caller) {
      console.warn(`[vapi/assistant-request] No caller found for phone: ***${normalizedPhone.slice(-4)}`);
      return NextResponse.json({
        assistant: {
          model: {
            provider: vs.provider,
            model: vs.model,
            messages: [
              {
                role: "system",
                content: vs.unknownCallerPrompt,
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
      const callerLabel = caller.name || "a returning caller";
      return NextResponse.json({
        assistant: {
          model: {
            provider: vs.provider,
            model: vs.model,
            messages: [
              {
                role: "system",
                content: `${vs.noActivePromptFallback} The caller is ${callerLabel}.`,
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
      `[vapi/assistant-request] Serving prompt for caller ${caller.id}: ${voicePrompt.length} chars (provider: ${vs.provider}, model: ${vs.model}, rag: ${vs.knowledgePlanEnabled})`,
    );

    // Build tool definitions — only include tools enabled in settings
    const serverUrl = `${config.app.url}/api/vapi`;
    const enabledTools = VAPI_TOOL_DEFINITIONS
      .filter((tool) => {
        const settingKey = TOOL_SETTING_KEYS[tool.function.name];
        return settingKey ? (vs as any)[settingKey] : true;
      })
      .map((tool) => ({
        ...tool,
        server: { url: `${serverUrl}/tools` },
      }));

    // Build assistant response
    const assistant: Record<string, any> = {
      model: {
        provider: vs.provider,
        model: vs.model,
        messages: [
          {
            role: "system",
            content: voicePrompt,
          },
        ],
        ...(enabledTools.length > 0 ? { tools: enabledTools } : {}),
      },
      ...(firstLine ? { firstMessage: firstLine } : {}),
      serverUrl: `${serverUrl}/webhook`,
    };

    // Per-turn RAG — only include knowledgePlan if enabled in settings
    if (vs.knowledgePlanEnabled) {
      assistant.knowledgePlan = {
        provider: "custom-knowledge-base",
        server: {
          url: `${serverUrl}/knowledge`,
        },
      };
    }

    return NextResponse.json({ assistant });
  } catch (error: any) {
    console.error("[vapi/assistant-request] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal error" },
      { status: 500 },
    );
  }
}
