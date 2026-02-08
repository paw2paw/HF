import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * POST /api/bdd-features/[featureId]/scenarios
 * Add a scenario to a feature (with criteria linking to Parameters)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    const { featureId } = await params;
    const body = await req.json();
    const { given, when, then, name, notes, criteria } = body;

    if (!given || !when || !then) {
      return NextResponse.json(
        { ok: false, error: "given, when, and then are required" },
        { status: 400 }
      );
    }

    // Validate all parameterIds exist
    if (criteria) {
      const parameterIds = criteria.map((c: any) => c.parameterId).filter(Boolean);
      if (parameterIds.length > 0) {
        const existingParams = await prisma.parameter.findMany({
          where: { parameterId: { in: parameterIds } },
          select: { parameterId: true },
        });
        const existingIds = new Set(existingParams.map((p) => p.parameterId));
        const missing = parameterIds.filter((id: string) => !existingIds.has(id));
        if (missing.length > 0) {
          return NextResponse.json(
            { ok: false, error: `Unknown parameter(s): ${missing.join(", ")}` },
            { status: 400 }
          );
        }
      }
    }

    // Get current max sortOrder
    const maxOrder = await prisma.bddScenario.aggregate({
      where: { featureId },
      _max: { sortOrder: true },
    });

    const scenario = await prisma.bddScenario.create({
      data: {
        featureId,
        given,
        when,
        then,
        name,
        notes,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        criteria: criteria
          ? {
              create: criteria.map((c: any, cIdx: number) => ({
                description: c.description,
                weight: c.weight ?? 1.0,
                parameterId: c.parameterId,
                sortOrder: cIdx,
              })),
            }
          : undefined,
      },
      include: {
        criteria: {
          include: {
            parameter: {
              select: {
                parameterId: true,
                name: true,
                scaleType: true,
                scoringAnchors: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ ok: true, scenario });
  } catch (error: any) {
    if (error?.code === "P2003") {
      return NextResponse.json(
        { ok: false, error: "Feature not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create scenario" },
      { status: 500 }
    );
  }
}
