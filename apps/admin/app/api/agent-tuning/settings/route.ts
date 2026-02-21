import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { getAgentTuningSettings } from "@/lib/system-settings";

/**
 * @api GET /api/agent-tuning/settings
 * @visibility internal
 * @scope agent-tuning:read
 * @auth session
 * @tags agent-tuning
 * @description Returns the agent tuning configuration (Boston Matrix definitions,
 *   presets, derivation weights) from SystemSettings. Used by the BostonMatrix
 *   and AgentTuningPanel components to render matrices client-side.
 * @response 200 { ok: true, settings: AgentTuningSettings }
 * @response 500 { ok: false, error: string }
 */
export async function GET() {
  const authResult = await requireAuth("VIEWER");
  if (isAuthError(authResult)) return authResult.error;

  try {
    const settings = await getAgentTuningSettings();
    return NextResponse.json({ ok: true, settings });
  } catch (error: unknown) {
    console.error("[agent-tuning/settings] Failed to load:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to load agent tuning settings." },
      { status: 500 },
    );
  }
}
