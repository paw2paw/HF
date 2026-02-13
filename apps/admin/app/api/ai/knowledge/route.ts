import { NextRequest, NextResponse } from "next/server";
import { exportKnowledge } from "@/lib/ai/knowledge-accumulation";
import { requireAuth, isAuthError } from "@/lib/permissions";

export const runtime = "nodejs";

/**
 * @api GET /api/ai/knowledge
 * @visibility internal
 * @auth session
 * @tags ai
 * @description Export AI learned knowledge (patterns, interaction stats) for the knowledge dashboard
 * @response 200 { ok: true, knowledge: object }
 * @response 500 { ok: false, error: string }
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

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
