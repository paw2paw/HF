import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * GET /api/compiled-sets/[id]
 * Get a single compiled set with full details
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const compiledSet = await prisma.compiledAnalysisSet.findUnique({
      where: { id },
      include: {
        analysisProfile: {
          select: {
            id: true,
            name: true,
            description: true,
            isLocked: true,
            usageCount: true,
            lockedAt: true,
            lockedReason: true,
          },
        },
        parentVersion: {
          select: {
            id: true,
            name: true,
            version: true,
          },
        },
        childVersions: {
          select: {
            id: true,
            name: true,
            version: true,
            status: true,
          },
        },
        _count: {
          select: { runs: true },
        },
      },
    });

    if (!compiledSet) {
      return NextResponse.json(
        { ok: false, error: "Compiled set not found" },
        { status: 404 }
      );
    }

    // Load the specs included in this set
    const specs = await prisma.analysisSpec.findMany({
      where: { id: { in: compiledSet.specIds } },
      include: {
        triggers: {
          include: {
            actions: {
              include: {
                parameter: {
                  select: {
                    parameterId: true,
                    name: true,
                    enrichedHigh: true,
                    enrichedLow: true,
                    enrichedAt: true,
                    scoringAnchors: {
                      select: { id: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Compute parameter summary
    const measureSpecs = specs.filter(s => s.outputType === "MEASURE");
    const learnSpecs = specs.filter(s => s.outputType === "LEARN");

    const parameterMap = new Map<string, {
      parameterId: string;
      name: string;
      isEnriched: boolean;
      anchorCount: number;
      specCount: number;
    }>();

    for (const spec of measureSpecs) {
      for (const trigger of spec.triggers) {
        for (const action of trigger.actions) {
          if (action.parameter) {
            const existing = parameterMap.get(action.parameter.parameterId);
            if (existing) {
              existing.specCount++;
            } else {
              parameterMap.set(action.parameter.parameterId, {
                parameterId: action.parameter.parameterId,
                name: action.parameter.name,
                isEnriched: !!action.parameter.enrichedAt,
                anchorCount: action.parameter.scoringAnchors?.length || 0,
                specCount: 1,
              });
            }
          }
        }
      }
    }

    const parameters = Array.from(parameterMap.values());

    // Build actions list (AC-1, AC-2, etc.) for display
    const actions: {
      id: string;
      code: string;
      specName: string;
      specId: string;
      triggerName: string | null;
      description: string;
      parameterId: string | null;
      parameterName: string | null;
      anchorCount: number;
      isEnriched: boolean;
    }[] = [];

    let actionIndex = 1;
    for (const spec of measureSpecs) {
      for (const trigger of spec.triggers) {
        for (const action of trigger.actions) {
          actions.push({
            id: action.id,
            code: `AC-${actionIndex}`,
            specName: spec.name,
            specId: spec.id,
            triggerName: trigger.name,
            description: action.description,
            parameterId: action.parameter?.parameterId || null,
            parameterName: action.parameter?.name || null,
            anchorCount: action.parameter?.scoringAnchors?.length || 0,
            isEnriched: !!action.parameter?.enrichedAt,
          });
          actionIndex++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      compiledSet: {
        ...compiledSet,
        runCount: compiledSet._count.runs,
        _count: undefined,
      },
      specs: {
        measure: measureSpecs.map(s => ({
          id: s.id,
          slug: s.slug,
          name: s.name,
          domain: s.domain,
          triggerCount: s.triggers.length,
        })),
        learn: learnSpecs.map(s => ({
          id: s.id,
          slug: s.slug,
          name: s.name,
          domain: s.domain,
          triggerCount: s.triggers.length,
        })),
      },
      actions,
      parameters,
      summary: {
        measureSpecCount: measureSpecs.length,
        learnSpecCount: learnSpecs.length,
        actionCount: actions.length,
        parameterCount: parameters.length,
        enrichedParameterCount: parameters.filter(p => p.isEnriched).length,
        totalAnchors: parameters.reduce((sum, p) => sum + p.anchorCount, 0),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch compiled set" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/compiled-sets/[id]
 * Update compiled set metadata (only in DRAFT status)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, description, specIds } = body;

    const existing = await prisma.compiledAnalysisSet.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Compiled set not found" },
        { status: 404 }
      );
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { ok: false, error: `Cannot modify compiled set in ${existing.status} status` },
        { status: 400 }
      );
    }

    const compiledSet = await prisma.compiledAnalysisSet.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(specIds && { specIds }),
      },
    });

    return NextResponse.json({ ok: true, compiledSet });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update compiled set" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/compiled-sets/[id]
 * Delete a compiled set (only if no runs)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.compiledAnalysisSet.findUnique({
      where: { id },
      include: {
        _count: { select: { runs: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Compiled set not found" },
        { status: 404 }
      );
    }

    if (existing._count.runs > 0) {
      return NextResponse.json(
        { ok: false, error: `Cannot delete compiled set with ${existing._count.runs} runs. Mark as SUPERSEDED instead.` },
        { status: 400 }
      );
    }

    await prisma.compiledAnalysisSet.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete compiled set" },
      { status: 500 }
    );
  }
}
