/**
 * GET/PUT /api/admin/registry
 *
 * View and manage the parameter registry (single source of truth).
 * Registry lives in Parameter table - this endpoint provides admin UI access.
 *
 * GET: View all canonical parameters with coverage stats
 * PUT: Update a parameter's registry fields (name, definition, deprecated, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/admin/registry
 * @visibility internal
 * @auth session
 * @tags admin, parameters
 * @description View all canonical parameters with coverage stats
 * @query deprecated boolean - Show deprecated parameters (default: false)
 * @query orphaned boolean - Show only orphaned parameters with no spec actions (default: false)
 * @response 200 { ok: true, parameters: Array<{ id, parameterId, name, definition, domainGroup, defaultTarget, isCanonical, deprecatedAt, replacedBy, aliases, usage: { inActions, inTargets, inScores, total } }>, summary: { total, active, deprecated, inUse, orphaned, byDomain } }
 * @response 500 { ok: false, error: string }
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

    const searchParams = new URL(request.url).searchParams;
    const deprecated = searchParams.get("deprecated") === "true";
    const orphanedOnly = searchParams.get("orphaned") === "true";

    let where: any = { isCanonical: true };

    if (deprecated) {
      where.deprecatedAt = { not: null };
    } else {
      where.deprecatedAt = null;
    }

    const params = await prisma.parameter.findMany({
      where,
      orderBy: [{ domainGroup: "asc" }, { parameterId: "asc" }],
      include: {
        _count: {
          select: {
            analysisActions: true,
            behaviorTargets: true,
            callScores: true,
          },
        },
      },
    });

    // Filter orphaned if requested
    const filtered = orphanedOnly
      ? params.filter((p) => p._count.analysisActions === 0)
      : params;

    // Coverage stats
    const allParams = await prisma.parameter.findMany({
      where: { isCanonical: true },
    });

    const inUse = allParams.filter(
      (p) => p.deprecatedAt === null
    );

    const summary = {
      total: allParams.length,
      active: inUse.length,
      deprecated: allParams.filter((p) => p.deprecatedAt !== null).length,
      inUse: inUse.filter((p) =>
        filtered.some((f) => f._count.analysisActions > 0)
      ).length,
      orphaned: filtered.filter((p) => p._count.analysisActions === 0).length,
      byDomain: {} as Record<string, number>,
    };

    // Group by domain
    for (const param of allParams) {
      const domain = param.domainGroup || "uncategorized";
      summary.byDomain[domain] = (summary.byDomain[domain] || 0) + 1;
    }

    return NextResponse.json({
      ok: true,
      parameters: filtered.map((p) => ({
        id: p.id,
        parameterId: p.parameterId,
        name: p.name,
        definition: p.definition,
        domainGroup: p.domainGroup,
        defaultTarget: p.defaultTarget,
        isCanonical: p.isCanonical,
        deprecatedAt: p.deprecatedAt,
        replacedBy: p.replacedBy,
        aliases: p.aliases,
        usage: {
          inActions: p._count.analysisActions,
          inTargets: p._count.behaviorTargets,
          inScores: p._count.callScores,
          total: p._count.analysisActions + p._count.behaviorTargets + p._count.callScores,
        },
      })),
      summary,
    });
  } catch (error: any) {
    console.error("Error fetching registry:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch registry" },
      { status: 500 }
    );
  }
}

/**
 * @api PUT /api/admin/registry
 * @visibility internal
 * @auth session
 * @tags admin, parameters
 * @description Update a parameter's registry fields (name, definition, deprecated, etc.)
 * @body parameterId string - The parameter ID to update (required)
 * @body name string - New display name
 * @body definition string - New definition text
 * @body defaultTarget number - New default target value
 * @body deprecatedAt string - ISO date to mark as deprecated, or null to unmark
 * @body replacedBy string - Replacement parameter ID if deprecated
 * @body aliases string[] - Alternative names for the parameter
 * @body isCanonical boolean - Whether this is the canonical version
 * @response 200 { ok: true, parameter: Parameter, message: string }
 * @response 400 { ok: false, error: "parameterId is required" }
 * @response 500 { ok: false, error: string }
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

    const body = await request.json();
    const {
      parameterId,
      name,
      definition,
      defaultTarget,
      deprecatedAt,
      replacedBy,
      aliases,
      isCanonical,
    } = body;

    if (!parameterId) {
      return NextResponse.json(
        { ok: false, error: "parameterId is required" },
        { status: 400 }
      );
    }

    const param = await prisma.parameter.update({
      where: { parameterId },
      data: {
        ...(name !== undefined && { name }),
        ...(definition !== undefined && { definition }),
        ...(defaultTarget !== undefined && { defaultTarget }),
        ...(deprecatedAt !== undefined && { deprecatedAt }),
        ...(replacedBy !== undefined && { replacedBy }),
        ...(aliases !== undefined && { aliases }),
        ...(isCanonical !== undefined && { isCanonical }),
      },
    });

    // Trigger rebuild on modification
    console.log(
      `[Registry] Parameter ${parameterId} updated, rebuild required`
    );

    return NextResponse.json({
      ok: true,
      parameter: param,
      message: "Parameter updated. Run 'npm run registry:generate' to rebuild.",
    });
  } catch (error: any) {
    console.error("Error updating registry:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update registry" },
      { status: 500 }
    );
  }
}
