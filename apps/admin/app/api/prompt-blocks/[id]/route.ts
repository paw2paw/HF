import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
import { requireAuth, isAuthError } from "@/lib/permissions";

export const runtime = "nodejs";

/**
 * @api GET /api/prompt-blocks/:id
 * @visibility internal
 * @scope prompts:read
 * @auth session
 * @tags prompts
 * @description Get a single prompt block by ID or slug, including stacks it is used in
 * @pathParam id string - Prompt block UUID or slug
 * @response 200 { ok: true, block: PromptBlock }
 * @response 404 { ok: false, error: "Prompt block not found" }
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

    const block = await prisma.promptBlock.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
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

    if (!block) {
      return NextResponse.json(
        { ok: false, error: "Prompt block not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      block: {
        ...block,
        usedInStacks: block.stackItems.map((si) => si.stack),
        stackItems: undefined,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch prompt block" },
      { status: 500 }
    );
  }
}

/**
 * @api PATCH /api/prompt-blocks/:id
 * @visibility internal
 * @scope prompts:write
 * @auth session
 * @tags prompts
 * @description Update a prompt block's name, description, category, content, or active status
 * @pathParam id string - Prompt block UUID or slug
 * @body name string - Updated name
 * @body description string - Updated description
 * @body category string - Updated category
 * @body content string - Updated content
 * @body isActive boolean - Updated active status
 * @response 200 { ok: true, block: PromptBlock }
 * @response 404 { ok: false, error: "Prompt block not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { id } = await params;
    const body = await req.json();
    const { name, description, category, content, isActive } = body;

    const existing = await prisma.promptBlock.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Prompt block not found" },
        { status: 404 }
      );
    }

    const block = await prisma.promptBlock.update({
      where: { id: existing.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(category && { category }),
        ...(content && { content }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ ok: true, block });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update prompt block" },
      { status: 500 }
    );
  }
}

/**
 * @api DELETE /api/prompt-blocks/:id
 * @visibility internal
 * @scope prompts:write
 * @auth session
 * @tags prompts
 * @description Delete a prompt block. Fails if the block is used in any stacks.
 * @pathParam id string - Prompt block UUID or slug
 * @response 200 { ok: true, deleted: true }
 * @response 400 { ok: false, error: "Cannot delete block used in N stack(s)..." }
 * @response 404 { ok: false, error: "Prompt block not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { id } = await params;

    const existing = await prisma.promptBlock.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        _count: { select: { stackItems: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Prompt block not found" },
        { status: 404 }
      );
    }

    if (existing._count.stackItems > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cannot delete block used in ${existing._count.stackItems} stack(s). Remove from stacks first or deactivate instead.`,
        },
        { status: 400 }
      );
    }

    await prisma.promptBlock.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete prompt block" },
      { status: 500 }
    );
  }
}
