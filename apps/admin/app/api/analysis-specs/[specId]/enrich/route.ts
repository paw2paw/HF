import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * POST /api/analysis-specs/[specId]/enrich
 * Enrich a spec by pulling knowledge from artifacts to deepen action terms.
 * This will:
 * 1. Find all actions in the spec
 * 2. Extract key terms from action descriptions
 * 3. Search knowledge artifacts for relevant context
 * 4. Update action enrichment data (future: store in enrichedContext field)
 *
 * Currently a placeholder that returns success with mock data.
 * Future: integrate with knowledge retrieval system.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const { specId } = await params;

    // Load the spec with actions
    const spec = await prisma.analysisSpec.findFirst({
      where: {
        OR: [{ id: specId }, { slug: specId }],
      },
      include: {
        triggers: {
          include: {
            actions: {
              include: {
                parameter: {
                  select: {
                    parameterId: true,
                    name: true,
                    definition: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!spec) {
      return NextResponse.json(
        { ok: false, error: "Spec not found" },
        { status: 404 }
      );
    }

    if (spec.isLocked) {
      return NextResponse.json(
        { ok: false, error: "Spec is locked and cannot be enriched" },
        { status: 423 }
      );
    }

    // Count actions that could be enriched
    let enrichableCount = 0;
    const terms: string[] = [];

    for (const trigger of spec.triggers) {
      for (const action of trigger.actions) {
        enrichableCount++;
        // Extract key terms from action description and parameter
        if (action.description) {
          terms.push(action.description);
        }
        if (action.parameter?.name) {
          terms.push(action.parameter.name);
        }
        if (action.parameter?.definition) {
          terms.push(action.parameter.definition);
        }
      }
    }

    // TODO: Future implementation
    // 1. Use knowledge retriever to search for relevant chunks
    // 2. Store enriched context on actions or parameters
    // 3. Use this context for better LLM prompts during analysis

    // For now, return a placeholder response
    return NextResponse.json({
      ok: true,
      message: `Enrichment ready for ${enrichableCount} action(s). Knowledge retrieval integration coming soon.`,
      enriched: 0, // Will be actual count when implemented
      spec: {
        id: spec.id,
        name: spec.name,
        actionCount: enrichableCount,
      },
      terms: terms.slice(0, 10), // Preview of terms that would be searched
      hint: "This feature will pull context from knowledge artifacts to improve analysis accuracy.",
    });
  } catch (error: any) {
    console.error("Spec enrichment error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to enrich spec" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analysis-specs/[specId]/enrich
 * Get enrichment status for a spec
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
          include: {
            actions: {
              include: {
                parameter: {
                  select: {
                    parameterId: true,
                    name: true,
                    enrichedAt: true,
                    enrichedHigh: true,
                    enrichedLow: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!spec) {
      return NextResponse.json(
        { ok: false, error: "Spec not found" },
        { status: 404 }
      );
    }

    // Count enriched parameters
    const parameterIds = new Set<string>();
    let enrichedCount = 0;

    for (const trigger of spec.triggers) {
      for (const action of trigger.actions) {
        if (action.parameter && !parameterIds.has(action.parameter.parameterId)) {
          parameterIds.add(action.parameter.parameterId);
          if (action.parameter.enrichedAt) {
            enrichedCount++;
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      status: {
        totalParameters: parameterIds.size,
        enrichedParameters: enrichedCount,
        percentEnriched: parameterIds.size > 0
          ? Math.round((enrichedCount / parameterIds.size) * 100)
          : 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to get enrichment status" },
      { status: 500 }
    );
  }
}
