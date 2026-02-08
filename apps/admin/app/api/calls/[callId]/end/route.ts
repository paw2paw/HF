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

    // Build base URL from request headers (nextUrl.origin can be unreliable)
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;

    // Internal API secret for server-to-server calls
    const internalSecret = process.env.INTERNAL_API_SECRET || "hf-internal-dev-secret";

    const pipelineRes = await fetch(
      `${baseUrl}/api/calls/${callId}/pipeline`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": internalSecret,
        },
        body: JSON.stringify({
          callerId: call.callerId,
          mode: "prompt",
          engine
        }),
      }
    );

    // Check if pipeline returned HTML (error page) instead of JSON
    const pipelineText = await pipelineRes.text();
    let pipelineData;
    try {
      pipelineData = JSON.parse(pipelineText);
    } catch {
      console.error("Pipeline returned non-JSON:", pipelineText.slice(0, 500));
      return NextResponse.json({
        ok: false,
        error: `Pipeline error (${pipelineRes.status}): ${pipelineText.slice(0, 200)}`,
      });
    }

    if (!pipelineData.ok) {
      return NextResponse.json({
        ok: false,
        error: pipelineData.error || "Pipeline failed",
        pipeline: pipelineData,
      });
    }

    // Pipeline with mode="prompt" already runs COMPOSE stage
    // Get results from pipeline response (no need to call compose-prompt again)
    const pipelineSummary = pipelineData.data || {};

    return NextResponse.json({
      ok: true,
      pipeline: {
        scoresCreated: pipelineSummary.scoresCreated || 0,
        memoriesCreated: pipelineSummary.memoriesCreated || 0,
        measurementsCreated: pipelineSummary.agentMeasurements || 0,
        callTargetsCreated: pipelineSummary.callTargetsCreated || 0,
        playbookUsed: pipelineSummary.playbookUsed || null,
      },
      prompt: pipelineSummary.promptId ? {
        composed: true,
        id: pipelineSummary.promptId,
        length: pipelineSummary.promptLength || 0,
      } : {
        composed: false,
        error: "No prompt generated",
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
