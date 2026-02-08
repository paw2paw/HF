/**
 * POST /api/calls/[callId]/message
 *
 * Append a message to an active call's transcript (auto-save during simulation)
 * TODO: Requires Call.status field in schema
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  return NextResponse.json(
    { ok: false, error: "Call message append not available - schema fields not implemented" },
    { status: 501 }
  );
}
