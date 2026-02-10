import { NextRequest, NextResponse } from "next/server";
import { exportKnowledge } from "@/lib/ai/knowledge-accumulation";

export const runtime = "nodejs";

/**
 * GET /api/ai/knowledge - Export AI knowledge for dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const knowledge = await exportKnowledge();

    return NextResponse.json({
      ok: true,
      knowledge,
    });
  } catch (error) {
    console.error("Export knowledge error:", error);
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
