import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/playbooks/[playbookId]/targets
 *
 * Returns ALL adjustable BEHAVIOR parameters with their cascade of targets:
 * - System targets (base layer)
 * - Playbook targets (overrides system)
 * - Caller targets not returned here (computed at runtime per caller)
 *
 * The UI shows behavior dimension cards with sliders.
 *
 * NEW ARCHITECTURE: Behavior dimensions exist globally (not tied to specs).
 * Every playbook can configure targets for any BEHAVIOR parameter.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playbookId: string }> }
) {
  try {
    const { playbookId } = await params;

    // Get playbook with its targets
    const playbook = await prisma.playbook.findUnique({
      where: { id: playbookId },
      include: {
        domain: { select: { id: true, slug: true, name: true } },
        behaviorTargets: {
          where: { scope: "PLAYBOOK", effectiveUntil: null },
        },
      },
    });

    if (!playbook) {
      return NextResponse.json(
        { ok: false, error: "Playbook not found" },
        { status: 404 }
      );
    }

    // Get ALL adjustable BEHAVIOR parameters (not just from specs)
    const allBehaviorParams = await prisma.parameter.findMany({
      where: {
        parameterType: "BEHAVIOR",
        isAdjustable: true,
      },
      select: {
        id: true,
        parameterId: true,
        name: true,
        definition: true,
        domainGroup: true,
      },
      orderBy: [
        { domainGroup: "asc" },
        { name: "asc" },
      ],
    });

    // Get SYSTEM-level targets for all behavior parameters
    const systemTargets = await prisma.behaviorTarget.findMany({
      where: {
        scope: "SYSTEM",
        parameterId: { in: allBehaviorParams.map(p => p.parameterId) },
        effectiveUntil: null,
      },
    });

    // Build target lookup maps
    const systemTargetMap = new Map(systemTargets.map(t => [t.parameterId, t]));
    const playbookTargetMap = new Map(playbook.behaviorTargets.map(t => [t.parameterId, t]));

    // Build response with cascade - all behavior parameters
    const parameters = allBehaviorParams.map(param => {
      const systemTarget = systemTargetMap.get(param.parameterId);
      const playbookTarget = playbookTargetMap.get(param.parameterId);

      // Effective = playbook overrides system
      const effectiveValue = playbookTarget?.targetValue ?? systemTarget?.targetValue ?? 0.5;
      const effectiveScope = playbookTarget ? "PLAYBOOK" : (systemTarget ? "SYSTEM" : "DEFAULT");

      return {
        parameterId: param.parameterId,
        name: param.name,
        definition: param.definition,
        domainGroup: param.domainGroup,

        // Cascade values
        systemValue: systemTarget?.targetValue ?? null,
        systemSource: systemTarget?.source ?? null,

        playbookValue: playbookTarget?.targetValue ?? null,
        playbookTargetId: playbookTarget?.id ?? null,

        // Computed effective
        effectiveValue,
        effectiveScope,
      };
    });

    return NextResponse.json({
      ok: true,
      playbookId,
      playbookName: playbook.name,
      playbookStatus: playbook.status,
      parameters,
      counts: {
        total: parameters.length,
        withPlaybookOverride: parameters.filter(p => p.playbookValue !== null).length,
        withSystemDefault: parameters.filter(p => p.systemValue !== null).length,
      },
    });
  } catch (error: any) {
    console.error("Error fetching playbook targets:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch playbook targets" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/playbooks/[playbookId]/targets
 *
 * Update playbook-level behavior targets.
 * Body: { targets: [{ parameterId, targetValue }] }
 *
 * If targetValue is null, removes the playbook override (falls back to system).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ playbookId: string }> }
) {
  try {
    const { playbookId } = await params;
    const body = await request.json();
    const { targets } = body;

    if (!Array.isArray(targets)) {
      return NextResponse.json(
        { ok: false, error: "targets must be an array" },
        { status: 400 }
      );
    }

    // Verify playbook exists and is editable
    const playbook = await prisma.playbook.findUnique({
      where: { id: playbookId },
    });

    if (!playbook) {
      return NextResponse.json(
        { ok: false, error: "Playbook not found" },
        { status: 404 }
      );
    }

    if (playbook.status === "PUBLISHED") {
      return NextResponse.json(
        { ok: false, error: "Cannot modify targets for a published playbook" },
        { status: 400 }
      );
    }

    // Process each target update
    const results = [];
    for (const { parameterId, targetValue } of targets) {
      if (!parameterId) continue;

      // Find existing playbook target
      const existing = await prisma.behaviorTarget.findFirst({
        where: {
          parameterId,
          playbookId,
          scope: "PLAYBOOK",
          effectiveUntil: null,
        },
      });

      if (targetValue === null) {
        // Remove override - delete playbook target
        if (existing) {
          await prisma.behaviorTarget.delete({
            where: { id: existing.id },
          });
          results.push({ parameterId, action: "removed" });
        }
      } else if (typeof targetValue === "number") {
        // Set/update override
        const value = Math.max(0, Math.min(1, targetValue)); // Clamp to 0-1

        if (existing) {
          await prisma.behaviorTarget.update({
            where: { id: existing.id },
            data: {
              targetValue: value,
              source: "MANUAL",
              updatedAt: new Date(),
            },
          });
          results.push({ parameterId, action: "updated", value });
        } else {
          await prisma.behaviorTarget.create({
            data: {
              parameterId,
              playbookId,
              scope: "PLAYBOOK",
              targetValue: value,
              confidence: 1.0,
              source: "MANUAL",
            },
          });
          results.push({ parameterId, action: "created", value });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      results,
      message: `Updated ${results.length} targets`,
    });
  } catch (error: any) {
    console.error("Error updating playbook targets:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update playbook targets" },
      { status: 500 }
    );
  }
}
