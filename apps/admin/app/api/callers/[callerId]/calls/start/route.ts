/**
 * POST /api/callers/[callerId]/calls/start
 *
 * Start a new simulated call for a caller.
 * TODO: Requires Call.status and Call.startedAt fields in schema
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callerId: string }> }
) {
  return NextResponse.json(
    { ok: false, error: "Call simulation not available - schema fields not implemented" },
    { status: 501 }
  );
}
