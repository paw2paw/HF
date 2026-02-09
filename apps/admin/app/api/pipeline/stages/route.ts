import { NextResponse } from "next/server";
import { loadPipelineStages } from "@/lib/pipeline/config";

/**
 * GET /api/pipeline/stages
 *
 * Returns pipeline stage configuration for visualization and documentation.
 * Loads from PIPELINE-001 spec (or GUARD-001 fallback, or defaults).
 */
export async function GET() {
  try {
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
