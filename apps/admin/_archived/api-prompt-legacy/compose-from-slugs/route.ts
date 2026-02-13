import { NextRequest, NextResponse } from "next/server";
import { composeFromSlugs } from "@/lib/prompt/PromptSlugComposer";
import { PromptSlugSource } from "@prisma/client";

export const runtime = "nodejs";

/**
 * POST /api/prompt/compose-from-slugs
 *
 * Compose prompts from PromptSlugs based on parameter values.
 * This is the clean architecture where:
 * - AnalysisSpec defines HOW to measure
 * - PromptSlug defines WHAT to say based on measurements
 *
 * Request body:
 * - userId?: string - Fetch parameter values from user's profile
 * - parameterValues?: Record<string, number> - Override/provide parameter values directly
 * - includeMemories?: boolean - Include memory-based slugs (default: true)
 * - sourceTypes?: PromptSlugSource[] - Filter by source type (PARAMETER, MEMORY, COMPOSITE, ADAPT)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      callerId,
      parameterValues,
      includeMemories = true,
      sourceTypes,
    } = body;

    // Validate sourceTypes if provided
    let validSourceTypes: PromptSlugSource[] | undefined;
    if (sourceTypes) {
      const validValues = ["PARAMETER", "MEMORY", "COMPOSITE", "ADAPT"];
      validSourceTypes = sourceTypes.filter((t: string) =>
        validValues.includes(t)
      ) as PromptSlugSource[];
    }

    const result = await composeFromSlugs({
      userId,
      callerId,
      parameterValues,
      includeMemories,
      sourceTypes: validSourceTypes,
    });

    return NextResponse.json({
      ok: true,
      prompt: result.combinedPrompt,
      prompts: result.prompts,
      metadata: result.metadata,
    });
  } catch (error: any) {
    console.error("Slug composition error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Composition failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/prompt/compose-from-slugs
 *
 * Get info about available slugs and their configuration
 */
export async function GET() {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const slugs = await prisma.promptSlug.findMany({
      where: { isActive: true },
      include: {
        parameters: {
          include: {
            parameter: {
              select: {
                parameterId: true,
                name: true,
                parameterType: true,
              },
            },
          },
        },
        ranges: {
          select: {
            label: true,
            minValue: true,
            maxValue: true,
            condition: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ priority: "desc" }, { slug: "asc" }],
    });

    const summary = {
      total: slugs.length,
      bySourceType: {
        PARAMETER: slugs.filter((s) => s.sourceType === "PARAMETER").length,
        MEMORY: slugs.filter((s) => s.sourceType === "MEMORY").length,
        COMPOSITE: slugs.filter((s) => s.sourceType === "COMPOSITE").length,
        ADAPT: slugs.filter((s) => s.sourceType === "ADAPT").length,
      },
    };

    await prisma.$disconnect();

    return NextResponse.json({
      ok: true,
      summary,
      slugs: slugs.map((s) => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        sourceType: s.sourceType,
        priority: s.priority,
        memoryCategory: s.memoryCategory,
        memoryMode: s.memoryMode,
        hasFallback: !!s.fallbackPrompt,
        parameters: s.parameters.map((p) => ({
          parameterId: p.parameter.parameterId,
          name: p.parameter.name,
          type: p.parameter.parameterType,
          weight: p.weight,
          mode: p.mode,
        })),
        ranges: s.ranges,
      })),
    });
  } catch (error: any) {
    console.error("Slug info error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to get slug info" },
      { status: 500 }
    );
  }
}
