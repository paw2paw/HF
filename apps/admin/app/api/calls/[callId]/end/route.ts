/**
 * POST /api/calls/[callId]/end
 *
 * End an active simulated call.
 * - Marks call as completed
 * - Converts JSON transcript to formatted text
 * - Triggers the pipeline to analyze the call and compose the next prompt
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

/**
 * Convert JSON messages to formatted transcript text
 */
function formatTranscript(messages: Message[]): string {
  const lines: string[] = [];

  for (const msg of messages) {
    const speaker = msg.role === "user" ? "USER" : "ASSISTANT";
    lines.push(`${speaker}: ${msg.content}`);
    lines.push(""); // Blank line between messages
  }

  return lines.join("\n").trim();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await params;
    const body = await request.json().catch(() => ({}));
    const { engine = "claude" } = body; // Optional: specify AI engine for pipeline

    // Fetch the call
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: {
        id: true,
        status: true,
        transcript: true,
        callerId: true,
        caller: {
          select: { id: true, name: true },
        },
      },
    });

    if (!call) {
      return NextResponse.json(
        { ok: false, error: "Call not found" },
        { status: 404 }
      );
    }

    if (call.status !== "in-progress") {
      return NextResponse.json(
        { ok: false, error: "Call is not in progress" },
        { status: 400 }
      );
    }

    if (!call.callerId) {
      return NextResponse.json(
        { ok: false, error: "Call has no caller assigned" },
        { status: 400 }
      );
    }

    // Parse and format transcript
    let messages: Message[] = [];
    let formattedTranscript = "";

    if (call.transcript) {
      try {
        messages = JSON.parse(call.transcript);
        formattedTranscript = formatTranscript(messages);
      } catch (e) {
        // If transcript is not JSON, keep as-is
        formattedTranscript = call.transcript;
      }
    }

    // Update call status
    const updatedCall = await prisma.call.update({
      where: { id: callId },
      data: {
        status: "completed",
        endedAt: new Date(),
        transcript: formattedTranscript, // Store as formatted text for pipeline
      },
      include: {
        caller: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Trigger the pipeline to analyze this call and compose the next prompt
    // Use internal fetch to call the pipeline endpoint
    const pipelineUrl = `${request.nextUrl.origin}/api/calls/${callId}/pipeline`;

    const pipelineResponse = await fetch(pipelineUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callerId: call.callerId,
        mode: "prompt", // Run full pipeline + compose prompt
        engine,
      }),
    });

    const pipelineData = await pipelineResponse.json();

    if (!pipelineData.ok) {
      console.error("Pipeline execution failed:", pipelineData.error);
      return NextResponse.json(
        {
          ok: false,
          error: `Call ended but pipeline failed: ${pipelineData.error}`,
          call: {
            id: updatedCall.id,
            status: updatedCall.status,
            endedAt: updatedCall.endedAt,
            messageCount: messages.length,
          },
          pipelineLogs: pipelineData.logs,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Call ended successfully and pipeline executed",
      call: {
        id: updatedCall.id,
        callerId: updatedCall.callerId,
        status: updatedCall.status,
        endedAt: updatedCall.endedAt,
        messageCount: messages.length,
        caller: updatedCall.caller,
      },
      pipeline: {
        scoresCreated: pipelineData.data?.scoresCreated || 0,
        memoriesCreated: pipelineData.data?.memoriesCreated || 0,
        promptComposed: !!pipelineData.prompt,
        promptId: pipelineData.data?.promptId,
        duration: pipelineData.duration,
      },
    });
  } catch (error: any) {
    console.error("Error ending call:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to end call" },
      { status: 500 }
    );
  }
}
