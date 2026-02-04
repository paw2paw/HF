import { NextResponse } from "next/server";
import { runAggregateSpecs } from "@/lib/pipeline/aggregate-runner";

/**
 * POST /api/callers/[callerId]/aggregate
 *
 * Run AGGREGATE specs to compute derived attributes from measurements
 *
 * Flow:
 * 1. Finds all active AGGREGATE specs
 * 2. Reads aggregationRules from spec config
 * 3. Queries recent CallScores for source parameters
 * 4. Applies aggregation logic (thresholds, averages)
 * 5. Updates CallerAttribute (e.g., learner profile)
 *
 * Example: After measuring learning behaviors, run aggregate to update learner profile
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ callerId: string }> }
) {
  try {
    const { callerId } = await params;

    console.log(`[aggregate-api] Running AGGREGATE specs for caller ${callerId}`);

    const results = await runAggregateSpecs(callerId);

    return NextResponse.json({
      ok: true,
      callerId,
      specsRun: results.specsRun,
      profileUpdates: results.profileUpdates,
      errors: results.errors,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("[aggregate-api] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to run aggregate specs",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/callers/[callerId]/aggregate
 *
 * Get status of last aggregation run
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ callerId: string }> }
) {
  try {
    const { callerId } = await params;

    // TODO: Track aggregation runs in a table if needed
    // For now, just return available specs

    const { prisma } = await import("@/lib/prisma");

    const aggregateSpecs = await prisma.analysisSpec.findMany({
      where: {
        outputType: 'AGGREGATE',
        isActive: true,
      },
      select: {
        slug: true,
        name: true,
        description: true,
      },
    });

    return NextResponse.json({
      ok: true,
      callerId,
      availableSpecs: aggregateSpecs,
    });

  } catch (error: any) {
    console.error("[aggregate-api] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to get aggregate specs",
      },
      { status: 500 }
    );
  }
}
