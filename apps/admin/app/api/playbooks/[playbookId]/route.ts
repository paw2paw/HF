import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Extract systemSpecs toggle state from playbook.config and attach to response.
 * Stored in config.systemSpecToggles as { [specId]: { isEnabled, configOverride } }
 */
function withSystemSpecs(playbook: any) {
  const config = (playbook.config as Record<string, any>) || {};
  const toggles = config.systemSpecToggles || {};
  const systemSpecs = Object.entries(toggles).map(([specId, data]: [string, any]) => ({
    specId,
    isEnabled: data.isEnabled ?? true,
    configOverride: data.configOverride || null,
  }));
  return { ...playbook, systemSpecs };
}

/**
 * GET /api/playbooks/[playbookId]
 * Get playbook details with all items
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playbookId: string }> }
) {
  try {
    const { playbookId } = await params;

    const playbook = await prisma.playbook.findUnique({
      where: { id: playbookId },
      include: {
        domain: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
        // agent: removed - FK relation deprecated, agentId is now just a string reference
        // curriculum: removed - FK relation no longer exists on Playbook model
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            spec: {
              select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                scope: true,
                outputType: true,
                specType: true,
                specRole: true,
                config: true,
                domain: true,
                priority: true,
                isActive: true,
                _count: {
                  select: { triggers: true },
                },
              },
            },
            promptTemplate: {
              select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                isActive: true,
              },
            },
          },
        },
        // systemSpecs are derived from config.systemSpecToggles via withSystemSpecs()
        parentVersion: {
          select: {
            id: true,
            name: true,
            version: true,
          },
        },
        _count: {
          select: { items: true },
        },
      },
    });

    if (!playbook) {
      return NextResponse.json(
        { ok: false, error: "Playbook not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      playbook: withSystemSpecs(playbook),
    });
  } catch (error: any) {
    console.error("Error fetching playbook:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch playbook" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/playbooks/[playbookId]
 * Update playbook metadata or items
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ playbookId: string }> }
) {
  try {
    const { playbookId } = await params;
    const body = await request.json();
    const { name, description, items, specs, agentId, toggleSpec } = body;

    const existing = await prisma.playbook.findUnique({
      where: { id: playbookId },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Playbook not found" },
        { status: 404 }
      );
    }

    // For published playbooks, only allow system spec toggle updates
    const isToggleOnlyUpdate = (specs !== undefined || toggleSpec !== undefined) &&
      name === undefined && description === undefined &&
      items === undefined && agentId === undefined;

    if (existing.status === "PUBLISHED" && !isToggleOnlyUpdate) {
      return NextResponse.json(
        { ok: false, error: "Cannot modify a published playbook. Create a new version instead." },
        { status: 400 }
      );
    }

    // Handle convenience toggleSpec format from Studio: { specId, enabled }
    // This auto-detects if spec is SYSTEM or DOMAIN and updates accordingly
    if (toggleSpec) {
      const { specId, enabled } = toggleSpec;

      // Find the spec to determine its scope
      const spec = await prisma.analysisSpec.findUnique({
        where: { id: specId },
        select: { id: true, scope: true },
      });

      if (!spec) {
        return NextResponse.json(
          { ok: false, error: "Spec not found" },
          { status: 404 }
        );
      }

      if (spec.scope === "SYSTEM") {
        // Save single system spec toggle to config.systemSpecToggles
        const currentConfig = (existing.config as Record<string, any>) || {};
        const toggles = currentConfig.systemSpecToggles || {};
        toggles[specId] = {
          isEnabled: enabled,
          configOverride: toggles[specId]?.configOverride || null,
        };
        await prisma.playbook.update({
          where: { id: playbookId },
          data: {
            config: { ...currentConfig, systemSpecToggles: toggles },
          },
        });
      } else {
        // Toggle domain spec via PlaybookItem
        const existingItem = await prisma.playbookItem.findFirst({
          where: { playbookId, specId },
        });

        if (existingItem) {
          // Update existing item
          await prisma.playbookItem.update({
            where: { id: existingItem.id },
            data: { isEnabled: enabled },
          });
        } else if (enabled) {
          // Create new item (only if enabling)
          const maxOrder = await prisma.playbookItem.aggregate({
            where: { playbookId },
            _max: { sortOrder: true },
          });
          await prisma.playbookItem.create({
            data: {
              playbookId,
              specId,
              itemType: "SPEC",
              isEnabled: true,
              sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
            },
          });
        }
      }

      // Return updated playbook
      const updated = await prisma.playbook.findUnique({
        where: { id: playbookId },
        include: {
          domain: { select: { id: true, slug: true, name: true } },
          items: {
            orderBy: { sortOrder: "asc" },
            include: {
              spec: {
                select: {
                  id: true, slug: true, name: true, description: true,
                  scope: true, outputType: true, specType: true, specRole: true,
                },
              },
            },
          },
          // systemSpecs are derived from config.systemSpecToggles via withSystemSpecs()
        },
      });

      return NextResponse.json({ ok: true, playbook: withSystemSpecs(updated) });
    }

    // Update metadata (including optional agentId) - only for non-published
    let playbook = existing;
    if (existing.status !== "PUBLISHED") {
      playbook = await prisma.playbook.update({
        where: { id: playbookId },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(agentId !== undefined && { agentId: agentId || null }),
        },
      });
    }

    // Update items if provided (only for non-published)
    if (items !== undefined && existing.status !== "PUBLISHED") {
      // Delete existing items
      await prisma.playbookItem.deleteMany({
        where: { playbookId },
      });

      // Create new items
      if (items.length > 0) {
        await prisma.playbookItem.createMany({
          data: items.map((item: any, index: number) => ({
            playbookId,
            itemType: item.itemType,
            specId: item.specId || null,
            promptTemplateId: item.promptTemplateId || null,
            isEnabled: item.isEnabled !== false,
            sortOrder: index,
          })),
        });
      }
    }

    // Save system spec toggles to playbook.config.systemSpecToggles
    if (specs !== undefined) {
      const systemSpecToggles: Record<string, { isEnabled: boolean; configOverride: any }> = {};
      for (const s of specs as Array<{ specId: string; isEnabled: boolean; configOverride: any }>) {
        systemSpecToggles[s.specId] = {
          isEnabled: s.isEnabled,
          configOverride: s.configOverride || null,
        };
      }
      const currentConfig = (existing.config as Record<string, any>) || {};
      await prisma.playbook.update({
        where: { id: playbookId },
        data: {
          config: { ...currentConfig, systemSpecToggles },
        },
      });
    }

    // Fetch updated playbook
    const updated = await prisma.playbook.findUnique({
      where: { id: playbookId },
      include: {
        domain: {
          select: { id: true, slug: true, name: true },
        },
        // agent: removed - FK relation deprecated
        // curriculum: removed - FK relation no longer exists on Playbook model
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            spec: {
              select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                scope: true,
                outputType: true,
                specType: true,
                specRole: true,
                _count: {
                  select: { triggers: true },
                },
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
        // systemSpecs are derived from config.systemSpecToggles via withSystemSpecs()
      },
    });

    return NextResponse.json({
      ok: true,
      playbook: withSystemSpecs(updated),
    });
  } catch (error: any) {
    console.error("Error updating playbook:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update playbook" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/playbooks/[playbookId]
 * Delete a draft playbook
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ playbookId: string }> }
) {
  try {
    const { playbookId } = await params;

    const existing = await prisma.playbook.findUnique({
      where: { id: playbookId },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Playbook not found" },
        { status: 404 }
      );
    }

    if (existing.status === "PUBLISHED") {
      return NextResponse.json(
        { ok: false, error: "Cannot delete a published playbook. Archive it instead." },
        { status: 400 }
      );
    }

    // Delete items first (cascade should handle this, but being explicit)
    await prisma.playbookItem.deleteMany({
      where: { playbookId },
    });

    await prisma.playbook.delete({
      where: { id: playbookId },
    });

    return NextResponse.json({
      ok: true,
      message: "Playbook deleted",
    });
  } catch (error: any) {
    console.error("Error deleting playbook:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete playbook" },
      { status: 500 }
    );
  }
}
