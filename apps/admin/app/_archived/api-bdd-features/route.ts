import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * GET /api/bdd-features
 * List BDD features with optional filtering
 * Query params:
 * - limit: max records (default 100)
 * - category: filter by category
 * - active: "true" | "false" | "all" (default "all")
 * - include: "full" to include scenarios, criteria, and parameter anchors (read-only)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const category = url.searchParams.get("category");
    const active = url.searchParams.get("active") || "all";
    const include = url.searchParams.get("include");

    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (active === "true") {
      where.isActive = true;
    } else if (active === "false") {
      where.isActive = false;
    }

    const features = await prisma.bddFeature.findMany({
      where,
      orderBy: [{ priority: "desc" }, { name: "asc" }],
      take: limit,
      include:
        include === "full"
          ? {
              scenarios: {
                orderBy: { sortOrder: "asc" },
                include: {
                  criteria: {
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
                          // Include scoring anchors from the Parameter (read-only)
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
              scenarios: {
                select: { id: true },
              },
            },
    });

    // Add scenario count for non-full includes
    const featuresWithCounts = features.map((f) => ({
      ...f,
      scenarioCount: f.scenarios.length,
      scenarios: include === "full" ? f.scenarios : undefined,
    }));

    return NextResponse.json({
      ok: true,
      features: featuresWithCounts,
      count: features.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch BDD features" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bdd-features
 * Create a new BDD feature with scenarios and criteria
 * Criteria link to existing Parameters (which own their scoring anchors)
 *
 * Body: {
 *   slug: string,
 *   name: string,
 *   description?: string,
 *   category?: string,
 *   priority?: number,
 *   scenarios?: Array<{
 *     given: string,
 *     when: string,
 *     then: string,
 *     name?: string,
 *     criteria?: Array<{
 *       description: string,
 *       weight?: number,
 *       parameterId: string,  // Required - links to Parameter
 *     }>
 *   }>
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { slug, name, description, category, priority, scenarios } = body;

    if (!slug || !name) {
      return NextResponse.json(
        { ok: false, error: "slug and name are required" },
        { status: 400 }
      );
    }

    // Check for duplicate slug
    const existing = await prisma.bddFeature.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: `Feature with slug '${slug}' already exists` },
        { status: 409 }
      );
    }

    // Validate all parameterIds exist
    if (scenarios) {
      const allParameterIds = new Set<string>();
      for (const s of scenarios) {
        for (const c of s.criteria || []) {
          if (c.parameterId) {
            allParameterIds.add(c.parameterId);
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

    // Create feature with nested scenarios and criteria
    const feature = await prisma.bddFeature.create({
      data: {
        slug,
        name,
        description,
        category,
        priority: priority ?? 0,
        scenarios: scenarios
          ? {
              create: scenarios.map((s: any, sIdx: number) => ({
                given: s.given,
                when: s.when,
                then: s.then,
                name: s.name,
                notes: s.notes,
                sortOrder: sIdx,
                criteria: s.criteria
                  ? {
                      create: s.criteria.map((c: any, cIdx: number) => ({
                        description: c.description,
                        weight: c.weight ?? 1.0,
                        parameterId: c.parameterId,
                        sortOrder: cIdx,
                      })),
                    }
                  : undefined,
              })),
            }
          : undefined,
      },
      include: {
        scenarios: {
          include: {
            criteria: {
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

    return NextResponse.json({ ok: true, feature });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create BDD feature" },
      { status: 500 }
    );
  }
}
