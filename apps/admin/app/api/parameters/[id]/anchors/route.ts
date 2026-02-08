import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * GET /api/parameters/[id]/anchors
 * Get all scoring anchors for a parameter
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Find parameter by id or parameterId
    const parameter = await prisma.parameter.findFirst({
      where: {
        OR: [{ id }, { parameterId: id }],
      },
      select: {
        id: true,
        parameterId: true,
        name: true,
        scaleType: true,
        interpretationHigh: true,
        interpretationLow: true,
        scoringAnchors: {
          orderBy: [{ score: "asc" }, { sortOrder: "asc" }],
        },
      },
    });

    if (!parameter) {
      return NextResponse.json(
        { ok: false, error: "Parameter not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      parameter: {
        id: parameter.id,
        parameterId: parameter.parameterId,
        name: parameter.name,
        scaleType: parameter.scaleType,
        interpretationHigh: parameter.interpretationHigh,
        interpretationLow: parameter.interpretationLow,
      },
      anchors: parameter.scoringAnchors,
      count: parameter.scoringAnchors.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch anchors" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/parameters/[id]/anchors
 * Add a scoring anchor to a parameter
 * Body: {
 *   example: string,      // The transcript excerpt or synthetic example
 *   score: number,        // The calibrated score (0-1 typically)
 *   rationale?: string,   // Why this score?
 *   positiveSignals?: string[],  // What to look for
 *   negativeSignals?: string[],  // What indicates lower score
 *   isGold?: boolean,     // Is this a canonical example?
 *   source?: string       // Where did this come from?
 * }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      example,
      score,
      rationale,
      positiveSignals,
      negativeSignals,
      isGold,
      source,
    } = body;

    if (!example || score === undefined) {
      return NextResponse.json(
        { ok: false, error: "example and score are required" },
        { status: 400 }
      );
    }

    // Find parameter by id or parameterId
    const parameter = await prisma.parameter.findFirst({
      where: {
        OR: [{ id }, { parameterId: id }],
      },
    });

    if (!parameter) {
      return NextResponse.json(
        { ok: false, error: "Parameter not found" },
        { status: 404 }
      );
    }

    // Get current max sortOrder
    const maxOrder = await prisma.parameterScoringAnchor.aggregate({
      where: { parameterId: parameter.parameterId },
      _max: { sortOrder: true },
    });

    const anchor = await prisma.parameterScoringAnchor.create({
      data: {
        parameterId: parameter.parameterId,
        example,
        score,
        rationale,
        positiveSignals: positiveSignals ?? [],
        negativeSignals: negativeSignals ?? [],
        isGold: isGold ?? false,
        source,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json({ ok: true, anchor });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create anchor" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/parameters/[id]/anchors
 * Bulk update anchors (for reordering or batch editing)
 * Body: { anchors: Array<{ id: string, ...updates }> }
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json();
    const { anchors } = body;

    if (!anchors || !Array.isArray(anchors)) {
      return NextResponse.json(
        { ok: false, error: "anchors array required" },
        { status: 400 }
      );
    }

    // Update each anchor
    const updates = await Promise.all(
      anchors.map((a: any) =>
        prisma.parameterScoringAnchor.update({
          where: { id: a.id },
          data: {
            ...(a.example !== undefined && { example: a.example }),
            ...(a.score !== undefined && { score: a.score }),
            ...(a.rationale !== undefined && { rationale: a.rationale }),
            ...(a.positiveSignals !== undefined && {
              positiveSignals: a.positiveSignals,
            }),
            ...(a.negativeSignals !== undefined && {
              negativeSignals: a.negativeSignals,
            }),
            ...(a.isGold !== undefined && { isGold: a.isGold }),
            ...(a.sortOrder !== undefined && { sortOrder: a.sortOrder }),
          },
        })
      )
    );

    return NextResponse.json({ ok: true, updated: updates.length });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update anchors" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/parameters/[id]/anchors
 * Delete anchors by IDs
 * Body: { ids: string[] }
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { ok: false, error: "ids array required" },
        { status: 400 }
      );
    }

    const result = await prisma.parameterScoringAnchor.deleteMany({
      where: { id: { in: ids } },
    });

    return NextResponse.json({ ok: true, deleted: result.count });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete anchors" },
      { status: 500 }
    );
  }
}
