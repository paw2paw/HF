import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * GET /api/prompt-slugs/[id]
 * Get a single dynamic prompt with all parameters and ranges
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const promptSlug = await prisma.promptSlug.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        parameters: {
          include: {
            parameter: {
              select: {
                parameterId: true,
                name: true,
                domainGroup: true,
                definition: true,
                interpretationHigh: true,
                interpretationLow: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        ranges: {
          orderBy: { sortOrder: "asc" },
        },
        stackItems: {
          include: {
            stack: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!promptSlug) {
      return NextResponse.json(
        { ok: false, error: "Dynamic prompt not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      slug: {
        ...promptSlug,
        usedInStacks: promptSlug.stackItems.map((si) => si.stack),
        stackItems: undefined,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch dynamic prompt" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/prompt-slugs/[id]
 * Update a dynamic prompt, its parameters, and ranges
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      name,
      description,
      sourceType,
      // New: array of parameters with weights and modes
      parameters: parameterInputs,
      // Legacy single parameter support
      parameterId,
      mode,
      memoryCategory,
      memoryMode,
      fallbackPrompt,
      priority,
      isActive,
      ranges,
    } = body;

    const existing = await prisma.promptSlug.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Dynamic prompt not found" },
        { status: 404 }
      );
    }

    // Update in transaction
    const promptSlug = await prisma.$transaction(async (tx) => {
      const updatedSlug = await tx.promptSlug.update({
        where: { id: existing.id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(sourceType && { sourceType }),
          ...(memoryCategory !== undefined && { memoryCategory }),
          ...(memoryMode !== undefined && { memoryMode }),
          ...(fallbackPrompt !== undefined && { fallbackPrompt }),
          ...(priority !== undefined && { priority }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      // Handle parameters update
      if (parameterInputs !== undefined || parameterId !== undefined) {
        // Build parameter list
        let parameterList = parameterInputs || [];
        if (parameterId && parameterList.length === 0) {
          parameterList = [{ parameterId, mode: mode || "ABSOLUTE", weight: 1.0 }];
        }

        // Delete existing parameter links
        await tx.promptSlugParameter.deleteMany({
          where: { slugId: existing.id },
        });

        // Create new parameter links
        if (parameterList.length > 0) {
          await tx.promptSlugParameter.createMany({
            data: parameterList.map((p: any, index: number) => ({
              slugId: existing.id,
              parameterId: p.parameterId,
              weight: p.weight ?? 1.0,
              mode: p.mode || "ABSOLUTE",
              sortOrder: p.sortOrder ?? index,
            })),
          });
        }
      }

      // If ranges are provided, replace all ranges
      if (ranges !== undefined) {
        // Delete existing ranges
        await tx.promptSlugRange.deleteMany({
          where: { slugId: existing.id },
        });

        // Create new ranges
        if (ranges.length > 0) {
          await tx.promptSlugRange.createMany({
            data: ranges.map((r: any, index: number) => ({
              slugId: existing.id,
              minValue: r.minValue,
              maxValue: r.maxValue,
              condition: r.condition,
              prompt: r.prompt,
              label: r.label,
              metadata: r.metadata,
              sortOrder: r.sortOrder ?? index,
            })),
          });
        }
      }

      return tx.promptSlug.findUnique({
        where: { id: existing.id },
        include: {
          parameters: {
            include: {
              parameter: {
                select: {
                  parameterId: true,
                  name: true,
                  domainGroup: true,
                },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
          ranges: {
            orderBy: { sortOrder: "asc" },
          },
        },
      });
    });

    return NextResponse.json({ ok: true, slug: promptSlug });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update dynamic prompt" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/prompt-slugs/[id]
 * Delete a dynamic prompt (only if not used in any stacks)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.promptSlug.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        _count: { select: { stackItems: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Dynamic prompt not found" },
        { status: 404 }
      );
    }

    if (existing._count.stackItems > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cannot delete dynamic prompt used in ${existing._count.stackItems} stack(s). Remove from stacks first or deactivate instead.`,
        },
        { status: 400 }
      );
    }

    // Delete slug, parameter links, and ranges (cascade)
    await prisma.promptSlug.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete dynamic prompt" },
      { status: 500 }
    );
  }
}
