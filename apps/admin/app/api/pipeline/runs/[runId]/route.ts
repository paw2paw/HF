/**
 * Single Pipeline Run API
 *
 * GET /api/pipeline/runs/[runId] - Get full details for a pipeline run
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  try {
    const run = await prisma.pipelineRun.findUnique({
      where: { id: runId },
      include: {
        steps: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!run) {
      return NextResponse.json(
        { ok: false, error: "Pipeline run not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      run,
    });
  } catch (error) {
    console.error("Failed to fetch pipeline run:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch pipeline run" },
      { status: 500 }
    );
  }
}
