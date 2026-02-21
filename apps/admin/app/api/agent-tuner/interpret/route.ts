import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { interpretIntent } from "@/lib/agent-tuner/interpret";
import type { InterpretRequest } from "@/lib/agent-tuner/types";

/**
 * @api POST /api/agent-tuner/interpret
 * @visibility internal
 * @scope agent-tuner:write
 * @auth session
 * @tags agent-tuner, ai
 * @description Translates natural language intent into behavior pills.
 *   Each pill maps to multiple underlying BEHAVIOR parameters.
 *   Used by the AgentTuner component across wizards.
 *
 * @body intent string - Natural language style description (min 3 chars)
 * @body context? object - Optional context { personaSlug?, subjectName?, domainName? }
 * @response 200 { ok: true, pills: AgentTunerPill[], interpretation: string }
 * @response 400 { ok: false, error: string }
 * @response 500 { ok: false, error: string }
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;

  try {
    const body: InterpretRequest = await request.json();
    const result = await interpretIntent(body);

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[agent-tuner/interpret] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to interpret behavior intent." },
      { status: 500 },
    );
  }
}
