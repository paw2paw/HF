import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/calls/:callId/end
 * End a call - run full pipeline and compose next prompt
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await params;
    const body = await request.json();
    const { engine = "claude" } = body;

    // Get the call
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: { caller: true },
    });

    if (!call) {
      return NextResponse.json(
        { ok: false, error: "Call not found" },
        { status: 404 }
      );
    }

    // Run the pipeline with callerId and mode
    const pipelineRes = await fetch(
      `${request.nextUrl.origin}/api/calls/${callId}/pipeline`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callerId: call.callerId,
          mode: "prompt",
          engine
        }),
      }
    );

    const pipelineData = await pipelineRes.json();

    if (!pipelineData.ok) {
      return NextResponse.json({
        ok: false,
        error: pipelineData.error || "Pipeline failed",
        pipeline: pipelineData,
      });
    }

    // Compose the next prompt for this caller
    const composeRes = await fetch(
      `${request.nextUrl.origin}/api/callers/${call.callerId}/compose-prompt`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );

    const composeData = await composeRes.json();

    return NextResponse.json({
      ok: true,
      pipeline: {
        scoresCreated: pipelineData.scoresCreated || 0,
        memoriesCreated: pipelineData.memoriesCreated || 0,
        measurementsCreated: pipelineData.measurementsCreated || 0,
      },
      prompt: composeData.ok ? {
        composed: true,
        slug: composeData.slug,
        composedAt: composeData.composedAt,
      } : {
        composed: false,
        error: composeData.error,
      },
    });
  } catch (error: any) {
    console.error("POST /api/calls/[callId]/end error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to end call" },
      { status: 500 }
    );
  }
}
