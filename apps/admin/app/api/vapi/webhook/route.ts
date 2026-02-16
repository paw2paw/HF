import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { verifyVapiRequest } from "@/lib/vapi/auth";
import { getVoiceCallSettings } from "@/lib/system-settings";

export const runtime = "nodejs";

/**
 * @api POST /api/vapi/webhook
 * @visibility public
 * @scope vapi:webhook
 * @auth webhook-secret
 * @tags vapi, calls, ingest
 * @description Receives VAPI webhook events. Handles end-of-call-report to
 *   create Call records and optionally trigger the analysis pipeline.
 *
 *   Events handled:
 *   - end-of-call-report: Create Call record from VAPI call data
 *   - status-update: Log call status changes
 *
 *   Ref: https://docs.vapi.ai/server-url/events
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const authError = verifyVapiRequest(request, rawBody);
    if (authError) return authError;

    const body = JSON.parse(rawBody);
    const messageType = body.message?.type || body.type;

    switch (messageType) {
      case "end-of-call-report":
        return handleEndOfCallReport(body.message || body);

      case "status-update":
        console.log(
          `[vapi/webhook] Status update: ${body.message?.status || body.status}`,
        );
        return NextResponse.json({ ok: true });

      default:
        // Acknowledge all other events
        return NextResponse.json({ ok: true });
    }
  } catch (error: any) {
    console.error("[vapi/webhook] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Webhook processing failed" },
      { status: 500 },
    );
  }
}

/**
 * Handle VAPI end-of-call-report: create Call record, link to caller, optionally trigger pipeline.
 */
async function handleEndOfCallReport(message: any) {
  const call = message.call || message;
  const vapiCallId = call.id || call.callId || call.call_id;
  const customerPhone = call.customer?.number || null;
  const customerName = call.customer?.name || null;

  if (!vapiCallId) {
    console.warn("[vapi/webhook] end-of-call-report missing call ID");
    return NextResponse.json({ error: "Missing call ID" }, { status: 400 });
  }

  // Check for duplicate
  const existing = await prisma.call.findFirst({
    where: { externalId: vapiCallId },
  });
  if (existing) {
    console.log(`[vapi/webhook] Duplicate call ${vapiCallId}, skipping`);
    return NextResponse.json({ ok: true, duplicate: true, callId: existing.id });
  }

  // Build transcript from messages array or use raw transcript
  let transcript = call.transcript || "";
  if (!transcript && call.messages?.length) {
    transcript = call.messages
      .filter((m: any) => m.role && m.content)
      .map((m: any) => `${m.role}: ${m.content}`)
      .join("\n");
  }

  // Find or create caller by phone
  let callerId: string | null = null;
  if (customerPhone) {
    const normalizedPhone = customerPhone.replace(/\s+/g, "");
    const caller = await prisma.caller.findFirst({
      where: { phone: normalizedPhone },
    });

    if (caller) {
      callerId = caller.id;
    } else {
      // Create new caller
      const newCaller = await prisma.caller.create({
        data: {
          phone: normalizedPhone,
          name: customerName || `Caller ${normalizedPhone.slice(-4)}`,
        },
      });
      callerId = newCaller.id;
      console.log(
        `[vapi/webhook] Created new caller: ${newCaller.id} (***${normalizedPhone.slice(-4)})`,
      );
    }
  }

  // Find the active prompt that was used for this call
  let usedPromptId: string | null = null;
  if (callerId) {
    const activePrompt = await prisma.composedPrompt.findFirst({
      where: { callerId, status: "active" },
      orderBy: { composedAt: "desc" },
      select: { id: true },
    });
    usedPromptId = activePrompt?.id || null;
  }

  // Create the Call record
  const newCall = await prisma.call.create({
    data: {
      externalId: vapiCallId,
      source: "vapi",
      transcript: transcript || "(no transcript)",
      callerId: callerId,
      usedPromptId: usedPromptId,
    },
  });

  console.log(
    `[vapi/webhook] Created call ${newCall.id} from VAPI ${vapiCallId}` +
      (callerId ? ` for caller ${callerId}` : ""),
  );

  // Optionally trigger pipeline (DB setting overrides env var)
  const vs = await getVoiceCallSettings();
  if (vs.autoPipeline && callerId) {
    // Fire-and-forget pipeline trigger
    triggerPipeline(newCall.id, callerId).catch((err) => {
      console.error(`[vapi/webhook] Pipeline trigger failed for call ${newCall.id}:`, err);
    });
  }

  return NextResponse.json({
    ok: true,
    callId: newCall.id,
    callerId,
  });
}

/**
 * Trigger the analysis pipeline for a call (fire-and-forget).
 */
async function triggerPipeline(callId: string, callerId: string) {
  const baseUrl = config.app.url;
  const response = await fetch(`${baseUrl}/api/calls/${callId}/pipeline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": config.security.internalApiSecret,
    },
    body: JSON.stringify({ callerId }),
  });

  if (!response.ok) {
    console.error(`[vapi/webhook] Pipeline trigger returned ${response.status}`);
  } else {
    console.log(`[vapi/webhook] Pipeline triggered for call ${callId}`);
  }
}

