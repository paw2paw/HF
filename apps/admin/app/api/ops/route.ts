import { NextRequest, NextResponse } from "next/server";
import { processTranscripts } from "../../../lib/ops/transcripts-process";

export const runtime = "nodejs";

export async function GET() {
  // Optional: you can return the list by duplicating the OPS keys here,
  // but simplest is to just confirm the endpoint exists.
  return NextResponse.json({ ok: true });
}

/**
 * POST /api/ops
 * Execute operations (ops) for agents
 *
 * Body:
 * {
 *   "opid": "transcripts:process",
 *   "settings": { ... }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { opid, settings = {} } = body;

    console.log(`[ops] Executing operation: ${opid}`);

    // Check if ops are enabled
    const opsEnabled = process.env.HF_OPS_ENABLED === "true";
    if (!opsEnabled) {
      return NextResponse.json(
        { error: "Operations are disabled. Set HF_OPS_ENABLED=true to enable." },
        { status: 403 }
      );
    }

    // Route to appropriate operation handler
    switch (opid) {
      case "transcripts:process": {
        const result = await processTranscripts({
          autoDetectType: settings.autoDetectType ?? true,
          createUsers: settings.createUsers ?? true,
          createBatches: settings.createBatches ?? true,
          filepath: settings.filepath
        });

        return NextResponse.json({
          success: result.success,
          opid,
          result,
          timestamp: new Date().toISOString()
        });
      }

      case "kb:links:extract":
      case "kb:parameters:import":
      case "kb:build+embed":
        return NextResponse.json(
          { error: `Operation ${opid} not yet implemented` },
          { status: 501 }
        );

      default:
        return NextResponse.json(
          { error: `Unknown operation: ${opid}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("[ops] Error:", error);
    return NextResponse.json(
      { error: error.message || "Operation failed" },
      { status: 500 }
    );
  }
}