import { NextResponse } from "next/server";
import { PrismaClient, AnalysisOutputType } from "@prisma/client";
import { requireAuth, isAuthError } from "@/lib/permissions";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * @api GET /api/analysis-specs
 * @visibility internal
 * @scope analysis-specs:read
 * @auth session
 * @tags analysis-specs
 * @description List analysis specifications with optional filtering, trigger/action counts, and playbook usage
 * @query limit number - Max records (default 100)
 * @query domain string - Filter by domain (personality, memory, engagement, etc.)
 * @query outputType string - Filter by output type (MEASURE, LEARN, etc.)
 * @query active string - Filter by active status: "true", "false", or "all" (default "all")
 * @query include string - Set to "full" to include triggers, actions, and parameter anchors
 * @response 200 { ok: true, specs: AnalysisSpec[], count: number }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const domain = url.searchParams.get("domain");
    const outputType = url.searchParams.get("outputType") as AnalysisOutputType | null;
    const specRole = url.searchParams.get("specRole");
    const active = url.searchParams.get("active") || "all";
    const include = url.searchParams.get("include");

    const where: any = {};

    if (domain) {
      where.domain = domain;
    }

    if (outputType) {
      where.outputType = outputType;
    }

    if (specRole) {
      where.specRole = specRole;
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
              sourceFeatureSet: {
                select: { id: true, featureId: true, name: true, version: true },
              },
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
              sourceFeatureSet: {
                select: { id: true, featureId: true, name: true, version: true },
              },
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

    // Get playbook usage for all specs
    const playbookItems = await prisma.playbookItem.findMany({
      where: {
        specId: { in: specs.map(s => s.id) },
        itemType: "SPEC",
      },
      include: {
        playbook: {
          select: {
            id: true,
            name: true,
            status: true,
            domain: {
              select: { name: true, slug: true },
            },
          },
        },
      },
    });

    // Group by specId
    const playbooksBySpec = new Map<string, typeof playbookItems>();
    for (const item of playbookItems) {
      if (!item.specId) continue;
      if (!playbooksBySpec.has(item.specId)) {
        playbooksBySpec.set(item.specId, []);
      }
      playbooksBySpec.get(item.specId)!.push(item);
    }

    // Add trigger count, action count, and playbook usage
    const specsWithCounts = specs.map((s) => {
      const actionCount = s.triggers.reduce(
        (sum, t) => sum + ((t as any)._count?.actions || 0),
        0
      );
      const usedInPlaybooks = playbooksBySpec.get(s.id) || [];
      return {
        ...s,
        triggerCount: s.triggers.length,
        actionCount,
        triggers: include === "full" ? s.triggers : undefined,
        playbookCount: usedInPlaybooks.length,
        playbooks: usedInPlaybooks.map(p => ({
          id: p.playbook.id,
          name: p.playbook.name,
          status: p.playbook.status,
          domain: p.playbook.domain?.name || null,
        })),
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
 * @api POST /api/analysis-specs
 * @visibility internal
 * @scope analysis-specs:write
 * @auth session
 * @tags analysis-specs
 * @description Create a new analysis specification with nested triggers and actions. Validates parameter IDs for MEASURE specs.
 * @body slug string - Unique spec slug
 * @body name string - Display name
 * @body description string - Optional description
 * @body outputType string - "MEASURE" or "LEARN" (default: "MEASURE")
 * @body domain string - Domain category (personality, memory, engagement, etc.)
 * @body priority number - Spec priority (default: 0)
 * @body triggers Array - Nested triggers with actions: [{given, when, then, name?, actions?: [{description, weight?, parameterId?, learnCategory?, learnKeyPrefix?, learnKeyHint?}]}]
 * @response 200 { ok: true, spec: AnalysisSpec }
 * @response 400 { ok: false, error: "slug and name are required" }
 * @response 400 { ok: false, error: "Unknown parameter(s): ..." }
 * @response 409 { ok: false, error: "Spec with slug '...' already exists" }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

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
