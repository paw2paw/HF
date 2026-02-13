import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * GET /api/compiled-sets
 * List compiled analysis sets
 * Query params:
 * - status: filter by status (DRAFT, READY, etc.)
 * - profileId: filter by source profile
 * - limit: max records (default 50)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const profileId = url.searchParams.get("profileId");
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const where: any = {};
    if (status) where.status = status;
    if (profileId) where.analysisProfileId = profileId;

    const sets = await prisma.compiledAnalysisSet.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        analysisProfile: {
          select: {
            id: true,
            name: true,
            isLocked: true,
            usageCount: true,
          },
        },
        _count: {
          select: { runs: true },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      sets: sets.map(s => ({
        ...s,
        runCount: s._count.runs,
        _count: undefined,
      })),
      count: sets.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch compiled sets" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/compiled-sets
 * Create a new compiled analysis set (in DRAFT status)
 *
 * Body: {
 *   name: string,
 *   description?: string,
 *   analysisProfileId?: string,  // Optional: use existing profile
 *   specIds?: string[],          // Optional: specific specs to include (required if no profileId)
 * }
 *
 * If specIds are provided without a profileId, a new profile is auto-created.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, description, analysisProfileId, specIds } = body;

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "name is required" },
        { status: 400 }
      );
    }

    let profileId = analysisProfileId;

    // If specIds provided without a profile, create an auto-generated profile
    if (!profileId && specIds && specIds.length > 0) {
      // Count measure and learn specs
      const specs = await prisma.analysisSpec.findMany({
        where: { id: { in: specIds } },
        select: { id: true, outputType: true },
      });

      const measureCount = specs.filter(s => s.outputType === "MEASURE").length;
      const learnCount = specs.filter(s => s.outputType === "LEARN").length;

      // Create auto-generated profile
      const autoProfile = await prisma.analysisProfile.create({
        data: {
          name: `${name} (Auto)`,
          description: `Auto-generated profile for Run Config: ${name}. Contains ${measureCount} MEASURE and ${learnCount} LEARN specs.`,
        },
      });
      profileId = autoProfile.id;
    }

    if (!profileId) {
      return NextResponse.json(
        { ok: false, error: "Either analysisProfileId or specIds must be provided" },
        { status: 400 }
      );
    }

    // Verify profile exists
    const profile = await prisma.analysisProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Analysis profile not found" },
        { status: 404 }
      );
    }

    // If no specIds provided, get all active compiled specs
    let resolvedSpecIds = specIds;
    if (!resolvedSpecIds || resolvedSpecIds.length === 0) {
      const activeSpecs = await prisma.analysisSpec.findMany({
        where: {
          isActive: true,
          compiledAt: { not: null },
          isDirty: false,
        },
        select: { id: true },
      });
      resolvedSpecIds = activeSpecs.map(s => s.id);
    }

    // Validate that provided specs exist and are compiled
    if (resolvedSpecIds.length > 0) {
      const validSpecs = await prisma.analysisSpec.findMany({
        where: { id: { in: resolvedSpecIds } },
        select: { id: true, name: true, compiledAt: true, isDirty: true },
      });

      const invalidSpecs = validSpecs.filter(s => !s.compiledAt || s.isDirty);
      if (invalidSpecs.length > 0) {
        return NextResponse.json({
          ok: false,
          error: `Some specs are not compiled: ${invalidSpecs.map(s => s.name).join(", ")}`,
          invalidSpecs: invalidSpecs.map(s => ({ id: s.id, name: s.name })),
        }, { status: 400 });
      }
    }

    // Count specs by type
    const specCounts = await prisma.analysisSpec.groupBy({
      by: ["outputType"],
      where: { id: { in: resolvedSpecIds } },
      _count: true,
    });

    const measureSpecCount = specCounts.find(c => c.outputType === "MEASURE")?._count || 0;
    const learnSpecCount = specCounts.find(c => c.outputType === "LEARN")?._count || 0;

    // Count unique parameters used by MEASURE specs (via actions)
    const parameterCount = await prisma.analysisAction.count({
      where: {
        trigger: {
          spec: {
            id: { in: resolvedSpecIds },
            outputType: "MEASURE",
          },
        },
        parameterId: { not: null },
      },
    });

    // Create compiled set in DRAFT status
    const compiledSet = await prisma.compiledAnalysisSet.create({
      data: {
        name,
        description,
        analysisProfileId: profileId,
        specIds: resolvedSpecIds,
        status: "DRAFT",
        measureSpecCount,
        learnSpecCount,
        parameterCount,
      },
      include: {
        analysisProfile: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      compiledSet,
      message: "Run Config created in DRAFT status. Use /compile endpoint to validate and compile.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create run config" },
      { status: 500 }
    );
  }
}
