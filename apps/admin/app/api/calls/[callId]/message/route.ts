/**
 * POST /api/calls/[callId]/message
 *
 * Append a message to an active call's transcript (auto-save during simulation)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await params;
    const body = await request.json();
    const { role, content } = body;

    if (!role || !content) {
      return NextResponse.json(
        { ok: false, error: "Missing role or content" },
        { status: 400 }
      );
    }

    if (role !== "user" && role !== "assistant") {
      return NextResponse.json(
        { ok: false, error: "Role must be 'user' or 'assistant'" },
        { status: 400 }
      );
    }

    // Fetch the call
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: { id: true, status: true, transcript: true },
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

    // Parse existing transcript (JSON array or empty)
    let messages: Message[] = [];
    if (call.transcript) {
      try {
        messages = JSON.parse(call.transcript);
      } catch (e) {
        // If transcript is not JSON, treat as legacy text format
        // Convert to empty array and start fresh
        messages = [];
      }
    }

    // Add new message
    messages.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });

    // Update the call
    await prisma.call.update({
      where: { id: callId },
      data: {
        transcript: JSON.stringify(messages),
      },
    });

    return NextResponse.json({
      ok: true,
      messageCount: messages.length,
    });
  } catch (error: any) {
    console.error("Error saving message:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to save message" },
      { status: 500 }
    );
  }
}
