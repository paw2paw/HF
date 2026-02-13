import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api POST /api/playbooks/:playbookId/new-version
 * @visibility internal
 * @scope playbooks:write
 * @auth session
 * @tags playbooks
 * @description Clones a published playbook as a new DRAFT version. Copies all items and
 *   PLAYBOOK-scope behavior targets, increments the version, and links to parent for
 *   provenance. The original PUBLISHED playbook remains unchanged.
 * @pathParam playbookId string - Source playbook UUID (must be PUBLISHED)
 * @response 200 { ok: true, playbook: Playbook, message: "...", copiedItems: number, copiedTargets: number }
 * @response 400 { ok: false, error: "Can only create new version from a PUBLISHED playbook" }
 * @response 404 { ok: false, error: "Playbook not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ playbookId: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { playbookId } = await params;

    // Get the source playbook with all related data
    const sourcePlaybook = await prisma.playbook.findUnique({
      where: { id: playbookId },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
        },
        behaviorTargets: {
          where: { scope: "PLAYBOOK", effectiveUntil: null },
        },
      },
    });

    if (!sourcePlaybook) {
      return NextResponse.json(
        { ok: false, error: "Playbook not found" },
        { status: 404 }
      );
    }

    if (sourcePlaybook.status !== "PUBLISHED") {
      return NextResponse.json(
        { ok: false, error: "Can only create new version from a PUBLISHED playbook" },
        { status: 400 }
      );
    }

    // Increment version
    const currentVersion = sourcePlaybook.version || "1.0";
    const versionParts = currentVersion.split(".");
    const major = parseInt(versionParts[0]) || 1;
    const minor = parseInt(versionParts[1]) || 0;
    const newVersion = `${major}.${minor + 1}`;

    // Create the new draft playbook (domain NOT copied by default)
    const newPlaybook = await prisma.playbook.create({
      data: {
        name: `${sourcePlaybook.name} (Clone)`,
        description: sourcePlaybook.description,
        domainId: sourcePlaybook.domainId,
        status: "DRAFT",
        version: newVersion,
        parentVersionId: sourcePlaybook.id,
        // Copy stats (will be recalculated on publish)
        measureSpecCount: sourcePlaybook.measureSpecCount,
        learnSpecCount: sourcePlaybook.learnSpecCount,
        adaptSpecCount: sourcePlaybook.adaptSpecCount,
        parameterCount: sourcePlaybook.parameterCount,
      },
    });

    // Copy items
    if (sourcePlaybook.items.length > 0) {
      await prisma.playbookItem.createMany({
        data: sourcePlaybook.items.map((item, idx) => ({
          playbookId: newPlaybook.id,
          itemType: item.itemType,
          specId: item.specId,
          promptTemplateId: item.promptTemplateId,
          isEnabled: item.isEnabled,
          sortOrder: idx,
        })),
      });
    }

    // Copy behavior targets
    if (sourcePlaybook.behaviorTargets.length > 0) {
      await prisma.behaviorTarget.createMany({
        data: sourcePlaybook.behaviorTargets.map((target) => ({
          parameterId: target.parameterId,
          playbookId: newPlaybook.id,
          scope: "PLAYBOOK",
          targetValue: target.targetValue,
          confidence: target.confidence,
          source: "MANUAL",
        })),
      });
    }

    // Fetch the complete new playbook
    const created = await prisma.playbook.findUnique({
      where: { id: newPlaybook.id },
      include: {
        domain: {
          select: { id: true, slug: true, name: true },
        },
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            spec: {
              select: {
                id: true,
                slug: true,
                name: true,
                scope: true,
                outputType: true,
              },
            },
            promptTemplate: {
              select: {
                id: true,
                slug: true,
                name: true,
              },
            },
          },
        },
        parentVersion: {
          select: {
            id: true,
            name: true,
            version: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      playbook: created,
      message: `Cloned "${sourcePlaybook.name}" as draft v${newVersion}`,
      copiedItems: sourcePlaybook.items.length,
      copiedTargets: sourcePlaybook.behaviorTargets.length,
    });
  } catch (error: any) {
    console.error("Error creating new playbook version:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create new version" },
      { status: 500 }
    );
  }
}
