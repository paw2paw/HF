import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * POST /api/analysis-specs/[specId]/triggers
 * Add a trigger to a spec (with optional actions)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const { specId } = await params;
    const body = await req.json();
    const { given, when, then, name, notes, actions } = body;

    if (!given || !when || !then) {
      return NextResponse.json(
        { ok: false, error: "given, when, and then are required" },
        { status: 400 }
      );
    }

    // Validate spec exists and check lock
    const spec = await prisma.analysisSpec.findUnique({
      where: { id: specId },
    });

    if (!spec) {
      return NextResponse.json(
        { ok: false, error: "Spec not found" },
        { status: 404 }
      );
    }

    if (spec.isLocked) {
      return NextResponse.json(
        { ok: false, error: "Spec is locked and cannot be modified", locked: true },
        { status: 423 }
      );
    }

    // Validate parameterIds if MEASURE type
    if (spec.outputType === "MEASURE" && actions) {
      const parameterIds = actions.map((a: any) => a.parameterId).filter(Boolean);
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
    const maxOrder = await prisma.analysisTrigger.aggregate({
      where: { specId },
      _max: { sortOrder: true },
    });

    // Create trigger and mark spec as dirty
    const [trigger] = await prisma.$transaction([
      prisma.analysisTrigger.create({
        data: {
          specId,
          given,
          when,
          then,
          name,
          notes,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
          actions: actions
            ? {
                create: actions.map((a: any, aIdx: number) => ({
                  description: a.description,
                  weight: a.weight ?? 1.0,
                  parameterId: a.parameterId || null,
                  learnCategory: a.learnCategory || a.extractCategory || null,
                  learnKeyPrefix: a.learnKeyPrefix || a.extractKeyPrefix || null,
                  learnKeyHint: a.learnKeyHint || a.extractKeyHint || null,
                  sortOrder: aIdx,
                })),
              }
            : undefined,
        },
        include: {
          actions: {
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
      }),
      // Mark spec as dirty if it was compiled
      prisma.analysisSpec.update({
        where: { id: specId },
        data: {
          isDirty: true,
          dirtyReason: "trigger_added",
        },
      }),
    ]);

    return NextResponse.json({ ok: true, trigger });
  } catch (error: any) {
    if (error?.code === "P2003") {
      return NextResponse.json(
        { ok: false, error: "Spec not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create trigger" },
      { status: 500 }
    );
  }
}
