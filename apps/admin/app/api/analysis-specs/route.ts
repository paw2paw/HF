import { NextResponse } from "next/server";
import { PrismaClient, AnalysisOutputType } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * GET /api/analysis-specs
 * List analysis specifications with optional filtering
 * Query params:
 * - limit: max records (default 100)
 * - domain: filter by domain (personality, memory, engagement, etc.)
 * - outputType: filter by MEASURE or LEARN
 * - active: "true" | "false" | "all" (default "all")
 * - include: "full" to include triggers, actions, and parameter anchors
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const domain = url.searchParams.get("domain");
    const outputType = url.searchParams.get("outputType") as AnalysisOutputType | null;
    const active = url.searchParams.get("active") || "all";
    const include = url.searchParams.get("include");

    const where: any = {};

    if (domain) {
      where.domain = domain;
    }

    if (outputType) {
      where.outputType = outputType;
    }

    if (active === "true") {
      where.isActive = true;
    } else if (active === "false") {
      where.isActive = false;
    }

    const specs = await prisma.analysisSpec.findMany({
      where,
      orderBy: [{ priority: "desc" }, { name: "asc" }],
      take: limit,
      include:
        include === "full"
          ? {
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
            }
          : {
              triggers: {
                select: {
                  id: true,
                  _count: {
                    select: { actions: true },
                  },
                },
              },
            },
    });

    // Add trigger count and action count for non-full includes
    const specsWithCounts = specs.map((s) => {
      const actionCount = s.triggers.reduce(
        (sum, t) => sum + ((t as any)._count?.actions || 0),
        0
      );
      return {
        ...s,
        triggerCount: s.triggers.length,
        actionCount,
        triggers: include === "full" ? s.triggers : undefined,
      };
    });

    return NextResponse.json({
      ok: true,
      specs: specsWithCounts,
      count: specs.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch analysis specs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analysis-specs
 * Create a new analysis specification
 *
 * Body: {
 *   slug: string,
 *   name: string,
 *   description?: string,
 *   outputType: "MEASURE" | "LEARN",
 *   domain?: string,
 *   priority?: number,
 *   triggers?: Array<{
 *     given: string,
 *     when: string,
 *     then: string,
 *     name?: string,
 *     actions?: Array<{
 *       description: string,
 *       weight?: number,
 *       // For MEASURE:
 *       parameterId?: string,
 *       // For LEARN:
 *       learnCategory?: MemoryCategory,
 *       learnKeyPrefix?: string,
 *       learnKeyHint?: string,
 *     }>
 *   }>
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { slug, name, description, outputType, domain, priority, triggers } = body;

    if (!slug || !name) {
      return NextResponse.json(
        { ok: false, error: "slug and name are required" },
        { status: 400 }
      );
    }

    // Check for duplicate slug
    const existing = await prisma.analysisSpec.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: `Spec with slug '${slug}' already exists` },
        { status: 409 }
      );
    }

    // Validate based on outputType
    const specOutputType = outputType || "MEASURE";

    if (triggers) {
      for (const t of triggers) {
        for (const a of t.actions || []) {
          if (specOutputType === "MEASURE" && !a.parameterId) {
            // Allow actions without parameterId for now (can be added later)
          }
          if (specOutputType === "LEARN" && !a.learnCategory) {
            // Allow actions without learnCategory for now
          }
        }
      }

      // Validate parameterIds exist (for MEASURE)
      if (specOutputType === "MEASURE") {
        const allParameterIds = new Set<string>();
        for (const t of triggers) {
          for (const a of t.actions || []) {
            if (a.parameterId) {
              allParameterIds.add(a.parameterId);
            }
          }
        }

        if (allParameterIds.size > 0) {
          const existingParams = await prisma.parameter.findMany({
            where: { parameterId: { in: Array.from(allParameterIds) } },
            select: { parameterId: true },
          });
          const existingIds = new Set(existingParams.map((p) => p.parameterId));
          const missing = Array.from(allParameterIds).filter((id) => !existingIds.has(id));
          if (missing.length > 0) {
            return NextResponse.json(
              { ok: false, error: `Unknown parameter(s): ${missing.join(", ")}` },
              { status: 400 }
            );
          }
        }
      }
    }

    // Create spec with nested triggers and actions
    const spec = await prisma.analysisSpec.create({
      data: {
        slug,
        name,
        description,
        outputType: specOutputType,
        domain,
        priority: priority ?? 0,
        triggers: triggers
          ? {
              create: triggers.map((t: any, tIdx: number) => ({
                given: t.given,
                when: t.when,
                then: t.then,
                name: t.name,
                notes: t.notes,
                sortOrder: tIdx,
                actions: t.actions
                  ? {
                      create: t.actions.map((a: any, aIdx: number) => ({
                        description: a.description,
                        weight: a.weight ?? 1.0,
                        parameterId: a.parameterId || null,
                        learnCategory: a.learnCategory || null,
                        learnKeyPrefix: a.learnKeyPrefix || null,
                        learnKeyHint: a.learnKeyHint || null,
                        sortOrder: aIdx,
                      })),
                    }
                  : undefined,
              })),
            }
          : undefined,
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
                    scaleType: true,
                    scoringAnchors: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ ok: true, spec });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create analysis spec" },
      { status: 500 }
    );
  }
}
