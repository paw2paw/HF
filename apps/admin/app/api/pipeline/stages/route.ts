import { NextResponse } from "next/server";
import { loadPipelineStages } from "@/lib/pipeline/config";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/pipeline/stages
 * @visibility public
 * @scope pipeline:read
 * @auth session
 * @tags pipeline
 * @description Returns pipeline stage configuration for visualization and documentation.
 *   Loads from PIPELINE-001 spec (or GUARD-001 fallback, or defaults).
 * @response 200 { ok: true, stages: PipelineStage[], count: number }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET() {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const stages = await loadPipelineStages();

    return NextResponse.json({
      ok: true,
      stages,
      count: stages.length,
    });
  } catch (error: any) {
    console.error("Error fetching pipeline stages:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch pipeline stages" },
      { status: 500 }
    );
  }
}
