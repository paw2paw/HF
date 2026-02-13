import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

export const runtime = "nodejs";

/**
 * @api POST /api/analysis-specs/:specId/triggers
 * @visibility internal
 * @scope analysis-specs:write
 * @auth session
 * @tags analysis-specs
 * @description Add a trigger (with optional actions) to a spec. Validates parameter IDs for MEASURE specs. Marks spec as dirty.
 * @pathParam specId string - Spec UUID
 * @body given string - Given condition (required)
 * @body when string - When event (required)
 * @body then string - Then outcome (required)
 * @body name string - Trigger display name
 * @body notes string - Optional notes
 * @body actions Array - Optional actions: [{description, weight?, parameterId?, learnCategory?, learnKeyPrefix?, learnKeyHint?}]
 * @response 200 { ok: true, trigger: AnalysisTrigger }
 * @response 400 { ok: false, error: "given, when, and then are required" }
 * @response 400 { ok: false, error: "Unknown parameter(s): ..." }
 * @response 404 { ok: false, error: "Spec not found" }
 * @response 423 { ok: false, error: "Spec is locked and cannot be modified", locked: true }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

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

/**
 * @api PATCH /api/analysis-specs/:specId/triggers
 * @visibility internal
 * @scope analysis-specs:write
 * @auth session
 * @tags analysis-specs
 * @description Update a trigger's fields and optionally replace its actions. Marks spec as dirty.
 * @pathParam specId string - Spec UUID
 * @body triggerId string - Trigger UUID (required)
 * @body given string - Given condition
 * @body when string - When event
 * @body then string - Then outcome
 * @body name string - Trigger display name
 * @body notes string - Optional notes
 * @body actions Array - If provided, replaces all actions: [{description, weight?, parameterId?, learnCategory?, learnKeyPrefix?, learnKeyHint?}]
 * @response 200 { ok: true, trigger: AnalysisTrigger }
 * @response 400 { ok: false, error: "triggerId is required" }
 * @response 404 { ok: false, error: "Trigger not found or does not belong to this spec" }
 * @response 423 { ok: false, error: "Spec is locked and cannot be modified", locked: true }
 * @response 500 { ok: false, error: "..." }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { specId } = await params;
    const body = await req.json();
    const { triggerId, given, when, then: thenVal, name, notes, actions } = body;

    if (!triggerId) {
      return NextResponse.json(
        { ok: false, error: "triggerId is required" },
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

    // Validate trigger belongs to this spec
    const existing = await prisma.analysisTrigger.findFirst({
      where: { id: triggerId, specId },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Trigger not found or does not belong to this spec" },
        { status: 404 }
      );
    }

    // Validate parameterIds if MEASURE type and actions provided
    if (spec.outputType === "MEASURE" && actions) {
      const parameterIds = actions.map((a: any) => a.parameterId).filter(Boolean);
      if (parameterIds.length > 0) {
        const existingParams = await prisma.parameter.findMany({
          where: { parameterId: { in: parameterIds } },
          select: { parameterId: true },
        });
        const existingIds = new Set(existingParams.map((p: any) => p.parameterId));
        const missing = parameterIds.filter((id: string) => !existingIds.has(id));
        if (missing.length > 0) {
          return NextResponse.json(
            { ok: false, error: `Unknown parameter(s): ${missing.join(", ")}` },
            { status: 400 }
          );
        }
      }
    }

    // Build update data for trigger fields
    const updateData: any = {};
    if (given !== undefined) updateData.given = given;
    if (when !== undefined) updateData.when = when;
    if (thenVal !== undefined) updateData.then = thenVal;
    if (name !== undefined) updateData.name = name;
    if (notes !== undefined) updateData.notes = notes;

    // If actions provided, delete existing and recreate
    const operations: any[] = [];

    if (actions) {
      operations.push(
        prisma.analysisAction.deleteMany({ where: { triggerId } })
      );
    }

    operations.push(
      prisma.analysisTrigger.update({
        where: { id: triggerId },
        data: {
          ...updateData,
          ...(actions
            ? {
                actions: {
                  create: actions.map((a: any, aIdx: number) => ({
                    description: a.description,
                    weight: a.weight ?? 1.0,
                    parameterId: a.parameterId || null,
                    learnCategory: a.learnCategory || null,
                    learnKeyPrefix: a.learnKeyPrefix || null,
                    learnKeyHint: a.learnKeyHint || null,
                    sortOrder: aIdx,
                  })),
                },
              }
            : {}),
        },
        include: {
          actions: {
            orderBy: { sortOrder: "asc" },
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
      })
    );

    operations.push(
      prisma.analysisSpec.update({
        where: { id: specId },
        data: {
          isDirty: true,
          dirtyReason: "trigger_updated",
        },
      })
    );

    const results = await prisma.$transaction(operations);
    // The trigger is the second-to-last result (before spec update) if actions replaced,
    // or the first result (before spec update) if no actions replaced
    const trigger = actions ? results[1] : results[0];

    return NextResponse.json({ ok: true, trigger });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update trigger" },
      { status: 500 }
    );
  }
}

/**
 * @api DELETE /api/analysis-specs/:specId/triggers
 * @visibility internal
 * @scope analysis-specs:write
 * @auth session
 * @tags analysis-specs
 * @description Delete a trigger and its actions from a spec. Marks spec as dirty.
 * @pathParam specId string - Spec UUID
 * @body triggerId string - Trigger UUID (required)
 * @response 200 { ok: true }
 * @response 400 { ok: false, error: "triggerId is required" }
 * @response 404 { ok: false, error: "Trigger not found or does not belong to this spec" }
 * @response 423 { ok: false, error: "Spec is locked and cannot be modified", locked: true }
 * @response 500 { ok: false, error: "..." }
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { specId } = await params;
    const body = await req.json();
    const { triggerId } = body;

    if (!triggerId) {
      return NextResponse.json(
        { ok: false, error: "triggerId is required" },
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

    // Validate trigger belongs to this spec
    const existing = await prisma.analysisTrigger.findFirst({
      where: { id: triggerId, specId },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Trigger not found or does not belong to this spec" },
        { status: 404 }
      );
    }

    // Delete trigger (actions cascade) and mark spec dirty
    await prisma.$transaction([
      prisma.analysisTrigger.delete({ where: { id: triggerId } }),
      prisma.analysisSpec.update({
        where: { id: specId },
        data: {
          isDirty: true,
          dirtyReason: "trigger_deleted",
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete trigger" },
      { status: 500 }
    );
  }
}
