/**
 * POST /api/callers/[callerId]/calls
 *
 * Create a new call record for a caller (e.g., for AI simulation)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callerId: string }> }
) {
  try {
    const { callerId } = await params;
    const body = await request.json().catch(() => ({}));
    const { source = "ai-simulation", callSequence, transcript, previousCallId } = body;

    // Verify caller exists
    const caller = await prisma.caller.findUnique({
      where: { id: callerId },
    });

    if (!caller) {
      return NextResponse.json(
        { ok: false, error: "Caller not found" },
        { status: 404 }
      );
    }

    // Get the next call sequence if not provided
    let sequence = callSequence;
    let prevCallId = previousCallId;

    if (!sequence) {
      const lastCall = await prisma.call.findFirst({
        where: { callerId },
        orderBy: { callSequence: "desc" },
        select: { id: true, callSequence: true },
      });

      sequence = lastCall?.callSequence ? lastCall.callSequence + 1 : 1;
      if (!prevCallId && lastCall) {
        prevCallId = lastCall.id;
      }
    }

    // Create the call
    const call = await prisma.call.create({
      data: {
        callerId,
        source,
        callSequence: sequence,
        previousCallId: prevCallId,
        transcript: transcript || "", // Required field - start with empty string
        status: "in-progress", // Mark as active for AI simulation
        startedAt: new Date(),
        externalId: `sim-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
    });

    return NextResponse.json({
      ok: true,
      call,
    });
  } catch (error: any) {
    console.error("Error creating call:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create call" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/callers/[callerId]/calls
 *
 * List calls for a caller
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callerId: string }> }
) {
  try {
    const { callerId } = await params;

    const calls = await prisma.call.findMany({
      where: { callerId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            scores: true,
            behaviorMeasurements: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      calls,
      count: calls.length,
    });
  } catch (error: any) {
    console.error("Error listing calls:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to list calls" },
      { status: 500 }
    );
  }
}
