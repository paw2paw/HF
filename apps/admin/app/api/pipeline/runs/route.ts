/**
 * Pipeline Runs API
 *
 * GET /api/pipeline/runs - List pipeline runs with filters
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PipelinePhase } from "@prisma/client";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const callerId = searchParams.get("callerId");
  const callId = searchParams.get("callId");
  const phase = searchParams.get("phase") as PipelinePhase | null;
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  try {
    const where = {
      ...(callerId && { callerId }),
      ...(callId && { callId }),
      ...(phase && { phase }),
      ...(status && { status: status as any }),
    };

    const [runs, total] = await Promise.all([
      prisma.pipelineRun.findMany({
        where,
        include: {
          steps: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              operation: true,
              label: true,
              status: true,
              durationMs: true,
              specSlug: true,
              outputCounts: true,
              error: true,
              sectionsActivated: true,
              sectionsSkipped: true,
            },
          },
        },
        orderBy: { startedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.pipelineRun.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      runs,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Failed to fetch pipeline runs:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch pipeline runs" },
      { status: 500 }
    );
  }
}
