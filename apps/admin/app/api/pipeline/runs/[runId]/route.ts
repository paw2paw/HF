/**
 * Single Pipeline Run API
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/pipeline/runs/:runId
 * @visibility public
 * @scope pipeline:read
 * @auth session
 * @tags pipeline
 * @description Get full details for a single pipeline run including all steps
 * @pathParam runId string - Pipeline run UUID
 * @response 200 { ok: true, run: PipelineRun }
 * @response 404 { ok: false, error: "Pipeline run not found" }
 * @response 500 { ok: false, error: "Failed to fetch pipeline run" }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const authResult = await requireAuth("VIEWER");
  if (isAuthError(authResult)) return authResult.error;

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
