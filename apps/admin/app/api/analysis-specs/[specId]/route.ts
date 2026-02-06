import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/analysis-specs/[specId]
 * Get a single analysis spec with full nested data
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const { specId } = await params;

    const spec = await prisma.analysisSpec.findFirst({
      where: {
        OR: [{ id: specId }, { slug: specId }],
      },
      include: {
        triggers: {
          orderBy: { sortOrder: "asc" },
          include: {
            actions: {
              orderBy: { sortOrder: "asc" },
              include: {
                parameter: {
                  select: {
                    parameterId: true,
                    name: true,
                    definition: true,
                    scaleType: true,
                    interpretationHigh: true,
                    interpretationLow: true,
                    scoringAnchors: {
                      orderBy: [{ score: "asc" }, { sortOrder: "asc" }],
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Fetch the linked BDDFeatureSet if compiledSetId exists
    let featureSet = null;
    if (spec?.compiledSetId) {
      featureSet = await prisma.bDDFeatureSet.findUnique({
        where: { id: spec.compiledSetId },
        select: {
          id: true,
          featureId: true,
          name: true,
          description: true,
          version: true,
          specType: true,
          rawSpec: true,
          parameters: true,
          constraints: true,
          promptGuidance: true,
          scoringSpec: true,
          definitions: true,
          thresholds: true,
          parameterCount: true,
          constraintCount: true,
          definitionCount: true,
          isActive: true,
          activatedAt: true,
          validations: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    if (!spec) {
      return NextResponse.json(
        { ok: false, error: "Spec not found" },
        { status: 404 }
      );
    }

    // Collect all parameter IDs from actions
    const parameterIds = new Set<string>();
    for (const trigger of spec.triggers) {
      for (const action of trigger.actions) {
        if (action.parameterId) {
          parameterIds.add(action.parameterId);
        }
      }
    }

    // Fetch active behavior targets for these parameters
    const behaviorTargets = parameterIds.size > 0
      ? await prisma.behaviorTarget.findMany({
          where: {
            parameterId: { in: Array.from(parameterIds) },
            effectiveUntil: null, // Only active targets
          },
          orderBy: [{ parameterId: "asc" }, { scope: "asc" }],
          select: {
            id: true,
            parameterId: true,
            scope: true,
            targetValue: true,
            confidence: true,
            source: true,
            playbookId: true,
            playbook: {
              select: { id: true, name: true },
            },
          },
        })
      : [];

    // Group targets by parameterId for easy lookup
    const targetsByParameter = new Map<string, typeof behaviorTargets>();
    for (const target of behaviorTargets) {
      const existing = targetsByParameter.get(target.parameterId) || [];
      existing.push(target);
      targetsByParameter.set(target.parameterId, existing);
    }

    // Enhance spec with behavior targets on each action's parameter
    const enhancedSpec = {
      ...spec,
      triggers: spec.triggers.map((trigger) => ({
        ...trigger,
        actions: trigger.actions.map((action) => ({
          ...action,
          parameter: action.parameter
            ? {
                ...action.parameter,
                behaviorTargets: action.parameterId
                  ? targetsByParameter.get(action.parameterId) || []
                  : [],
              }
            : null,
        })),
      })),
    };

    return NextResponse.json({ ok: true, spec: enhancedSpec, featureSet });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch spec" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/analysis-specs/[specId]
 * Update an analysis spec (metadata only - use nested routes for triggers)
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const { specId } = await params;
    const body = await req.json();
    const { name, description, outputType, scope, domain, priority, isActive, version, forceUnlock } = body;

    // Check if spec is locked
    const existing = await prisma.analysisSpec.findUnique({
      where: { id: specId },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Spec not found" },
        { status: 404 }
      );
    }

    // If locked and not just toggling isActive, block the edit
    if (existing.isLocked && !forceUnlock) {
      // Allow toggling isActive on locked specs (deactivating doesn't change the spec)
      if (isActive !== undefined && name === undefined && description === undefined && outputType === undefined && scope === undefined && domain === undefined && priority === undefined && version === undefined) {
        // Just toggling active status is OK
      } else {
        return NextResponse.json(
          {
            ok: false,
            error: "Spec is locked and cannot be modified",
            locked: true,
            lockedReason: existing.lockedReason,
            usageCount: existing.usageCount,
          },
          { status: 423 }
        );
      }
    }

    // Determine if this is a content change (marks spec as dirty)
    const isContentChange = name !== undefined || description !== undefined ||
                           outputType !== undefined || scope !== undefined ||
                           domain !== undefined || priority !== undefined || version !== undefined;

    // Check if spec was previously compiled (to warn user)
    const wasCompiled = existing.compiledAt !== null && !existing.isDirty;

    // If deactivating a SYSTEM spec, cascade to all PlaybookSystemSpec records
    // TODO: PlaybookSystemSpec model doesn't exist yet - cascade logic disabled
    const affectedPlaybooks: { id: string; name: string }[] = [];

    const spec = await prisma.analysisSpec.update({
      where: { id: specId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(outputType !== undefined && { outputType }),
        ...(scope !== undefined && { scope }),
        ...(domain !== undefined && { domain }),
        ...(priority !== undefined && { priority }),
        ...(isActive !== undefined && { isActive }),
        ...(version !== undefined && { version }),
        // Mark as dirty if content changed
        ...(isContentChange && {
          isDirty: true,
          dirtyReason: "spec_metadata_modified"
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      spec,
      wasCompiled,  // Let UI know if it should show a warning
      // Warn user about affected playbooks when deactivating
      ...(affectedPlaybooks.length > 0 && {
        affectedPlaybooks,
        cascadeWarning: `This spec has been disabled in ${affectedPlaybooks.length} playbook(s)`,
      }),
    });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json(
        { ok: false, error: "Spec not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update spec" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/analysis-specs/[specId]
 * Partial update - specifically for promptTemplate updates
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const { specId } = await params;
    const body = await req.json();
    const { promptTemplate, config, specRole } = body;

    // Check if spec exists and is not locked
    const existing = await prisma.analysisSpec.findUnique({
      where: { id: specId },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Spec not found" },
        { status: 404 }
      );
    }

    if (existing.isLocked) {
      return NextResponse.json(
        {
          ok: false,
          error: "Spec is locked and cannot be modified",
          locked: true,
          lockedReason: existing.lockedReason,
        },
        { status: 423 }
      );
    }

    // Determine what changed for dirty reason
    const changes: string[] = [];
    if (promptTemplate !== undefined) changes.push("prompt_template");
    if (config !== undefined) changes.push("config");
    if (specRole !== undefined) changes.push("spec_role");

    const spec = await prisma.analysisSpec.update({
      where: { id: specId },
      data: {
        ...(promptTemplate !== undefined && { promptTemplate }),
        ...(config !== undefined && { config }),
        ...(specRole !== undefined && { specRole }),
        // Mark as dirty if anything changed
        ...(changes.length > 0 && {
          isDirty: true,
          dirtyReason: changes.join("_") + "_modified",
        }),
      },
    });

    return NextResponse.json({ ok: true, spec });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update spec" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/analysis-specs/[specId]
 * Delete an analysis spec and all nested data (cascades)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const { specId } = await params;

    await prisma.analysisSpec.delete({
      where: { id: specId },
    });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json(
        { ok: false, error: "Spec not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete spec" },
      { status: 500 }
    );
  }
}
