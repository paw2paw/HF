import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/callers/:callerId/calls
 * Create a new call for a caller
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callerId: string }> }
) {
  try {
    const { callerId } = await params;
    const body = await request.json();
    const { source = "ai-simulation", callSequence } = body;

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

    // Determine call sequence
    let sequence = callSequence;
    if (!sequence) {
      const lastCall = await prisma.call.findFirst({
        where: { callerId },
        orderBy: { callSequence: "desc" },
        select: { callSequence: true },
      });
      sequence = (lastCall?.callSequence || 0) + 1;
    }

    // Get previous call ID for linking
    const previousCall = await prisma.call.findFirst({
      where: { callerId },
      orderBy: { callSequence: "desc" },
      select: { id: true },
    });

    // Create the call
    const call = await prisma.call.create({
      data: {
        callerId,
        source,
        callSequence: sequence,
        previousCallId: previousCall?.id || null,
        transcript: "",
        externalId: "ai-sim-" + Date.now().toString(),
      },
    });

    return NextResponse.json({
      ok: true,
      call: {
        id: call.id,
        callSequence: call.callSequence,
        source: call.source,
        createdAt: call.createdAt,
      },
    });
  } catch (error: any) {
    console.error("POST /api/callers/[callerId]/calls error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to create call" },
      { status: 500 }
    );
  }
}
