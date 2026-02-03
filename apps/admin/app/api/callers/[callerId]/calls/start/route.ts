/**
 * POST /api/callers/[callerId]/calls/start
 *
 * Start a new simulated call for a caller.
 * - Checks for active calls (only one at a time)
 * - Fetches the latest composed prompt
 * - Creates a Call record with status "in-progress"
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callerId: string }> }
) {
  try {
    const { callerId } = await params;

    // Verify caller exists
    const caller = await prisma.caller.findUnique({
      where: { id: callerId },
      select: { id: true, name: true },
    });

    if (!caller) {
      return NextResponse.json(
        { ok: false, error: "Caller not found" },
        { status: 404 }
      );
    }

    // Check for any active calls
    const activeCall = await prisma.call.findFirst({
      where: {
        callerId,
        status: "in-progress",
      },
      select: { id: true, startedAt: true },
    });

    if (activeCall) {
      return NextResponse.json(
        {
          ok: false,
          error: "An active call is already in progress. Please end it before starting a new one.",
          activeCallId: activeCall.id,
        },
        { status: 400 }
      );
    }

    // Fetch the latest active composed prompt
    const composedPrompt = await prisma.composedPrompt.findFirst({
      where: {
        callerId,
        status: "active",
      },
      orderBy: { composedAt: "desc" },
      select: {
        id: true,
        prompt: true,
        llmPrompt: true,
      },
    });

    // Get the next call sequence
    const lastCall = await prisma.call.findFirst({
      where: { callerId },
      orderBy: { callSequence: "desc" },
      select: { id: true, callSequence: true },
    });

    const callSequence = lastCall?.callSequence ? lastCall.callSequence + 1 : 1;
    const previousCallId = lastCall?.id || null;

    // Create the call record
    const call = await prisma.call.create({
      data: {
        callerId,
        source: "ai-simulation",
        callSequence,
        previousCallId,
        transcript: "", // Empty transcript to start
        status: "in-progress",
        startedAt: new Date(),
        externalId: `sim-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
      include: {
        caller: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      call: {
        id: call.id,
        callerId: call.callerId,
        status: call.status,
        startedAt: call.startedAt,
        callSequence: call.callSequence,
        caller: call.caller,
      },
      composedPrompt: composedPrompt || null,
    });
  } catch (error: any) {
    console.error("Error starting call:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to start call" },
      { status: 500 }
    );
  }
}
