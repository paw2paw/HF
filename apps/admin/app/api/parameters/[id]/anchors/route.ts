import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireAuth, isAuthError } from "@/lib/permissions";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * @api GET /api/parameters/:id/anchors
 * @visibility public
 * @scope parameters:read
 * @auth session
 * @tags parameters
 * @description Get all scoring anchors for a parameter, ordered by score and sort order
 * @pathParam id string - Parameter UUID or parameterId
 * @response 200 { ok: true, parameter: { id, parameterId, name, scaleType, interpretationHigh, interpretationLow }, anchors: ScoringAnchor[], count: number }
 * @response 404 { ok: false, error: "Parameter not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

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
 * @api POST /api/parameters/:id/anchors
 * @visibility public
 * @scope parameters:write
 * @auth session
 * @tags parameters
 * @description Add a scoring anchor to a parameter
 * @pathParam id string - Parameter UUID or parameterId
 * @body example string - The transcript excerpt or synthetic example (required)
 * @body score number - The calibrated score, typically 0-1 (required)
 * @body rationale string - Why this score
 * @body positiveSignals string[] - What to look for
 * @body negativeSignals string[] - What indicates lower score
 * @body isGold boolean - Is this a canonical example (default: false)
 * @body source string - Where this anchor came from
 * @response 200 { ok: true, anchor: ScoringAnchor }
 * @response 400 { ok: false, error: "example and score are required" }
 * @response 404 { ok: false, error: "Parameter not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

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
 * @api PUT /api/parameters/:id/anchors
 * @visibility public
 * @scope parameters:write
 * @auth session
 * @tags parameters
 * @description Bulk update scoring anchors (reorder or batch edit)
 * @pathParam id string - Parameter UUID or parameterId
 * @body anchors Array - Array of anchor updates: [{id: string, example?, score?, rationale?, positiveSignals?, negativeSignals?, isGold?, sortOrder?}]
 * @response 200 { ok: true, updated: number }
 * @response 400 { ok: false, error: "anchors array required" }
 * @response 500 { ok: false, error: "..." }
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

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
 * @api DELETE /api/parameters/:id/anchors
 * @visibility public
 * @scope parameters:write
 * @auth session
 * @tags parameters
 * @description Delete scoring anchors by IDs
 * @pathParam id string - Parameter UUID or parameterId
 * @body ids string[] - Array of anchor UUIDs to delete
 * @response 200 { ok: true, deleted: number }
 * @response 400 { ok: false, error: "ids array required" }
 * @response 500 { ok: false, error: "..." }
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

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
