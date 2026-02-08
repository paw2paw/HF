import { NextRequest, NextResponse } from "next/server";
import { previewPrompt } from "@/lib/prompt/PromptStackComposer";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/prompt/preview
 *
 * Get data needed for the prompt preview UI:
 * - Available stacks
 * - Parameters that drive slugs (for slider UI)
 */
export async function GET() {
  try {
    // Get available stacks
    const stacks = await prisma.promptStack.findMany({
      where: { status: { in: ["DRAFT", "PUBLISHED"] } },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        status: true,
        isDefault: true,
        _count: { select: { items: true } },
      },
    });

    // Get parameters that are linked to any slug
    const linkedParams = await prisma.promptSlugParameter.findMany({
      distinct: ["parameterId"],
      include: {
        parameter: {
          select: {
            parameterId: true,
            name: true,
            domainGroup: true,
            interpretationLow: true,
            interpretationHigh: true,
          },
        },
      },
    });

    const parameters = linkedParams
      .map((lp) => lp.parameter)
      .filter(Boolean)
      .map((p) => ({
        parameterId: p!.parameterId,
        name: p!.name,
        domainGroup: p!.domainGroup,
        interpretationLow: p!.interpretationLow,
        interpretationHigh: p!.interpretationHigh,
      }));

    // Remove duplicates
    const uniqueParams = Array.from(
      new Map(parameters.map((p) => [p.parameterId, p])).values()
    );

    return NextResponse.json({
      ok: true,
      stacks: stacks.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        isDefault: s.isDefault,
        itemCount: s._count.items,
      })),
      parameters: uniqueParams,
    });
  } catch (error: any) {
    console.error("Preview data error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to get preview data" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/prompt/preview
 *
 * Preview a composed prompt with custom parameter values
 *
 * Body: {
 *   stackId: string,
 *   parameterValues: { [parameterId]: number (0-1) }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stackId, parameterValues } = body;

    if (!stackId) {
      return NextResponse.json(
        { ok: false, error: "Missing stackId" },
        { status: 400 }
      );
    }

    if (!parameterValues || typeof parameterValues !== "object") {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid parameterValues" },
        { status: 400 }
      );
    }

    const result = await previewPrompt(stackId, parameterValues);

    return NextResponse.json({
      ok: true,
      prompt: result.text,
      matches: result.matches.map((m) => ({
        slug: m.slugSlug,
        name: m.slugName,
        sourceType: m.sourceType,
        rangeLabel: m.rangeLabel,
        effectiveValue: m.effectiveValue,
        priority: m.priority,
        promptText: m.promptText,
        parameters: m.parameters,
      })),
      stackName: result.stackName,
      composedAt: result.composedAt,
    });
  } catch (error: any) {
    console.error("Preview compose error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to preview prompt" },
      { status: 500 }
    );
  }
}
